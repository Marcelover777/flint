import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const stats = require('../../src/hooks/flint-stats.js');
const STATS = path.resolve('src/hooks/flint-stats.js');

function makeSession(dir) {
  const file = path.join(dir, 's.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ type: 'assistant', message: { model: 'claude-fable-5', usage: { input_tokens: 1000, output_tokens: 350, cache_creation_input_tokens: 100, cache_read_input_tokens: 200 } } }),
  ].join('\n'));
  return file;
}

test('Fable 5 pricing and parseSession include input/cache tokens', () => {
  assert.equal(stats.priceForModel('claude-fable-5'), 50);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-stats-'));
  const file = makeSession(dir);
  const parsed = stats.parseSession(file);
  assert.equal(parsed.inputTokens, 1000);
  assert.equal(parsed.outputTokens, 350);
  assert.equal(parsed.cacheCreationTokens, 100);
  assert.equal(parsed.cacheReadTokens, 200);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--json emits schema_version 2 payload', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-stats-json-'));
  const claudeDir = path.join(dir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, '.flint-active'), 'full');
  const file = makeSession(dir);
  const r = spawnSync(process.execPath, [STATS, '--session-file', file, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
  });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.equal(json.schema_version, 2);
  assert.equal(json.model, 'claude-fable-5');
  assert.equal(json.tokens.input, 1000);
  assert.equal(json.cost_usd.actual > 0, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
