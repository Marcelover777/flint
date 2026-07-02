#!/usr/bin/env node
// flint 2 installer — project-local, idempotent, zero deps (Node >= 18).
//
//   node flint/install.mjs [/path/to/project] [--uninstall] [--dry-run]
//
// Copies engine + skills + agents into <project>/.claude/, merges SessionStart
// + UserPromptSubmit hooks and a statusline command into
// <project>/.claude/settings.json. Re-run to update. Never overwrites an
// existing non-flint statusLine; never touches other hooks.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const dryRun = args.includes('--dry-run');
const targetArg = args.find(a => !a.startsWith('--'));
const project = path.resolve(targetArg || process.cwd());
const dotClaude = path.join(project, '.claude');

const SKILLS = ['flint', 'flint-stats', 'flint-compress', 'flint-commit', 'flint-review', 'flint-help', 'flint-crew'];
const AGENTS = ['flint-scout.md', 'flint-smith.md', 'flint-judge.md'];

function log(msg) { process.stdout.write(msg + '\n'); }

function copyDir(src, dest) {
  if (dryRun) return log(`would copy ${src} -> ${dest}`);
  fs.cpSync(src, dest, { recursive: true });
}

function rmrf(p) {
  if (dryRun) return log(`would remove ${p}`);
  fs.rmSync(p, { recursive: true, force: true });
}

// Missing file → fallback. Present-but-unparseable → hard abort: silently
// treating a corrupt settings.json as {} would let the write below destroy
// the user's permissions/hooks/model config.
function readJson(file, fallback) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return fallback; }
  try { return JSON.parse(raw); } catch (e) {
    process.stderr.write(`flint install: ${file} exists but is not valid JSON (${e.message}).\n` +
      'Refusing to touch it — fix or remove the file and re-run.\n');
    process.exit(3);
  }
}

// Only the hook entries THIS installer writes count as ours: the command must
// point into .claude/flint/hooks/. A user's unrelated hook whose path merely
// contains "flint-" must never be filtered out on reinstall/uninstall.
const MANAGED_SCRIPTS = ['flint-activate.js', 'flint-mode-tracker.js', 'flint-session-end.js'];
function isFlintHook(entry) {
  const commands = ((entry && entry.hooks) || []).map(h => String((h && h.command) || ''));
  return commands.some(c =>
    MANAGED_SCRIPTS.some(s => c.includes(s)) &&
    (c.includes(`flint${path.sep}hooks`) || c.includes('flint/hooks')));
}

// Absolute node path: Claude Code hook commands don't always inherit a PATH
// that resolves bare `node` (launcher/GUI starts).
function hookEntry(script, statusMessage, timeout = 5) {
  const abs = path.join(dotClaude, 'flint', 'hooks', script);
  return { hooks: [{ type: 'command', command: `"${process.execPath}" "${abs}"`, timeout, statusMessage }] };
}

function mergeSettings() {
  const file = path.join(dotClaude, 'settings.json');
  const settings = readJson(file, {});
  settings.hooks = settings.hooks || {};
  for (const [event, script, msg, timeout] of [
    ['SessionStart', 'flint-activate.js', 'Loading flint mode...', 5],
    ['UserPromptSubmit', 'flint-mode-tracker.js', 'Tracking flint mode...', 5],
    ['SessionEnd', 'flint-session-end.js', 'Recording flint stats...', 10],
  ]) {
    const list = (settings.hooks[event] || []).filter(e => !isFlintHook(e));
    list.push(hookEntry(script, msg, timeout));
    settings.hooks[event] = list;
  }
  if (!settings.statusLine) {
    const ps1 = path.join(dotClaude, 'flint', 'hooks', 'flint-statusline.ps1');
    const sh = path.join(dotClaude, 'flint', 'hooks', 'flint-statusline.sh');
    settings.statusLine = process.platform === 'win32'
      ? { type: 'command', command: `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"` }
      : { type: 'command', command: `bash "${sh}"` };
  } else if (!JSON.stringify(settings.statusLine).includes('flint-statusline')) {
    log('note: existing statusLine kept — add the flint badge manually if you want it.');
  }
  if (dryRun) return log(`would write ${file}`);
  fs.mkdirSync(dotClaude, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
}

function unmergeSettings() {
  const file = path.join(dotClaude, 'settings.json');
  const settings = readJson(file, null);
  if (!settings) return;
  for (const event of Object.keys(settings.hooks || {})) {
    settings.hooks[event] = (settings.hooks[event] || []).filter(e => !isFlintHook(e));
    if (!settings.hooks[event].length) delete settings.hooks[event];
  }
  if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
  if (settings.statusLine && JSON.stringify(settings.statusLine).includes('flint-statusline')) {
    delete settings.statusLine;
  }
  if (dryRun) return log(`would rewrite ${file}`);
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
}

if (!fs.existsSync(project)) {
  process.stderr.write(`flint install: project dir not found: ${project}\n`);
  process.exit(2);
}

if (uninstall) {
  rmrf(path.join(dotClaude, 'flint'));
  for (const s of SKILLS) rmrf(path.join(dotClaude, 'skills', s));
  for (const a of AGENTS) rmrf(path.join(dotClaude, 'agents', a));
  unmergeSettings();
  log(`flint removed from ${dotClaude}`);
} else {
  copyDir(path.join(HERE, 'engine'), path.join(dotClaude, 'flint'));
  for (const s of SKILLS) copyDir(path.join(HERE, 'skills', s), path.join(dotClaude, 'skills', s));
  if (!dryRun) fs.mkdirSync(path.join(dotClaude, 'agents'), { recursive: true });
  for (const a of AGENTS) {
    if (dryRun) { log(`would copy agent ${a}`); continue; }
    fs.copyFileSync(path.join(HERE, 'agents', a), path.join(dotClaude, 'agents', a));
  }
  mergeSettings();
  log(`flint installed into ${dotClaude}`);
  log('next Claude Code session in this project starts in FLINT full. /flint-help for the card; /flint off to stop.');
  log('reminder: keep .claude/ out of version control (.gitignore).');
}
