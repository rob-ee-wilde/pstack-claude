// The system prompt the Oh-My-Pi extension returns from before_agent_start.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import pstack, { install, ompToolsNote } from "../../plugins/pstack/omp/index.ts";
import { sheetCases, writeSheet } from "../session-hook-sheets.mjs";

const pluginRoot = fileURLToPath(new URL("../../plugins/pstack", import.meta.url));
const mandate = readFileSync(join(pluginRoot, "hooks/session-start-context.md"), "utf8");
const pointer = ompToolsNote(pluginRoot);

const dirs = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Installs the extension against an agent directory holding `sheet`, if any,
// and returns a function that runs its before_agent_start handler.
function start({ sheet } = {}) {
  const agentDir = mkdtempSync(join(tmpdir(), "pstack-omp-"));
  dirs.push(agentDir);
  if (sheet !== undefined) writeSheet(join(agentDir, "pstack-models.md"), sheet);
  const handlers = [];
  install({ on: (event, handler) => handlers.push([event, handler]) }, { pluginRoot, agentDir });
  expect(handlers.map(([event]) => event)).toEqual(["before_agent_start"]);
  return (systemPrompt, depth) => handlers[0][1]({ systemPrompt }, depth === undefined ? {} : { agent: { depth } }).systemPrompt;
}

describe("before_agent_start", () => {
  test("keeps the base prompt first and adds the pointer and mandate when there is no sheet", () => {
    const run = start();
    expect(run(["base a", "base b"], 0)).toEqual(["base a", "base b", pointer, mandate]);
    expect(run("base", 0)).toEqual(["base", pointer, mandate]);
  });

  test("a context without agent depth counts as the main session", () => {
    expect(start()(["base"])).toEqual(["base", pointer, mandate]);
  });

  test("adds the full sheet after the mandate on every prompt", () => {
    const sheet = "arena runners: opus, fable, sonnet\nsession hook: on\n";
    const run = start({ sheet });
    for (let i = 0; i < 2; i++) expect(run(["base"], 0)).toEqual(["base", pointer, mandate, sheet]);
  });

  test("a subagent gets the pointer and the sheet but not the mandate", () => {
    const sheet = "swarm workers: opus\n";
    expect(start({ sheet })(["base"], 1)).toEqual(["base", pointer, sheet]);
    expect(start()(["base"], 2)).toEqual(["base", pointer]);
  });

  for (const { name, sheet, off } of sheetCases) {
    test(`${off ? "drops" : "keeps"} the mandate when the sheet has ${name}`, () => {
      expect(start({ sheet })(["base"], 0).includes(mandate)).toBe(!off);
    });
  }

  test("the pointer names the plugin's omp-tools.md, which exists", () => {
    const file = join(pluginRoot, "skills/poteto-mode/references/omp-tools.md");
    expect(pointer).toContain(file);
    expect(readFileSync(file, "utf8")).toContain("# Oh-My-Pi tool mapping");
  });

  test("the default export reads the sheet from $PI_CODING_AGENT_DIR", () => {
    const agentDir = mkdtempSync(join(tmpdir(), "pstack-omp-"));
    dirs.push(agentDir);
    writeSheet(join(agentDir, "pstack-models.md"), "session hook: off\n");
    const saved = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = agentDir;
    try {
      const handlers = [];
      pstack({ on: (_event, handler) => handlers.push(handler) });
      expect(handlers[0]({ systemPrompt: ["base"] }, { agent: { depth: 0 } }).systemPrompt).toEqual([
        "base",
        pointer,
        "session hook: off\n",
      ]);
    } finally {
      if (saved === undefined) delete process.env.PI_CODING_AGENT_DIR;
      else process.env.PI_CODING_AGENT_DIR = saved;
    }
  });
});
