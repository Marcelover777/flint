---
name: flint-stats
description: >
  Show real token usage and estimated savings/cost (USD, Fable 5 pricing) for
  the current session. Reads the Claude Code session log directly — no AI
  estimation. Triggers on /flint-stats. Output is injected by the
  flint-mode-tracker hook; the model itself does not compute the numbers.
---

This skill is delivered by `.claude/flint/hooks/flint-stats.js` (invoked by
`.claude/flint/hooks/flint-mode-tracker.js` when the prompt is `/flint-stats`).
The hook returns `decision: "block"` with the formatted stats as the reason, so
the user sees the numbers immediately and the model does nothing.

If the hook did not fire (e.g. flint hooks not wired), run it manually:

```bash
node .claude/flint/hooks/flint-stats.js            # current session
node .claude/flint/hooks/flint-stats.js --json     # machine-readable
node .claude/flint/hooks/flint-stats.js --all      # lifetime, all sessions
node .claude/flint/hooks/flint-stats.js --since 7d # window
```

Report the output verbatim, nothing else.
