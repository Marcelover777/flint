#!/usr/bin/env node
// flint — Claude Code SessionStart activation hook (project-local).
//
// Writes the active-mode flag to the engine state dir and emits the per-mode
// MICRO rule line (default) or the filtered full skill (config
// injection.sessionStart = 'full') as hidden session context. The MICRO path
// costs ~55 tokens per session vs ~700 for the full skill — same behavior
// target, 12x cheaper injection.

const fs = require('fs');
const path = require('path');
const { getDefaultMode, loadConfig, safeWriteFlag, getStateDir } = require('./flint-config');

const flagPath = path.join(getStateDir(), '.flint-active');
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

// Skill source of truth: <project>/.claude/skills/flint/ (single copy — the
// same files Claude Code discovers as the /flint skill).
const SKILL_DIR = path.resolve(__dirname, '..', '..', 'skills', 'flint');

function readFirstExisting(files) {
  for (const file of files) {
    try { return fs.readFileSync(file, 'utf8'); } catch (_) {}
  }
  return '';
}

const MICRO_FALLBACK = {
  lite: 'FLINT lite. Concise pro prose, answer-first. No filler/pleasantries/hedging/recap/next-steps. Final <=8 lines+code. <=1 line between tools. Never re-print code/diffs; cite file:line. No headers/tables unasked. Code/paths/URLs/numbers/errors exact. Clear prose for safety/destructive/ambiguous.',
  full: 'FLINT full. Terse fragments. Answer only what asked; no preamble/recap/summary-close/next-steps. Final <=5 lines+code. <=1 line between tools. Never re-print code/diffs/tool output; cite file:line. No headers/tables unasked. Code/paths/URLs/numbers/errors exact. Clear prose for safety/destructive/ambiguous. Persist until off.',
  ultra: 'FLINT ultra. Telegraphic. Answer only. Arrows for causality. One word when enough. Zero tool narration except blockers. Final <=3 lines+code. Never abbrev/re-print code/API/error/path/URL/number. Clear prose for safety/destructive/ambiguous.',
};

function readMicroRules(label) {
  const content = readFirstExisting([path.join(SKILL_DIR, 'MICRO.md')]);
  if (content) {
    const prefix = 'FLINT ' + label + '.';
    const hit = content.split('\n').map(s => s.trim()).find(line => line.startsWith(prefix));
    if (hit) return hit;
  }
  return MICRO_FALLBACK[label] || MICRO_FALLBACK.full;
}

function readFullSkill(label) {
  const skillContent = readFirstExisting([path.join(SKILL_DIR, 'SKILL.md')]);
  if (!skillContent) {
    return 'FLINT MODE ACTIVE - level: ' + label + '\n\n' + (MICRO_FALLBACK[label] || MICRO_FALLBACK.full);
  }
  // Strip frontmatter, keep only the table rows / example lines for this level.
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

const output = config.injection.sessionStart === 'full'
  ? readFullSkill(mode)
  : readMicroRules(mode);

process.stdout.write(output);
