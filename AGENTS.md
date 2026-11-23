# Repository Guidelines

## Project Overview

pstack-claude ports Lauren Tan's Cursor **pstack** skill stack (upstream `cursor/plugins`) to Claude Code, Codex, Pi, and skills-only installs. All of these builds share one skills tree, `plugins/pstack/skills/`. `poteto-mode` is the router skill. The repo tracks upstream through a pinned SHA and carries forks that are declared by name. `CONTEXT.md` is the domain glossary; read it for terms like Build, Role, Panel, Sync boundary, Upstream pin and Invariants.

## Architecture & Data Flow

```text
upstream cursor/plugins ──sync.mjs──▶ plugins/pstack/skills/  (substitutions → deriveSkill → 3-way merge)
VERSION, models.json, docs/reference.md, codex-tools.md ──generate.mjs──▶ stamped regions + generated files
```

- **`tools/generate.mjs`** stamps copies from the sources of truth and enforces cross-file invariants. Its header comment (about lines 1–42) maps each source to its outputs. `--check` writes nothing and is the CI and pre-commit gate.
  - `VERSION` is stamped into 4 manifests: `package.json`, `.claude-plugin/marketplace.json`, `plugins/pstack/.claude-plugin/plugin.json` and `plugins/pstack/.codex-plugin/plugin.json`.
  - The slash-command table in `docs/reference.md` produces the Codex prompt stubs in `plugins/pstack/.codex-plugin/prompts/`. Its rows must match the public skills one-to-one, and `poteto-mode` must be the first row.
  - `plugins/pstack/models.json` produces the Models, Reasoning effort and Model names sections, `effort-agents/*` and the agents list in `plugin.json`.
- **`tools/sync.mjs <pstack|cursor-team-kit> <sha> [--dry-run]`** clones upstream, then applies `tools/substitutions.json` (ordered Cursor→Claude rewrites plus a denylist). Each file is then classified as added, updated, forked, merged, conflicted and so on.
  - The run fails without writing anything on: denylist hits, binary conflicts, or forks missing from `tools/forks.json`.
  - On success it advances the pin in `tools/upstream.json` even when conflicts remain. Text conflicts are left in the tree as git markers, and the generator rejects them.
- **`tools/runtimes.mjs`**: the `RUNTIMES` table for non-Claude runtimes (Codex, Pi). Add a runtime by adding a row.
- **`tools/validate-skills.mjs`**: checks links and backticked prose paths, and provides the shared `walk()`.
- **Pi build**: the root `package.json` `pi` key points at `plugins/pstack/skills` and the extension `plugins/pstack/pi/index.ts`.
- **Oh-My-Pi build**: `plugins/pstack/package.json` (`omp.extensions`) plus `plugins/pstack/omp/index.ts`, installed with `omp plugin link plugins/pstack`. It is a thin adapter: it only appends the mapping pointer, the routing mandate (main session, `ctx.agent.depth === 0`), and the override sheet to `before_agent_start`'s `systemPrompt`; subagents, questions and todos use Oh-My-Pi's own tools. That package.json must never gain a `pi` key, because Oh-My-Pi falls back to it and would load the Pi extension, which it cannot run (`validateOmpPackage` enforces this).

## Key Directories

- `plugins/pstack/skills/<name>/SKILL.md`: skill content. Most of it is upstream-owned; editing it creates a fork.
- `plugins/pstack/{agents,effort-agents,hooks,pi,omp}/`: subagent definitions, generated effort agents, session hooks (`.sh` and `.ps1`), the Pi extension (TS), and the Oh-My-Pi extension (TS, no Oh-My-Pi imports: it declares the API slice it uses).
- `plugins/pstack/skills/poteto-mode/scripts/`: a vendored TS sub-project with its own lockfile (`orch`, `watch-pr`).
- `tools/`: generator, sync and validators, plus the JSON registries (`upstream.json`, `forks.json`, `substitutions.json`).
- `tests/`: the `bun:test` suite. `tests/pi/` tests the Pi extension against a fake `pi` child process; `tests/omp/` tests the Oh-My-Pi extension's `before_agent_start` output.
- `docs/reference.md` (command table, layout), `docs/pi-equivalence.md` (62 mechanisms, enforced by a test).

## Development Commands

`package.json` has no `scripts`, so call each tool directly.

```bash
bun install --frozen-lockfile
bun tools/generate.mjs            # regenerate after any source change
bun tools/generate.mjs --check    # CI gate; also the pre-commit hook (`prek install`)
bun test tests/                   # full suite
bun test tests/generate.test.mjs -t "stampVersion"   # one file or test
bun tools/sync.mjs pstack <sha> --dry-run           # preview an upstream sync
bun tools/typecheck-pi.mjs        # needs PI_PACKAGE_DIR or a global @earendil-works/pi-coding-agent@1.0.0
npx --yes markdownlint-cli2@0.18.1 '**/*.md'
# vendored scripts (cwd plugins/pstack/skills/poteto-mode/scripts):
bun install --frozen-lockfile && bun run typecheck && bun test orch watch-pr && bunx prettier@3.6.2 --check .
```

