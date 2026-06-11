import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateCompression } = require('../../src/core/validate.js');

test('validates preserved markdown invariants', () => {
  const original = '# A\n\nSee https://example.com and `API_KEY`.\n\n```js\nconst x = 1;\n```\n';
  const compressed = '# A\n\nSee https://example.com + `API_KEY`.\n\n```js\nconst x = 1;\n```\n';
  const result = validateCompression(original, compressed);
  assert.equal(result.ok, true);
});

test('fails when code block changes', () => {
  const original = '```js\nconst x = 1;\n```\n';
  const compressed = '```js\nconst x = 2;\n```\n';
  const result = validateCompression(original, compressed, { strict: false });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'fenced_code_changed');
});

test('plain numbers without units must not change', () => {
  const bad = validateCompression('Set priority 3 and limit 500.', 'Set priority 5 and limit 50.', { strict: true });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(e => e.code === 'plain_numbers_changed'));
  const good = validateCompression('Set priority 3 and limit 500 now.', 'Priority 3, limit 500.', { strict: true });
  assert.ok(!good.errors.some(e => e.code === 'plain_numbers_changed'));
});
