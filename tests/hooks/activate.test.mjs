import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// SessionStart injection selection, both copies: MICRO line lookup by mode,
// off → no flag + 'OK', independent modes → banner, full-skill injection via
// config env override.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const VARIANTS = [
  {
    name: 'classic',
    script: path.join(ROOT, 'src', 'hooks', 'flint-activate.js'),
    env: (dir) => ({ CLAUDE_CONFIG_DIR: dir }),
    flag: (dir) => path.join(dir, '.flint-active'),
  },
  {
    name: 'engine',
    script: path.join(ROOT, 'flint', 'engine', 'hooks', 'flint-activate.js'),
    env: (dir) => ({ FLINT_STATE_DIR: dir }),
    flag: (dir) => path.join(dir, '.flint-active'),
  },
];

function runActivate(variant, dir, extraEnv = {}) {
  return spawnSync(process.execPath, [variant.script], {
    encoding: 'utf8',
    env: { ...process.env, ...variant.env(dir), ...extraEnv },
  });
}

for (const v of VARIANTS) {
  test(`[${v.name}] default full mode injects the FLINT full MICRO line and writes the flag`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-act-${v.name}-`));
    const r = runActivate(v, dir, { FLINT_DEFAULT_MODE: 'full' });
    assert.match(r.stdout, /^FLINT full\./);
    assert.ok(r.stdout.length < 600, 'micro injection must stay compact');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'full');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] ultra/lite modes inject their own MICRO lines`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-act-${v.name}-`));
    assert.match(runActivate(v, dir, { FLINT_DEFAULT_MODE: 'ultra' }).stdout, /^FLINT ultra\./);
    assert.match(runActivate(v, dir, { FLINT_DEFAULT_MODE: 'lite' }).stdout, /^FLINT lite\./);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] off mode clears the flag and prints OK`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-act-${v.name}-`));
    fs.writeFileSync(v.flag(dir), 'full');
    const r = runActivate(v, dir, { FLINT_DEFAULT_MODE: 'off' });
    assert.equal(r.stdout, 'OK');
    assert.equal(fs.existsSync(v.flag(dir)), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] independent mode (commit) prints its banner, no MICRO line`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-act-${v.name}-`));
    const r = runActivate(v, dir, { FLINT_DEFAULT_MODE: 'commit' });
    assert.match(r.stdout, /FLINT MODE ACTIVE - level: commit/);
    assert.doesNotMatch(r.stdout, /^FLINT full\./);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] sessionStart=full config injects the filtered full skill`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-act-${v.name}-`));
    const r = runActivate(v, dir, { FLINT_DEFAULT_MODE: 'full', FLINT_INJECTION_SESSION_START: 'full' });
    assert.match(r.stdout, /FLINT MODE ACTIVE - level: full/);
    assert.ok(r.stdout.length > 600, 'full-skill injection is the long form');
    fs.rmSync(dir, { recursive: true, force: true });
  });
}
