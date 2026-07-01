---
name: flint-commit
description: >
  Terse commit message generator. Conventional Commits, subject ≤50 chars,
  body only when the "why" isn't obvious. Use when user says "write a commit",
  "commit message", "mensagem de commit", or invokes /flint-commit.
---

Write commit messages terse and exact. Conventional Commits. No fluff. Why over what.

## Rules

**Subject:** `<type>(<scope>): <imperative summary>` — scope optional. Types:
`feat fix refactor perf docs test chore build ci style revert`. Imperative
("add", "fix" — not "added"). ≤50 chars preferred, hard cap 72. No trailing
period.

**Body (only if needed):** skip when subject is self-explanatory. Add only for
non-obvious *why*, breaking changes, migrations, linked issues. Wrap at 72.
`Closes #42` at end.

**Never include:** "This commit does X", "I/we/now", restating the filename
when scope says it, emoji (unless project convention).

**Project conventions win:** if the repo's CLAUDE.md mandates trailers
(`Co-Authored-By: ...`) or a format, that rule outranks this skill's brevity.

## Examples

- ❌ `feat: add a new endpoint to get user profile information from the database`
- ✅ `feat(api): add GET /users/:id/profile`

Breaking change:
```
feat(api)!: rename /v1/orders to /v1/checkout

BREAKING CHANGE: clients must migrate before 2026-06-01.
Old route returns 410 after that date.
```

## Auto-Clarity

Always include a body for: breaking changes, security fixes, data migrations,
reverts. Future debuggers need context — never compress those to subject-only.

## Boundaries

Generates the message only — does not run `git commit`, stage, or amend, unless
the user separately asked for the commit itself.
