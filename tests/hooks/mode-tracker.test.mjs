import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Functional coverage for BOTH mode-tracker copies: command parsing,
// natural-language on/off (EN + PT-BR), the "para is a preposition" guard,
// filename guards (flint-stats.js is not the product), namespaced plugin
// commands, and the /flint-stats interception contract.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const VARIANTS = [
  {
    name: 'classic',
    script: path.join(ROOT, 'src', 'hooks', 'flint-mode-tracker.js'),
    env: (dir) => ({ CLAUDE_CONFIG_DIR: dir }),
    flag: (dir) => path.join(dir, '.flint-active'),
  },
  {
    name: 'engine',
    script: path.join(ROOT, 'flint', 'engine', 'hooks', 'flint-mode-tracker.js'),
    env: (dir) => ({ FLINT_STATE_DIR: dir }),
    flag: (dir) => path.join(dir, '.flint-active'),
  },
];

function runTracker(variant, dir, prompt) {
  return spawnSync(process.execPath, [variant.script], {
    input: JSON.stringify({ session_id: 'trk-test', prompt }),
    encoding: 'utf8',
    env: { ...process.env, ...variant.env(dir) },
  });
}

for (const v of VARIANTS) {
  test(`[${v.name}] /flint ultra sets the flag; /flint off clears it`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-trk-${v.name}-`));
    runTracker(v, dir, '/flint ultra');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'ultra');
    runTracker(v, dir, '/flint off');
    assert.equal(fs.existsSync(v.flag(dir)), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] namespaced plugin commands set independent modes`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-trk-${v.name}-`));
    runTracker(v, dir, '/flint:flint-commit');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'commit');
    runTracker(v, dir, '/flint:flint-review');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'review');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] PT preposition "para" and flint-* filenames never toggle the mode`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-trk-${v.name}-`));
    fs.writeFileSync(v.flag(dir), 'full');
    runTracker(v, dir, 'gera um teste para o flint-stats');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'full', 'preposition must not deactivate');
    runTracker(v, dir, 'adiciona docs para flint ultra');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'full');
    fs.rmSync(v.flag(dir), { force: true });
    runTracker(v, dir, 'start the flint-stats script for me');
    assert.equal(fs.existsSync(v.flag(dir)), false, 'filename must not activate');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] natural language toggles: liga/pare/modo normal`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-trk-${v.name}-`));
    runTracker(v, dir, 'liga o flint');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'full');
    runTracker(v, dir, 'pare o flint agora');
    assert.equal(fs.existsSync(v.flag(dir)), false);
    runTracker(v, dir, 'activate flint mode');
    assert.equal(fs.readFileSync(v.flag(dir), 'utf8'), 'full');
    runTracker(v, dir, 'modo normal por favor');
    assert.equal(fs.existsSync(v.flag(dir)), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(`[${v.name}] /flint-stats is intercepted with decision:block`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `flint-trk-${v.name}-`));
    // No transcript_path — the stats child errors, tracker must still block
    // with a helpful reason rather than letting the model handle the turn.
    const r = runTracker(v, dir, '/flint-stats');
    const out = JSON.parse(r.stdout);
    assert.equal(out.decision, 'block');
    assert.ok(typeof out.reason === 'string' && out.reason.length > 0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}
