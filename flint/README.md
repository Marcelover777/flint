# Flint 2 — standalone, project-local token optimizer for Claude Fable 5

The detached-from-caveman flint package: installs into one project's `.claude/`
directory, auto-activates every Claude Code session there, and is tuned for
**Claude Fable 5** (`claude-fable-5`, $10/$50 per MTok — every output token cut
is worth 2x an Opus token). No global state, no `~/.claude` writes, no
dependency on the caveman install layout.

```
your-project/.claude/
├── settings.json              hooks (SessionStart, UserPromptSubmit) + statusline (merged by installer)
├── skills/flint*/             /flint, /flint-stats, /flint-compress, /flint-commit,
│                              /flint-review, /flint-help, /flint-crew
├── agents/flint-{scout,smith,judge}.md   compact subagents (~1/3 tool-result size)
└── flint/                     engine (this folder's ./engine)
    ├── config.json            defaults: mode full, target model claude-fable-5
    ├── hooks/                 activate, mode-tracker, stats, prompt-policy, statusline
    ├── commands/              flint-compress / flint-bench / flint-doctor / flint-config
    ├── core/                  pricing, protect, validate, deterministic-compress, ...
    ├── data/output-savings.json  measured savings ratios (only real numbers)
    └── state/                 runtime flags, history, backups (created on demand)
```

## Install (per project)

```bash
node flint/install.mjs /path/to/your/project     # or run from the project: node /path/to/flint/install.mjs
```

The installer copies engine + skills + agents into `<project>/.claude/`, merges
hooks + statusline into `<project>/.claude/settings.json` (existing settings
preserved; existing statusLine never overwritten), and is idempotent — safe to
re-run to update. Uninstall: `node flint/install.mjs /path --uninstall`.

Add `.claude/` to the project's `.gitignore` if it isn't already.

## What's different from caveman (v1)

1. **Fable 5 is the target, not a retired model.** `claude-fable-5` is
   Anthropic's current Mythos-class model; config, stats pricing, and bench
   default to it.
2. **Agent-loop rules, not just chat terseness.** The MICRO ruleset caps final
   messages (≤5 lines in `full`), limits tool-call narration to ≤1 line, and
   forbids re-printing code/diffs/tool output (`cite file:line`) — that's where
   agentic sessions actually burn output tokens.
3. **Stronger local compressor.** ~50 deterministic EN + PT-BR rewrite rules +
   contractions. Measured, local-only, zero network: 14.4% on prose-heavy EN,
   9.9% PT-BR, 10.8% mixed code/prose (upstream hybrid-LLM smoke was
   11.5%/3.6% on comparable fixtures); 50-60% on genuinely verbose prose.
   Same safety: protected spans byte-exact, validation gate, safe fallback.
4. **Fully self-contained.** Config/state/cache/backups live under the engine
   dir. Modes: `lite | full | ultra` (wenyan dropped). PT-BR triggers
   ("modo flint", "modo normal") and PT-BR drift detection included.

## Daily use

On by default (`full`). `/flint lite` softer · `/flint ultra` harder ·
`/flint off` or "normal mode"/"modo normal" stops. `/flint-stats` shows real
session tokens + USD priced for the model in the session log. Statusline shows
`[FLINT] ⚡ <lifetime saved>`.

Disable auto-on: `FLINT_DEFAULT_MODE=off` or `"defaultMode": "off"` in
`engine/config.json`.

## Validation

```bash
node --test flint/engine/tests/core/*.test.mjs flint/engine/tests/hooks/*.test.mjs flint/engine/tests/commands/*.test.mjs
node flint/engine/commands/flint-doctor.js --json    # after installing into a project
node flint/engine/commands/flint-bench.js --offline --report
```

48/48 tests green at port time. Savings ratio used by `/flint-stats` is the
measured 0.65 for `full` (inherited from the upstream Opus 4.8 eval);
recalibrate against Fable with
`node .claude/flint/commands/flint-bench.js --online --model claude-fable-5`
(budget-guarded, hard $15 cap).
