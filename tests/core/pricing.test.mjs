import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pricingForModel, outputPriceForModel, costForUsage } = require('../../src/core/pricing.js');

test('Fable 5 resolves to an exact entry with the 2026-06-10 source', () => {
  const p = pricingForModel('claude-fable-5');
  assert.equal(p.model, 'claude-fable-5');
  assert.equal(p.outputPerMTok, 50);
  assert.equal(p.source, 'anthropic-pricing-2026-06-10');
});

test('Opus 4.8 resolves to the verified $5/$25 entry (not a prefix fallback)', () => {
  const p = pricingForModel('claude-opus-4-8');
  assert.equal(p.model, 'claude-opus-4-8');
  assert.equal(p.inputPerMTok, 5);
  assert.equal(p.outputPerMTok, 25);
  assert.equal(p.source, 'anthropic-pricing-2026-06-16');
});

test('Opus 4.8 1M-context variant prefix-matches the explicit 4.8 entry', () => {
  // The exact session model id is e.g. "claude-opus-4-8[1m]"; the longer
  // "claude-opus-4-8" key must win over the shorter "claude-opus-4" key.
  const p = pricingForModel('claude-opus-4-8[1m]');
  assert.equal(p.model, 'claude-opus-4-8');
  assert.equal(p.outputPerMTok, 25);
});

test('Sonnet 4.6 (default compression backend) resolves to an explicit entry', () => {
  const p = pricingForModel('claude-sonnet-4-6');
  assert.equal(p.model, 'claude-sonnet-4-6');
  assert.equal(p.outputPerMTok, 15);
  assert.equal(p.source, 'anthropic-pricing-2026-06-16');
});

test('Haiku 4.5 resolves to the verified $1/$5 entry', () => {
  const p = pricingForModel('claude-haiku-4-5');
  assert.equal(p.model, 'claude-haiku-4-5');
  assert.equal(p.inputPerMTok, 1);
  assert.equal(p.outputPerMTok, 5);
});

test('plain Opus 4 still resolves to its own entry', () => {
  const p = pricingForModel('claude-opus-4');
  assert.equal(p.model, 'claude-opus-4');
  assert.equal(p.source, 'anthropic-pricing-prefix');
});

test('Opus 4.8 output is half the retired Fable per token (migrating to Opus already cuts cost)', () => {
  assert.equal(outputPriceForModel('claude-opus-4-8'), 25);
  assert.equal(outputPriceForModel('claude-fable-5'), 50);
  const cut = { output: 1000 };
  const opusCost = costForUsage(cut, pricingForModel('claude-opus-4-8'));
  const fableCost = costForUsage(cut, pricingForModel('claude-fable-5'));
  // Opus 4.8 ($25/M out) is half the retired Fable 5 ($50/M out): the same
  // output on Opus costs 0.5x what it did on Fable. The optimizer's value is
  // the percent reduction it adds on top, not a per-token price premium.
  assert.equal(opusCost < fableCost, true);
  assert.equal(Math.round((opusCost / fableCost) * 100) / 100, 0.5);
});

test('unknown model returns null rather than guessing', () => {
  assert.equal(pricingForModel('gpt-9'), null);
  assert.equal(pricingForModel(''), null);
  assert.equal(pricingForModel(undefined), null);
});
