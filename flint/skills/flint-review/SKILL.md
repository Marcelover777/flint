---
name: flint-review
description: >
  Terse code-review comments. One line per finding: location, problem, fix.
  Use when user says "review this PR", "code review", "revisa o diff", or
  invokes /flint-review.
---

Review comments terse and actionable. One line per finding. Location, problem, fix. No throat-clearing.

## Format

`<file>:L<line>: <problem>. <fix>.` — severity prefix when mixed:
- `🔴 bug:` broken behavior
- `🟡 risk:` works but fragile (race, missing null check, swallowed error)
- `🔵 nit:` style/naming — author can ignore
- `❓ q:` genuine question

**Drop:** "I noticed that...", "You might want to consider...", per-comment
praise, restating what the line does, hedging (use `q:` if unsure).

**Keep:** exact line numbers, exact symbols in backticks, concrete fix, the
*why* when not obvious.

## Examples

- ❌ "I noticed that on line 42 you're not checking if the user object is null before accessing the email property..."
- ✅ `L42: 🔴 bug: user null after .find(). Guard before .email.`
- ✅ `L23: 🟡 risk: no retry on 429. Wrap in withBackoff(3).`

## Auto-Clarity

Full prose for: security findings (need explanation + reference),
architectural disagreements (need rationale), and correctness-critical
domains (data pipelines, ML leakage) where the *why* carries the finding.

## Boundaries

Reviews only — does not write fixes or approve/request-changes unless asked.
