import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { scanSecrets } = require('../../src/core/secret-scan.js');

test('blocks known secret content before LLM', () => {
  const result = scanSecrets({ content: 'ANTHROPIC_API_KEY=sk-ant-abcdefghijklmnopqrstuvwxyz123456' });
  assert.equal(result.ok, false);
  assert.equal(result.action, 'abort_before_llm');
});

test('blocks sensitive paths', () => {
  const result = scanSecrets({ filePath: 'C:/repo/.aws/credentials', content: 'docs only' });
  assert.equal(result.ok, false);
  assert.equal(result.findings[0].type, 'sensitive_path');
});

test('blocks AWS access keys and private key blocks', () => {
  assert.equal(scanSecrets({ content: 'aws_access_key_id = AKIAIOSFODNN7EXAMPLE' }).ok, false);
  assert.equal(scanSecrets({ content: '-----BEGIN RSA PRIVATE KEY-----' }).ok, false);
});

test('blocks anthropic/github-style tokens', () => {
  assert.equal(scanSecrets({ content: 'key=sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }).ok, false);
  assert.equal(scanSecrets({ content: 'token: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }).ok, false);
});

test('normalizes Windows paths in the deny-list check', () => {
  const r = scanSecrets({ filePath: 'C:\\Users\\x\\.ssh\\id_rsa', content: 'anything' });
  assert.equal(r.ok, false);
});

test('plain technical prose still passes', () => {
  const r = scanSecrets({ content: 'The API returns 401 when the bearer token header is missing.' });
  assert.equal(r.ok, true);
});
