---
name: flint-help
description: >
  Quick-reference card for all flint modes, skills, and commands. One-shot
  display, not a persistent mode. Trigger: /flint-help, "flint help",
  "como uso o flint", "what flint commands".
---

Display this card when invoked. One-shot — do NOT change mode, write flag
files, or persist anything. Output in flint style.

## Modes

| Mode | Trigger | What changes |
|------|---------|--------------|
| **lite** | `/flint lite` | No filler/recap. Keep grammar. Final ≤8 lines |
| **full** | `/flint` | Fragments, agent-loop rules, final ≤5 lines. Default |
| **ultra** | `/flint ultra` | Telegraphic, zero tool narration, final ≤3 lines |

Mode sticks until changed or session end. Off: "flint off" / "modo normal".

## Skills

| Skill | What it does |
|-------|--------------|
| `/flint-commit` | Terse Conventional Commits, ≤50 char subject |
| `/flint-review` | One-line PR comments: `L42: 🔴 bug: user null. Guard.` |
| `/flint-stats` | Real session tokens + lifetime savings + USD (Fable 5 pricing). `--json`, `--all`, `--since 7d` |
| `/flint-compress <file>` | Compress memory/notes files (measured: 10-14% local-only on prose, more with `--llm`), backups in engine state |
| `/flint-crew` | When to delegate to compact subagents (flint-scout/smith/judge) |

## Engine CLI (run from project root)

```bash
node .claude/flint/commands/flint-doctor.js --json    # health check
node .claude/flint/commands/flint-bench.js --offline --report
node .claude/flint/commands/flint-config.js show|set <path> <value>
```

## Config

Default mode: env `FLINT_DEFAULT_MODE` > `.claude/flint/config.json`
`defaultMode` > `full`. Set `"off"` to disable auto-activation. Target model
default `claude-fable-5`. Statusline badge `[FLINT] ⚡ 12.4k` = lifetime tokens
saved (off: `FLINT_STATUSLINE_SAVINGS=0`).
