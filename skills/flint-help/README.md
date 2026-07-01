# flint-help

Quick-reference card. One shot, no mode change.

## What it does

Prints a cheat sheet of all flint modes, sibling skills, deactivation triggers, and how to set the default mode via env var or config file. One-shot display — does not flip the active mode, write flag files, or persist anything. Use when you forget the slash commands.

## How to invoke

```
/flint-help
```

Also triggers on "flint help", "what flint commands", "how do I use flint".

## Example output

```
Modes:
  /flint              full (default)
  /flint lite         lighter
  /flint ultra        extreme
  /flint wenyan       classical Chinese

Skills:
  /flint-commit       terse Conventional Commits
  /flint-review       one-line PR comments
  /flint-stats        session token savings

Deactivate:
  "stop flint" or "normal mode"
```

## See also

- [`SKILL.md`](./SKILL.md) — full reference card
- [Flint README](../../README.md) — repo overview
