# Flint 2 engine

The self-contained runtime that `flint/install.mjs` copies into a project's
`.claude/flint/`. Hooks resolve config (`config.json`), state (`state/`), and
the skill files (`../skills/flint/`) relative to their own location — nothing
global, nothing outside the install directory.

Full docs, install instructions, and measured numbers: [`../README.md`](../README.md).

```
hooks/      flint-activate (SessionStart), flint-mode-tracker (UserPromptSubmit),
            flint-stats, prompt-policy, flint-statusline.{ps1,sh}, flint-config
commands/   flint-compress / flint-bench / flint-doctor / flint-config CLIs
core/       pricing, protect, validate, deterministic-compress, secret-scan, ...
data/       output-savings.json — measured savings ratios (honest numbers only)
evals/      offline bench prompts + fixtures
tests/      node --test suite (48 tests)
state/      runtime flags/history/backups — created on demand, safe to delete
```

Upstream attribution: safety architecture (symlink-safe state, secret-scan
abort, validated compression) inherited from caveman by Julius Brussee (MIT).
