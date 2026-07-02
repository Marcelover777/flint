import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The flint 2 engine (flint/engine/core) vendors the shared core so installs
// are self-contained. Every core fix must land in BOTH copies — this test is
// the drift alarm. If it fails: copy the src/core file over the engine copy
// (or vice versa) so they are byte-identical again.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const SHARED = [
  'deterministic-compress.js',
  'protect.js',
  'validate.js',
  'markdown-sections.js',
  'pricing.js',
  'secret-scan.js',
  'token-count.js',
  'env.js',
];

for (const file of SHARED) {
  test(`src/core/${file} is byte-identical to flint/engine/core/${file}`, () => {
    const a = fs.readFileSync(path.join(ROOT, 'src', 'core', file), 'utf8').replace(/\r\n/g, '\n');
    const b = fs.readFileSync(path.join(ROOT, 'flint', 'engine', 'core', file), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(a, b, `${file} drifted between src/core and flint/engine/core — sync them`);
  });
}
