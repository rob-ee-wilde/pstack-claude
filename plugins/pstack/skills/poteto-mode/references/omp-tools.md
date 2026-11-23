# Oh-My-Pi tool mapping for pstack

pstack skills are written in Claude Code tool language (the `Skill` tool, the `Agent` tool, `AskUserQuestion`, Claude model names). On Oh-My-Pi (`omp`) the skills are the same files, loaded from the linked pstack plugin, and Oh-My-Pi's own tools stand in for Claude Code's. This file maps the two. It is not the [Pi mapping](pi-tools.md): Oh-My-Pi does not run the pstack Pi extension, so `agent`, `send_message`, `list_agents`, `stop_agent`, `ask_user_question`, `schedule_wakeup`, and `/loop` do not exist here.

## Tool actions

| pstack / Claude action | Oh-My-Pi equivalent |
|------------------------|---------------------|
| Read a file | `read` |
| Create a file | `write` |
| Edit a file | `edit` |
| Delete a file | `bash` (`rm`) |
| Run a shell command | `bash` |
| Search file contents | `grep` |
| Find files by name | `glob` |
| Fetch a URL | `read` with the URL as its path |
| Search the web | `web_search` |
| Invoke a skill (the `Skill` tool, `/command`) | Skills load natively. Read one with `read skill://<name>`, or force one with `/skill:<name>`. A skill named `pstack:<name>` is the skill `<name>`. |
| Dispatch a subagent (the `Agent`/`Task` tool) | `task`, one item per subagent |
| Dispatch N parallel subagents in one turn | One `task` call with N `tasks[]` items |
| Wait for a subagent result | With background tasks enabled, the result arrives as a message when the subagent finishes; call `wait` only when you have nothing else to do. Otherwise the `task` call returns the results. |
| Continue or steer a subagent (`SendMessage`) | `write agent://<id>` while it runs |
| Read a subagent's output | `read agent://<id>` |
| Stop a subagent | `write proc://<id>/kill` |
| Track tasks (the todolist; `TaskCreate` / `TaskUpdate`, or `TodoWrite` on Claude Code) | `todo` |
| Ask the human a fixed-choice question (`AskUserQuestion`) | `ask`. Batch related questions in one call. |
| Schedule a self-paced re-invocation (`ScheduleWakeup`) | Oh-My-Pi has no wake-up tool. Start the long-running check as a background `bash` job and act on its completion notice. |
| Read this workspace's session transcripts (Claude Code's `~/.claude/projects/<encoded-cwd>/`) | Oh-My-Pi sessions live in `sessions/<encoded-cwd>/` under the Oh-My-Pi agent directory (see Session routing), one `.jsonl` per session; a session's subagents are `.jsonl` files in a directory named after the session file. |

## Subagent policy

poteto-mode's Subagents section applies on Oh-My-Pi through the `task` tool:

- `subagent_type: "pstack:poteto-agent"` becomes the `task` item field `agent: "poteto-agent"`, and `"pstack:comment-sicko"` becomes `agent: "comment-sicko"`; both load from the plugin's agents directory. `general-purpose`, or no `subagent_type`, omits `agent` (the default `task` agent). Claude Code's `Explore` maps to `agent: "scout"`; for other built-in types, use the default agent and put the constraint in the task. A batch `task` call takes a shared `context` plus `tasks[]`, and each item needs `task` and `solutionSpace`.
- The effort agents (`pstack:poteto-agent-<level>`, `pstack:effort-<level>`) are not loaded. Dispatch `poteto-agent` or the default agent instead, and append `:<level>` to the item's `model` (for example `<provider>/<id>:high`, with the ID from Model names). `session`, or an agent with no effort, leaves `model` without a level, or uses `@default` to run on the parent's model and effort.
- `readonly: true` has no `task` field. Say in the task that the subagent must not change files.
- `isolation: "worktree"` maps to the item's `isolated: true`, which exists when `task.isolation.enabled` is on. Without it, give each writing subagent its own output directory.
- Keep the rest of the policy unchanged. Pass file pointers not inlined context, give each worker its own workspace when they write, review every subagent's diff yourself.

