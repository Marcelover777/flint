# flint-crew

Decision guide. When to delegate to flint subagents instead of doing the work inline.

## What it does

Tells the main thread when to spawn a flint-style subagent versus the vanilla equivalent. The win: subagent tool-results inject back into main context verbatim, and flint output is roughly 1/3 the size of vanilla prose. Across 20 delegations in one session, that is the difference between context exhaustion and finishing the task.

Three subagents:

| Subagent | Job | Use when |
|----------|-----|----------|
| `flint-scout` | Locate code (read-only) | "Where is X defined / what calls Y / list uses of Z" |
| `flint-smith` | Surgical edit, 1-2 files | Scope is obvious, ≤2 files. Refuses 3+ file scope. |
| `flint-judge` | Diff/file review | One-line findings with severity emoji |

Use vanilla `Explore` or `Code Reviewer` when you want prose, architecture commentary, or rationale. Use main thread directly for one-line answers and 3+ file refactors.

This skill is a decision guide, not a slash command. It activates when the conversation mentions delegation.

## How to invoke

Triggers on phrases like "delegate to subagent", "use flint-crew", "spawn investigator", "save context", "compressed agent output".

## Example chaining

Locate → fix → verify (most common):

1. `flint-scout` returns site list (`path:line — symbol — note`)
2. Main thread picks 1-2 sites, hands paths to `flint-smith`
3. `flint-judge` audits the resulting diff

Parallel scout: spawn 2-3 `flint-scout` calls in one message with different angles (defs, callers, tests). Aggregate in main.

## See also

- [`SKILL.md`](./SKILL.md) — full decision matrix and output contracts
- [`agents/flint-scout.md`](../../agents/flint-scout.md)
- [`agents/flint-smith.md`](../../agents/flint-smith.md)
- [`agents/flint-judge.md`](../../agents/flint-judge.md)
- [Flint README](../../README.md) — repo overview
