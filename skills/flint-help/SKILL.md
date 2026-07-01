---
name: flint-help
description: >
  Quick-reference card for all flint modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /flint-help,
  "flint help", "what flint commands", "how do I use flint".
---

# Flint Help

Display this reference card when invoked. One-shot — do NOT change mode, write flag files, or persist anything. Output in flint style.

## Modes

| Mode | Trigger | What change |
|------|---------|-------------|
| **Lite** | `/flint lite` | Drop filler. Keep sentence structure. |
| **Full** | `/flint` | Drop articles, filler, pleasantries, hedging. Fragments OK. Default. |
| **Ultra** | `/flint ultra` | Extreme compression. Bare fragments. Tables over prose. |
| **Wenyan-Lite** | `/flint wenyan-lite` | Classical Chinese style, light compression. |
| **Wenyan-Full** | `/flint wenyan` | Full 文言文. Maximum classical terseness. |
| **Wenyan-Ultra** | `/flint wenyan-ultra` | Extreme. Ancient scholar on a budget. |

Mode stick until changed or session end.

## Skills

| Skill | Trigger | What it do |
|-------|---------|-----------|
| **flint-commit** | `/flint-commit` | Terse commit messages. Conventional Commits. ≤50 char subject. |
| **flint-review** | `/flint-review` | One-line PR comments: `L42: bug: user null. Add guard.` |
| **flint-compress** | `/flint-compress <file>` | Compress .md files to flint prose. Saves ~46% input tokens. |
| **flint-help** | `/flint-help` | This card. |

## Deactivate

Say "stop flint" or "normal mode". Resume anytime with `/flint`.

## Configure Default Mode

Default mode = `full`. Change it:

**Environment variable** (highest priority):
```bash
export FLINT_DEFAULT_MODE=ultra
```

**Config file** (`~/.config/flint/config.json`):
```json
{ "defaultMode": "lite" }
```

Set `"off"` to disable auto-activation on session start. User can still activate manually with `/flint`.

Resolution: env var > config file > `full`.

## More

Full docs: https://github.com/Marcelover777/flint