## Model names

Skills name models by the Claude aliases in their Models sections. On Oh-My-Pi, pass the model ID from the column of the provider your session runs on as the `task` item's `model`, or `@default` to run the subagent on your own model:

| Alias | `anthropic` | `openai` | `openai-codex` |
| --- | --- | --- | --- |
| `opus` | `anthropic/claude-opus-5-5` | `openai/gpt-6.1-sol` | `openai-codex/gpt-6.1-sol` |
| `fable` | `anthropic/claude-fable-5-1` | `openai/gpt-6-astra` | `openai-codex/gpt-6-astra` |
| `sonnet` | `anthropic/claude-sonnet-5-5` | `openai/gpt-6-sol` | `openai-codex/gpt-6-sol` |
| `haiku` | `anthropic/claude-haiku-4-5` | `openai/gpt-6-luna` | `openai-codex/gpt-6-luna` |

A `model` that matches no model you can reach fails the `task` call instead of falling back, so check `omp models` when one fails. Diverse-model panels (`arena`, `architect`, `interrogate`, `how` critics, `reflect`) stay diverse only while their aliases resolve to distinct models. If one model family is all you can reach, vary the reasoning effort and note in the verdict that diversity was reduced.

`/setup-pstack` writes the configured model list. On Oh-My-Pi, write the model rows as Oh-My-Pi model IDs.

## Session routing

The pstack Oh-My-Pi extension, which the linked plugin loads, adds the poteto-mode mandate, the text the Claude Code and Codex `SessionStart` hook injects, to the system prompt of every main-session prompt, so the mandate survives compaction. It also adds the override sheet, because Oh-My-Pi has no include syntax for context files. The sheet is `pstack-models.md` in the Oh-My-Pi agent directory, which is `$PI_CODING_AGENT_DIR` when set and `~/.omp/agent` otherwise. `session hook: off` in the sheet stops the mandate. `task` subagents get the sheet but not the mandate, as Claude Code subagents see CLAUDE.md but run no `SessionStart` hook. Every session, subagents and sessions with the hook off included, also gets a pointer to this file.

Without the extension nothing is injected. Request `poteto-mode` explicitly with `/skill:poteto-mode`, or add a standing instruction to `AGENTS.md`.

## Driver and bundled skills pstack references

