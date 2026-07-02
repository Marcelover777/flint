#!/usr/bin/env node
// flint - Claude Code SessionStart activation hook.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, loadConfig, safeWriteFlag } = require('./flint-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.flint-active');
const settingsPath = path.join(claudeDir, 'settings.json');
const config = loadConfig();
const mode = getDefaultMode();

if (mode === 'off') {
  try { fs.unlinkSync(flagPath); } catch (_) {}
  process.stdout.write('OK');
  process.exit(0);
}

safeWriteFlag(flagPath, mode);

const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);
if (INDEPENDENT_MODES.has(mode)) {
  process.stdout.write('FLINT MODE ACTIVE - level: ' + mode + '. Behavior defined by /flint-' + mode + ' skill.');
  process.exit(0);
}

const modeLabel = mode === 'wenyan' ? 'wenyan-full' : mode;

function readFirstExisting(files) {
  for (const file of files) {
    try { return fs.readFileSync(file, 'utf8'); } catch (_) {}
  }
  return '';
}

function readMicroRules(label) {
  const content = readFirstExisting([
    path.join(__dirname, '..', 'skills', 'flint', 'MICRO.md'),
    path.join(__dirname, '..', '..', 'skills', 'flint', 'MICRO.md'),
  ]);
  if (content) {
    const prefix = 'FLINT ' + label + '.';
    const hit = content.split('\n').map(s => s.trim()).find(line => line.startsWith(prefix));
    if (hit) return hit;
  }
  const fallback = {
    lite: 'FLINT lite. Concise pro prose, answer-first. No filler/pleasantries/hedging/recap/next-steps. Final <=8 lines+code. <=1 line between tools. Never re-print code/diffs; cite file:line. No headers/tables unasked. Code/paths/URLs/numbers/errors exact. Clear prose for safety/destructive/ambiguous.',
    full: 'FLINT full. Terse fragments. Answer only what asked; no preamble/recap/summary-close/next-steps. Final <=5 lines+code. <=1 line between tools. Never re-print code/diffs/tool output; cite file:line. No headers/tables unasked. Code/paths/URLs/numbers/errors exact. Clear prose for safety/destructive/ambiguous. Persist until off.',
    ultra: 'FLINT ultra. Telegraphic. Answer only. Arrows for causality. One word when enough. Zero tool narration except blockers. Final <=3 lines+code. Never abbrev/re-print code/API/error/path/URL/number. Clear prose for safety/destructive/ambiguous.',
    'wenyan-lite': 'FLINT wenyan-lite. Semi-classical concise. Cut filler/hedge. Code/paths/URLs/numbers/errors exact. Normal prose for safety/destructive/ambiguous.',
    'wenyan-full': 'FLINT wenyan-full. Classical terse. Max concise, technical claims intact. Code/paths/URLs/numbers/errors exact. Normal prose for safety/destructive/ambiguous.',
    'wenyan-ultra': 'FLINT wenyan-ultra. Extreme classical compression. Code/API/error/path/URL/number exact. Normal prose for safety/destructive/ambiguous.',
  };
  return fallback[label] || fallback.full;
}

function readFullSkill(label) {
  const skillContent = readFirstExisting([
    path.join(__dirname, '..', 'skills', 'flint', 'SKILL.md'),
    path.join(__dirname, '..', '..', 'skills', 'flint', 'SKILL.md'),
  ]);
  if (!skillContent) {
    return 'FLINT MODE ACTIVE - level: ' + label + '\n\n' +
      'Respond terse like smart flint. All technical substance stay. Only fluff die.\n\n' +
      'Drop articles/filler/pleasantries/hedging. Fragments OK. Code, paths, URLs, numbers, and errors exact. ' +
      'Use normal prose for security warnings, destructive confirmations, or ambiguous multi-step instructions.';
  }

  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');
  const filtered = body.split('\n').reduce((acc, line) => {
    const tableRowMatch = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
    if (tableRowMatch) {
      if (tableRowMatch[1] === label) acc.push(line);
      return acc;
    }
    const exampleMatch = line.match(/^- (\S+?):\s/);
    if (exampleMatch) {
      if (exampleMatch[1] === label) acc.push(line);
      return acc;
    }
    acc.push(line);
    return acc;
  }, []);
  return 'FLINT MODE ACTIVE - level: ' + label + '\n\n' + filtered.join('\n');
}

// No statusline nudge here: the installer wires the statusline at install
// time and /flint-doctor --fix-statusline covers the rest. Injecting setup
// prose into every fresh session cost ~90 tokens for zero behavior.
const output = config.injection.sessionStart === 'full'
  ? readFullSkill(modeLabel)
  : readMicroRules(modeLabel);

process.stdout.write(output);
