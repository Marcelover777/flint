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

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function isFlintHook(entry) {
  return JSON.stringify(entry).includes('flint-');
}

function hookEntry(script, statusMessage) {
  const abs = path.join(dotClaude, 'flint', 'hooks', script);
  return { hooks: [{ type: 'command', command: `node "${abs}"`, timeout: 5, statusMessage }] };
}

function mergeSettings() {
  const file = path.join(dotClaude, 'settings.json');
  const settings = readJson(file, {});
  settings.hooks = settings.hooks || {};
  for (const [event, script, msg] of [
    ['SessionStart', 'flint-activate.js', 'Loading flint mode...'],
    ['UserPromptSubmit', 'flint-mode-tracker.js', 'Tracking flint mode...'],
  ]) {
    const list = (settings.hooks[event] || []).filter(e => !isFlintHook(e));
    list.push(hookEntry(script, msg));
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