The [driver policy](../SKILL.md#non-negotiables) selects the app driver. For skills and drivers named by these workflows, use these Oh-My-Pi equivalents:

| Skill or driver named in pstack | On Oh-My-Pi |
|---------------------------------|-------------|
| `run` (drive a CLI/TUI to see a change work) | Oh-My-Pi has no `run` skill. Run the app yourself via `bash` and observe the real output. |
| `verify` (the project's `.claude/skills/verify/`, or Claude Code's bundled `/verify`) | Oh-My-Pi discovers `.claude/skills/` when its Claude provider is enabled; otherwise read the project skill's SKILL.md by path. Without a project skill, drive the app as for `run`. |
| Project UI driver | Drive the UI with whatever automation you have, or hand the user a concrete manual check. Do not claim done without observing the artifact. |
| `plugin-dev:skill-development` (Claude's SKILL.md authoring guidance) | Follow the Agent Skills specification. Keep `name` + `description` frontmatter, name the directory after the skill, and use progressive disclosure. |
| `loop` (recurring/self-paced re-invocation, used by `babysit`) | Oh-My-Pi has no `/loop`. Re-check on each turn the user starts, or watch with a background `bash` job and act on its completion notice. |

## Per-skill notes

No skill file carries an Oh-My-Pi line. poteto-mode's Platform Adaptation section points here once, and the extension's system prompt points here in every session, so read a skill's row before you follow that skill. Most skills need only the tables above. These need one more mapping:

| Skill | On Oh-My-Pi |
|-------|-------------|
| `poteto-mode` | The todolist is the `todo` tool, and the Subagents defaults map through Subagent policy above. The Eval and Session pickup playbooks read transcripts from the Oh-My-Pi sessions directory (see Tool actions). |
| `interrogate` | Reviewers dispatch as `task` items with the same agent and a `model` from Model names; say in each task that it must not change files. Keep the panel on distinct models. |
| `recall` | Search the Oh-My-Pi sessions directory for this workspace (see Tool actions). Do not list or read `~/.claude/projects/`: it holds Claude Code transcripts, not this session's history. |
| `show-me-your-work` | Check the log against this run's Oh-My-Pi session file (see Tool actions), not a Claude Code transcript. |
| `setup-pstack` | The sheet is `pstack-models.md` in the Oh-My-Pi agent directory (see Session routing), and the extension loads it, so no include line is needed. List models with `omp models`. The role rows and the five effort levels are identical. The `session hook` line applies on Oh-My-Pi too, where `off` stops the extension adding the mandate. |
| `no-comments` | `pstack:comment-sicko` is the `task` agent `comment-sicko`. Pass it the scope, not a request to run `/no-comments`, and run it without `isolated`, because an isolated workspace lacks the scope's uncommitted changes. |
| `teach` | Running `how` and `why` in parallel maps to two items in one `task` call. |
| `create-verification-skill` | The generated skill lands under `.claude/skills/verify/` on Claude Code. Write it where Oh-My-Pi discovers project skills, `.omp/skills/verify/` or `.agents/skills/verify/`, instead. The app-driving harness is platform-neutral. |
| `maintain-verification-skill` | The parallel per-feature source readers map to items in one `task` call. The project-local skill lives under `.omp/skills/` or `.agents/skills/`. |
| `babysit` | `loop` and `AskUserQuestion` resolve through the tables above. |
| `automate-me` | `plugin-dev:skill-development` resolves through the skills table above. The workspace's transcripts are its Oh-My-Pi sessions directory (see Tool actions). Write the mode skill to `.omp/skills/<handle>-mode/SKILL.md` or `.agents/skills/<handle>-mode/SKILL.md`. |
| `architect` | The runner panel goes through the **arena** skill, so its `task` fan-out and model IDs apply here too. |
| `arena` | The parallel candidates and the cross-judge are `task` items on the configured models (see Model names). |
| `how` | The parallel explorers and the explainer are `task` items; say in each that it must not change files. |
| `reflect` | The three reviewers and the synthesizer are `task` items. The transcript finder is tested on Claude Code and Pi transcripts only, so if it finds no opening prompt, read this workspace's Oh-My-Pi session file directly (see Tool actions). Skill files load from the linked plugin directory, not `~/.claude/plugins/`, so treat reads under that directory as plugin skill reads. |
| `swarm` | Each worker is a `task` item on the configured model. Give each writing worker `isolated: true` or its own output directory (see Subagent policy above). |
| `why` | The parallel investigators are items in one `task` call, and the synthesizer is a second call once every investigator has returned, because their results carry the findings the synthesizer gets. |

## Vendored scripts

`skills/poteto-mode/scripts/` ships the `watch-pr` PR watcher, the `orch` store CLI, and `worktree-audit.mjs`. These scripts use bun and Node.js and run the same on Oh-My-Pi; invoke them through `bash`. They need `bun`, `gh`, and (for stack work) `gt`. `worktree-audit.mjs` reads Claude Code and Pi transcripts; it is untested on Oh-My-Pi sessions, so do not treat "no recent chat" as proof that no Oh-My-Pi session used a worktree.

## Instructions file

Where a pstack skill says "your instructions file", on Oh-My-Pi that is `AGENTS.md` (or `.omp/AGENTS.md`), which Oh-My-Pi loads from the working directory up to the repository root, plus `~/.omp/agent/AGENTS.md`. On Claude Code it is `CLAUDE.md`.
