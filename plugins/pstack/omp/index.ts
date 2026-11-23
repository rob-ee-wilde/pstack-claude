import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The slice of Oh-My-Pi's extension API this file uses, declared here so the
// package needs neither a runtime nor a type dependency on Oh-My-Pi.
// `systemPrompt` is the base each handler chains from, and a returned
// `systemPrompt` replaces it whole. `agent.depth` is 0 in the main session and
// 1 or more in a `task` subagent, which runs this same extension in-process.
export interface AgentStartEvent {
  systemPrompt: string | string[];
}
export interface AgentStartContext {
  agent?: { depth: number };
}
export interface OmpExtensionAPI {
  on(
    event: "before_agent_start",
    handler: (event: AgentStartEvent, ctx: AgentStartContext) => { systemPrompt: string[] },
  ): void;
}

export interface Settings {
  pluginRoot: string;
  agentDir: string;
}

export function defaultSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  return {
    pluginRoot: join(dirname(fileURLToPath(import.meta.url)), ".."),
    agentDir: env.PI_CODING_AGENT_DIR || join(homedir(), ".omp", "agent"),
  };
}

// The same off switch the Claude Code and Codex hooks read: an exact
// `session hook: off` line, after an optional BOM, with LF or CRLF endings.
function readSheet(agentDir: string): { text: string; hookOff: boolean } | undefined {
  const file = join(agentDir, "pstack-models.md");
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) return undefined;
  const text = readFileSync(file, "utf8");
  return { text, hookOff: text.replace(/^\uFEFF/, "").split(/\r?\n/).includes("session hook: off") };
}

export function ompToolsNote(pluginRoot: string): string {
  const file = join(pluginRoot, "skills", "poteto-mode", "references", "omp-tools.md");
  return `pstack skills are written for Claude Code. When one names a Claude Code tool (Agent, Skill, AskUserQuestion, Bash), a bundled skill, or a Claude model, read ${file} for the Oh-My-Pi equivalent before following it.`;
}

// Claude Code runs the session hook and loads the sheet through a CLAUDE.md
// include; Oh-My-Pi has neither, so both ride as system prompt sections, set
// again on every prompt so compaction cannot drop them. A subagent gets the
// sheet, as a Claude Code subagent sees CLAUDE.md, but not the mandate:
// SessionStart does not run for subagents. Oh-My-Pi's own system prompt
// already asks for independent tool calls in one response, so the Pi
// extension's parallel-calls section has no counterpart here.
export function install(pi: OmpExtensionAPI, settings: Settings): void {
  const mandateFile = join(settings.pluginRoot, "hooks", "session-start-context.md");
  const toolsNote = ompToolsNote(settings.pluginRoot);
  pi.on("before_agent_start", (event, ctx) => {
    const sheet = readSheet(settings.agentDir);
    const sections = [toolsNote];
    if ((ctx.agent?.depth ?? 0) === 0 && !sheet?.hookOff) sections.push(readFileSync(mandateFile, "utf8"));
    if (sheet) sections.push(sheet.text);
    return { systemPrompt: [...[event.systemPrompt].flat(), ...sections] };
  });
}

export default function pstack(pi: OmpExtensionAPI): void {
  install(pi, defaultSettings());
}