## Code Conventions & Common Patterns

- Tools are ESM `.mjs` files that import with the `node:` prefix. They have no side effects on import: `main` runs only behind the `import.meta.url === pathToFileURL(argv[1])` guard, so tests import their functions directly.
- Errors are `throw new Error("<file>: message")`. The problems collector prints `FAIL:` and exits 1; usage errors exit 2. Comments cite the incident behind each rule (for example "CHANGES 0.9.8" or "#58"); keep doing that.
- Region locators return `[start, end)` line ranges. The same locator drives both stamping and the stray-model-slug exemption.
- Skill rules:
  - The frontmatter `name` must equal the directory name, match `^[a-z0-9]+(-[a-z0-9]+)*$` and be at most 64 characters.
  - `description` is required and at most 1024 characters, and must be safe as a plain YAML scalar.
  - `principle-*` skills must set `user-invocable: false`.
  - Never use `disable-model-invocation`, and never create a `plugins/pstack/commands/` directory.
- Subagent dispatch in skills must be namespaced: `subagent_type: "pstack:<agent>"` (Claude Code's plugin agent names). Oh-My-Pi's `task` tool exposes the same agents unprefixed (`agent: "poteto-agent"`); `omp-tools.md` maps one to the other.
- Skills keep Claude-native wording. Codex, Pi and Oh-My-Pi map tool names through `poteto-mode/references/{codex-tools,pi-tools,omp-tools}.md`; add per-skill notes as table rows there, never in the skill body. Each mapping is a `RUNTIMES` row in `tools/runtimes.mjs`; Oh-My-Pi reuses the `pi` block of `models.json`.
- Model IDs and family names belong only in `models.json`. A `claude-*` ID that appears outside a generated region fails the generator.
- Links and backticked paths in skills must stay inside `skills/`, because skills-only installs ship nothing else.

## Important Files

- `VERSION`: the only place to set the version. Never hand-edit a version in a manifest.
- `CHANGES.md`: newest entry first, headed `## X.Y.Z - lowercase title`. Sync entries record the old and new pin plus the measured counts.
- `tools/forks.json`: each intentional divergence from upstream as `{kind: port-feature|policy, why, since, upstream}`.
- `tools/substitutions.json`: a longer pattern must come before any shorter pattern it contains, and every rule needs a `rationale`.
- `plugins/pstack/models.json`: model policy (roles, tiers, panel, efforts).
- `.github/workflows/ci.yml` and `security.yml`, `.pre-commit-config.yaml`, `.markdownlint-cli2.jsonc` (correctness rules only).

## Runtime/Tooling Preferences

- **Bun 1.3.14**, pinned in CI. The generator uses `Bun.YAML`, so run tools with `bun`, not `node`. Some tests start `node` as a child process, so `node` must also be on PATH.
- Package manager: bun (`bun.lock`). Never add root dependencies or bump the vendored lockfile: `bun.lock` stays byte-identical to upstream, and Prettier is pinned in CI for the same reason.
- Pin GitHub Actions to a 40-character SHA. Only GitHub-owned and verified actions are allowed; run any other tool through `npx` or docker, pinned.
- **Release**: a behavior change only reaches installs if the version moves. Edit `VERSION`, add the `CHANGES.md` heading, then run `bun tools/generate.mjs`.

## Testing & QA

- Every test uses `bun:test`, some with `node:assert/strict`. Fixtures live in `mkdtemp` directories. `tests/pi/harness.mjs` (`useWorld`, `fakePi`) runs `tests/pi/fake-pi.mjs`, which follows the script in `PSTACK_FAKE_PI_SCRIPT`.
- `tests/invariants.test.mjs` gives each generator invariant a fixture that must trip it. Add a fixture there whenever you add an invariant.
- Gated and skipped suites:
  - `PSTACK_PI_LIVE=1`: real models, costs money.
  - `PSTACK_PI_REQUIRE_CATALOG=1`: the catalog test otherwise skips when Pi is not installed.
  - `PSTACK_REQUIRE_WINDOWS_HOOK=1`: the Windows hook test otherwise skips off win32.
  - `tests/skill-collision-repro.sh` needs the `claude` CLI and API access. CI does not run it; run it locally before releases.
- Hazard: the pre-commit hook reads the working tree, not the index. An unstaged regenerated file passes locally and still fails CI.
- Run `bun install --frozen-lockfile` before testing. Without it, the Pi tests fail with "Cannot find package 'typebox'".
- `tests/worktree-audit.test.mjs` calls `git worktree list --porcelain -z`. Git 2.34.1 rejects this with "unknown switch `z'", so those tests fail on older git.
- CI fails on: a stale generated file, an undeclared fork (a `sync --dry-run` for each component), the skills-only `diff -qr plugins/pstack/skills .agents/skills`, Pi types, the vendored scripts checks, shellcheck, actionlint, markdownlint, lychee `--offline`, osv-scanner and zizmor.
- PR claims should name the check that was run, for example "52/52 bun tests pass". Keep each PR to one concern.
