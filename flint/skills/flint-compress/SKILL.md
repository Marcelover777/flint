---
name: flint-compress
description: >
  Safely compress natural-language memory/context files (CLAUDE.md, notes,
  docs) with the local-first flint optimizer, cutting the tokens those files
  cost on every future session. Preserves code, URLs, paths, commands, env
  vars, numbers, headings, frontmatter byte-exact. Supports --check, --diff,
  --local-only, --llm, --restore, --json. Trigger: /flint-compress FILEPATH or
  "compress memory file" / "comprime o arquivo".
---

# Flint Compress

Compress prose files to cut input/context tokens on every future session.
Local deterministic compression runs first; LLM compression is opt-in only via
`--llm <model>` (default backend `claude-sonnet-4-6`) — default never calls the
network.

## Process

Preview first, from the project root:

```bash
node .claude/flint/commands/flint-compress.js <filepath> --check --local-only
```

If the check passes and the user asked to write, run again without `--check`.

Flags: `--check` `--diff` `--out <file>` `--strict` `--local-only`
`--llm claude-sonnet-4-6` `--max-llm-usd <n>` `--restore` `--json` `--dry-run`
`--no-cache`

## Safety

Before any LLM call the engine: validates extension/path, scans path/content/
entropy for secrets, protects code/URLs/paths/commands/env-vars/versions/
numbers/model-names/links/errors, runs deterministic compression, validates
strict invariants, and writes atomically with a backup only after validation
passes. If the secret scan flags high/critical risk it aborts before the LLM —
do not override in chat.

**Committed docs:** never compress version-controlled repo docs (CLAUDE.md,
docs/) without the user explicitly asking — those are load-bearing, reviewed
files. Untracked personal notes are fair game.

## Reversibility

Writes create a backup under `.claude/flint/state/backups/<timestamp>/` and a
report under `.claude/flint/state/reports/` — nothing is dropped into the
working tree. `--restore` restores the latest backup for the file.

## Return

Report: changed file, backup path, validation result, and % saved. With
`--json`, return parseable JSON only.
