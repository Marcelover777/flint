import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// flint 2 installer (flint/install.mjs) — the only code in the repo that
// rewrites a user's .claude/settings.json. Pins: fresh install, idempotency,
// foreign-hook preservation, malformed-settings abort, clean uninstall.
const INSTALLER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'install.mjs');

function run(projectDir, ...args) {
  return spawnSync(process.execPath, [INSTALLER, projectDir, ...args], { encoding: 'utf8' });
}

function readSettings(projectDir) {
  return JSON.parse(fs.readFileSync(path.join(projectDir, '.claude', 'settings.json'), 'utf8'));
}

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'flint2-inst-'));
}

test('fresh install copies engine+skills+agents and wires 3 hook events', () => {
  const dir = tmpProject();
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'flint', 'hooks', 'flint-activate.js')));
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'skills', 'flint', 'MICRO.md')));
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'agents', 'flint-scout.md')));
  const s = readSettings(dir);
  for (const ev of ['SessionStart', 'UserPromptSubmit', 'SessionEnd']) {
    assert.equal((s.hooks[ev] || []).length, 1, `${ev} wired once`);
  }
  // hook commands use an absolute node path, not bare `node`
  assert.match(s.hooks.SessionStart[0].hooks[0].command, /^".+node(\.exe)?" /i);
  assert.ok(s.statusLine, 'statusline configured when absent');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('re-install is idempotent (no duplicate hook entries)', () => {
  const dir = tmpProject();
  run(dir);
  run(dir);
  const s = readSettings(dir);
  for (const ev of ['SessionStart', 'UserPromptSubmit', 'SessionEnd']) {
    assert.equal(s.hooks[ev].length, 1, `${ev} still wired once after re-run`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('foreign hooks and foreign statusline survive install AND uninstall', () => {
  const dir = tmpProject();
  const dotClaude = path.join(dir, '.claude');
  fs.mkdirSync(dotClaude, { recursive: true });
  // a user hook whose path merely CONTAINS "flint-" must never be treated as ours
  const foreign = {
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'node "C:\\tools\\my-flint-lookalike.js"' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'node "C:\\tools\\other.js"' }] }],
    },
    statusLine: { type: 'command', command: 'mystatusline.exe' },
    permissions: { allow: ['Bash(git status *)'] },
  };
  fs.writeFileSync(path.join(dotClaude, 'settings.json'), JSON.stringify(foreign, null, 2));
  run(dir);
  let s = readSettings(dir);
  assert.equal(s.hooks.SessionStart.length, 2, 'foreign SessionStart hook kept alongside ours');
  assert.equal(s.hooks.Stop.length, 1);
  assert.equal(s.statusLine.command, 'mystatusline.exe', 'existing statusline never overwritten');
  assert.deepEqual(s.permissions, foreign.permissions);
  run(dir, '--uninstall');
  s = readSettings(dir);
  assert.equal(s.hooks.SessionStart.length, 1, 'only our hook removed');
  assert.match(s.hooks.SessionStart[0].hooks[0].command, /my-flint-lookalike/);
  assert.equal(s.hooks.Stop.length, 1);
  assert.equal(s.statusLine.command, 'mystatusline.exe');
  assert.ok(!fs.existsSync(path.join(dotClaude, 'flint')), 'engine removed');
  assert.ok(!fs.existsSync(path.join(dotClaude, 'skills', 'flint')), 'skills removed');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('malformed settings.json aborts with exit 3 and is left untouched', () => {
  const dir = tmpProject();
  const dotClaude = path.join(dir, '.claude');
  fs.mkdirSync(dotClaude, { recursive: true });
  const broken = '{ "hooks": { /* jsonc comment */ }, }';
  fs.writeFileSync(path.join(dotClaude, 'settings.json'), broken);
  const r = run(dir);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not valid JSON/);
  assert.equal(fs.readFileSync(path.join(dotClaude, 'settings.json'), 'utf8'), broken, 'file untouched');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--dry-run writes nothing', () => {
  const dir = tmpProject();
  const r = run(dir, '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(dir, '.claude', 'settings.json')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude', 'flint')));
  fs.rmSync(dir, { recursive: true, force: true });
});
