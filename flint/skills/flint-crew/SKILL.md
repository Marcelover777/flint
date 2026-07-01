---
name: flint-crew
description: >
  Decision guide for delegating to flint-compressed subagents. Tells the main
  thread WHEN to spawn flint-scout (locate code), flint-smith (1-2 file edit),
  or flint-judge (diff review) instead of working inline or using vanilla
  Explore. Subagent output is flint-compressed so the tool-result injected back
  into main context is ~60% smaller — main context lasts longer.
  Trigger: "use flint crew", "delegate compact", "spawn scout/smith/judge",
  "save context".
---

Flint-crew = three subagent presets that emit flint output. Same jobs as the
vanilla defaults (`Explore`, edit agents, reviewers); the difference is the
tool-result they return is compressed, so each delegation costs less main
context.

## When to use which

| Task | Use |
|---|---|
| "Where is X defined / what calls Y / list uses of Z" | `flint-scout` |
| Same but you want architecture commentary too | `Explore` (vanilla) |
| Surgical edit, ≤2 files, scope obvious | `flint-smith` |
| New feature / 3+ files / cross-cutting refactor | Main thread |
| Review diff/branch/file for bugs | `flint-judge` |
| Deep review with rationale + alternatives | `/code-review` (vanilla) |
| One-line answer you already know | Main thread, no subagent |

Rule of thumb: **if you'd want the subagent's finding in 1/3 the tokens, pick
flint-crew. If you'd want prose, pick vanilla.**

## Why this exists

Subagent tool-results are injected into main context verbatim. A vanilla
Explore returning 2k tokens of prose costs 2k tokens of main-context budget
every delegation. The same finding from flint-scout returns ~700. Across 20
delegations that's the difference between context exhaustion and finishing.

## Output contracts

- `flint-scout` → `FINDINGS` (file:line + evidence + confidence), `HYPOTHESIS`, `NEXT`
- `flint-smith` → `CHANGED` (file:line per edit), `VERIFY` (command run + result), `RISK`
- `flint-judge` → one line per finding: `file:Lnn: 🔴|🟡|🔵 problem. fix.` + `VERDICT`
