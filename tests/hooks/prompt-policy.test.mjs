import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { shouldReinforce, scoreDrift } = require('../../src/hooks/prompt-policy.js');
const config = { injection: { reinforcement: 'adaptive', reinforceFirstNTurns: 2, reinforceEveryNTurns: 6, afterLongOutputTokens: 2500 } };

test('reinforces first two turns then backs off', () => {
  assert.equal(shouldReinforce({ prompt: 'hi', activeMode: 'full', config, state: {}, transcript: {} }).reinforce, true);
  assert.equal(shouldReinforce({ prompt: 'hi', activeMode: 'full', config, state: { turn: 5, last_reinforced_turn: 2 }, transcript: {} }).reinforce, false);
  assert.equal(shouldReinforce({ prompt: 'hi', activeMode: 'full', config, state: { turn: 8, last_reinforced_turn: 2 }, transcript: {} }).reinforce, true);
});

test('skips safety/destructive prompts', () => {
  const result = shouldReinforce({ prompt: 'delete all rows permanently', activeMode: 'full', config, state: {}, transcript: {} });
  assert.equal(result.reinforce, false);
  assert.equal(result.reason, 'safety_prompt');
});

test('detects drift filler', () => {
  assert.equal(scoreDrift('Sure, I think maybe this is basically fine') > 0, true);
});
