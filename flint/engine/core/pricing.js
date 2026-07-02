// Model-aware Claude pricing helpers. Values are USD per million tokens.
// Keep pricing centralized so docs, stats, doctor, and bench cannot drift.
// Verified against platform.claude.com models overview on 2026-06-16:
// Opus 4.8 $5/$25, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5, Fable 5 $10/$50.
// Cache write (5m) = 1.25x input, cache read = 0.10x input (standard multipliers).

const MODEL_PRICING = {
  'claude-fable-5': {
    inputPerMTok: 10.00,
    outputPerMTok: 50.00,
    cacheWritePerMTok: 12.50,
    cacheReadPerMTok: 1.00,
    source: 'anthropic-pricing-2026-06-10',
  },
  // Opus 4.8 (and its 1M-context "[1m]" variant) resolve here explicitly so
  // stats/bench/doctor are model-aware instead of leaning on the prefix matcher.
  // Opus 4.8/4.7/4.6/4.5 are all $5/$25 (verified); only the legacy 4.0/4.1
  // family is $15/$75. Longer keys win over 'claude-opus-4' in pricingForModel().
  'claude-opus-4-8': {
    inputPerMTok: 5.00,
    outputPerMTok: 25.00,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.50,
    source: 'anthropic-pricing-2026-06-16',
  },
  'claude-opus-4-7': {
    inputPerMTok: 5.00,
    outputPerMTok: 25.00,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.50,
    source: 'anthropic-pricing-2026-06-16',
  },
  'claude-opus-4-6': {
    inputPerMTok: 5.00,
    outputPerMTok: 25.00,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.50,
    source: 'anthropic-pricing-2026-06-16',
  },
  'claude-opus-4-5': {
    inputPerMTok: 5.00,
    outputPerMTok: 25.00,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.50,
    source: 'anthropic-pricing-2026-06-16',
  },
  // Legacy Opus 4.0 / 4.1 — $15/$75 (the family prefix; 4.5+ override above).
  'claude-opus-4': {
    inputPerMTok: 15.00,
    outputPerMTok: 75.00,
    cacheWritePerMTok: 18.75,
    cacheReadPerMTok: 1.50,
    source: 'anthropic-pricing-prefix',
  },
  // Current-generation models commonly seen post-Fable (Sonnet 4.6 is the
  // default compression backend). Verified 2026-06-16; longer keys win over
  // the family prefix in pricingForModel.
  'claude-sonnet-4-6': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.30,
    source: 'anthropic-pricing-2026-06-16',
  },
  'claude-haiku-4-5': {
    inputPerMTok: 1.00,
    outputPerMTok: 5.00,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.10,
    source: 'anthropic-pricing-2026-06-16',
  },
  'claude-sonnet-4': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.30,
    source: 'anthropic-pricing-prefix',
  },
  'claude-haiku-4': {
    inputPerMTok: 0.80,
    outputPerMTok: 4.00,
    cacheWritePerMTok: 1.00,
    cacheReadPerMTok: 0.08,
    source: 'anthropic-pricing-prefix',
  },
  'claude-3-5-sonnet': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.30,
    source: 'anthropic-pricing-prefix',
  },
  'claude-3-5-haiku': {
    inputPerMTok: 0.80,
    outputPerMTok: 4.00,
    cacheWritePerMTok: 1.00,
    cacheReadPerMTok: 0.08,
    source: 'anthropic-pricing-prefix',
  },
  'claude-3-opus': {
    inputPerMTok: 15.00,
    outputPerMTok: 75.00,
    cacheWritePerMTok: 18.75,
    cacheReadPerMTok: 1.50,
    source: 'anthropic-pricing-prefix',
  },
};

function pricingForModel(model) {
  if (!model) return null;
  if (MODEL_PRICING[model]) return { model: model, ...MODEL_PRICING[model] };
  const entries = Object.keys(MODEL_PRICING)
    .sort((a, b) => b.length - a.length);
  for (const prefix of entries) {
    if (model.startsWith(prefix)) return { model: prefix, ...MODEL_PRICING[prefix] };
  }
  return null;
}

function outputPriceForModel(model) {
  const pricing = pricingForModel(model);
  return pricing ? pricing.outputPerMTok : null;
}

function costForUsage(tokens, pricing) {
  if (!pricing) return null;
  const t = tokens || {};
  const perM = 1_000_000;
  return (
    ((t.input || 0) / perM) * pricing.inputPerMTok +
    ((t.output || 0) / perM) * pricing.outputPerMTok +
    ((t.cache_write || t.cacheCreation || 0) / perM) * pricing.cacheWritePerMTok +
    ((t.cache_read || t.cacheRead || 0) / perM) * pricing.cacheReadPerMTok
  );
}

function estimateBaseline({ tokens, modeRatio, pricing, injectionOverhead = 0 }) {
  const actual = tokens || {};
  if (modeRatio == null) {
    return {
      estimatedBaselineOutput: 0,
      estimatedSavedOutput: 0,
      estimatedNetSaved: 0,
      actualCostUsd: pricing ? costForUsage(actual, pricing) : null,
      baselineCostUsd: null,
      savedCostUsd: null,
    };
  }

  const estimatedBaselineOutput = Math.round((actual.output || 0) / (1 - modeRatio));
  const estimatedSavedOutput = Math.max(0, estimatedBaselineOutput - (actual.output || 0));
  const estimatedNetSaved = Math.max(0, estimatedSavedOutput - injectionOverhead);

  // Token estimates stand on their own — an unknown model id (Bedrock/Vertex
  // prefixes, future models) must not zero them; only the USD lines go null.
  if (!pricing) {
    return {
      estimatedBaselineOutput,
      estimatedSavedOutput,
      estimatedNetSaved,
      actualCostUsd: null,
      baselineCostUsd: null,
      savedCostUsd: null,
    };
  }

  const actualCostUsd = costForUsage(actual, pricing);
  const baselineCostUsd = costForUsage(
    { ...actual, output: estimatedBaselineOutput, input: (actual.input || 0) + injectionOverhead },
    pricing
  );
  const savedCostUsd = baselineCostUsd != null && actualCostUsd != null
    ? Math.max(0, baselineCostUsd - actualCostUsd)
    : null;

  return {
    estimatedBaselineOutput,
    estimatedSavedOutput,
    estimatedNetSaved,
    actualCostUsd,
    baselineCostUsd,
    savedCostUsd,
  };
}

function formatUsd(amount) {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(4)}`;
}

module.exports = {
  MODEL_PRICING,
  pricingForModel,
  outputPriceForModel,
  costForUsage,
  estimateBaseline,
  formatUsd,
};
