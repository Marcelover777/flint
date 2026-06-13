# Opus 4.8 Optimizer — Delivery Report (2026-06-13)

Re-test of the optimizer against **Claude Opus 4.8** after **Fable 5 was retired**
(`claude-fable-5` → `404 "not available, please use Opus 4.8"`). Online numbers
come from one budgeted run of `node src/commands/caveman-bench.js --online --model
claude-opus-4-8 --max-spend 1.5 --report`, priced via `src/core/pricing.js`.

## Spend

| Run | Calls | Input tok | Output tok | Cost |
|-----|------:|----------:|-----------:|-----:|
| Opus 4.8 bench | 21 | 12,239 | 9,317 | **$0.88 of $1.50 cap** |
| Sonnet-backend doc compress (3 fixtures) | ~10 | ~4k | ~2.2k | ~$0.05 |
| **Total** | | | | **~$0.93 of $15 hard cap** |

Committed snapshot: `evals/reports/claude-opus-4-8-2026-06-13-online.json`.

## Surface 1 — Visible output vs no-compression mode (Opus 4.8)

6 prompts (EN dev, PT-BR, agentic), 800-token cap. Baseline hit the cap on
several prompts, so reductions are underestimates.

| Arm (same prompts, same run) | Mean | p50 | Worst | Best |
|------------------------------|----:|----:|------:|-----:|
| Plain caveman-style terse line | 59.4% | 64.1% | 33.6% | 69.6% |
| **Optimizer tuned line** | **76.7%** | **79.3%** | **64.5%** | **86.4%** |

Optimizer emits ~43% fewer output tokens than the caveman-style line
(`(1−0.767)/(1−0.594) ≈ 0.57`). Opus tracks the terseness instruction even more
tightly than Fable 5 did (Fable mean was 70.7%).

## Surface 2 — Doc/context compression (Opus 4.8)

`--check`, strict validation, no cache. Two backends; **all results passed
whole-file validation (`ok: true`)**.

| Fixture | Local-only | Opus backend | Sonnet 4.6 backend | Sonnet fallbacks |
|---------|----------:|-------------:|-------------------:|------------------|
| prose-heavy.md (EN) | 13.3% | 51.3% | 48.9% | 1 section → local (safe) |
| prose-heavy-ptbr.md | 8.7% | 29.4% | 31.7% | 1 section → local (safe) |
| mixed-code.md | 10.9% | 31.2% | 15.2% | 3 sections → local (safe) |

The Sonnet fallbacks are the safety net working: a weaker backend that breaks an
invariant falls back to the safe local result instead of corrupting the doc.

## Combined cost model (illustrative, Opus 4.8 pricing)

One turn: 4,000 doc tokens re-sent as context + 1,000 output tokens uncompressed
($15/M in, $75/M out).

| Setup | Context | Output | Cost/turn |
|-------|--------:|-------:|----------:|
| No compression | 4,000 | 1,000 | $0.1350 |
| Caveman (output only, 59.4%) | 4,000 | 406 | $0.0905 |
| **Optimizer** (output 76.7% + docs ~46%) | 2,160 | 233 | **$0.0499** |

→ ~45% cheaper/turn than caveman, ~63% cheaper than no compression; context
savings recur every turn.

## Fixes shipped this session

1. **Fable-5 dead-model defaults** (the real bug exposed by retirement):
   `targetModel` → `claude-opus-4-8`; compression backend `llmModel` →
   `claude-sonnet-4-6`; `caveman-bench` online default, `caveman-compress` bare
   `--llm` fallback, `token-count` default, and the stats recommendation string
   all moved off the retired model. The Fable pricing entry stays only so old
   logs price.
2. **Explicit pricing entries** for `claude-opus-4-8`, `claude-sonnet-4-6`,
   `claude-haiku-4-5` (honest `inherited-…-unverified` provenance).
3. **`caveman-bench` report filenames** now use the benched model slug
   (`claude-opus-4-8-…`) instead of a hardcoded `fable5-` prefix.
4. **`--llm` arg-parsing guard**: `--llm --check` no longer swallows `--check`
   as the model name; bare `--llm` defaults the backend.

## Quality / tests

- **0 fidelity failures** in the Opus run (`fidelity_verdict: no_critical_failures`).
- **96/96** unit tests pass (`npm run test:all`); was 85 → +11 (Opus/Sonnet/Haiku
  pricing resolution, the `--llm` parse guard, 1.5× economics).
- `git diff --check` clean. `caveman-doctor --json` exit 0.
