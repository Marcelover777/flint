#!/usr/bin/env node
// flint - UserPromptSubmit hook to track mode and inject adaptive reminders.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { getDefaultMode, safeWriteFlag, readFlag, VALID_MODES, loadConfig } = require('./flint-config');
const { INDEPENDENT_MODES, decideReinforcement } = require('./prompt-policy');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.flint-active');

function runStats(data, tailArgs) {
  const statsPath = path.join(__dirname, 'flint-stats.js');
  const argv = [statsPath];
  if (data.transcript_path) argv.push('--session-file', data.transcript_path);
  for (const flag of ['--share', '--all', '--json']) {
    if (tailArgs.includes(flag)) argv.push(flag);
  }
  const sinceIdx = tailArgs.indexOf('--since');
  if (sinceIdx !== -1 && tailArgs[sinceIdx + 1]) argv.push('--since', tailArgs[sinceIdx + 1]);
  return execFileSync(process.execPath, argv, { encoding: 'utf8', timeout: 5000 });
}

function parseModeCommand(prompt) {
  if (!prompt.startsWith('/flint')) return null;
  const parts = prompt.split(/\s+/);
  const cmd = parts[0];
  const arg = parts[1] || '';
  if (cmd === '/flint-commit') return 'commit';
  if (cmd === '/flint-review') return 'review';
  if (cmd === '/flint-compress' || cmd === '/flint:flint-compress') return 'compress';
  if (cmd === '/flint' || cmd === '/flint:flint') {
    if (!arg) return getDefaultMode();
    if (arg === 'off' || arg === 'stop' || arg === 'disable') return 'off';
    if (arg === 'wenyan-full') return 'wenyan';
    if (VALID_MODES.includes(arg) && !INDEPENDENT_MODES.has(arg)) return arg;
  }
  return null;
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const rawPrompt = (data.prompt || '').trim();
    const prompt = rawPrompt.toLowerCase();
    const config = loadConfig();

    const statsMatch = /^\/flint(?::flint)?-stats(?:\s+(.*))?$/.exec(prompt);
    if (statsMatch) {
      const tailArgs = (statsMatch[1] || '').trim().split(/\s+/).filter(Boolean);
      try {
        const out = runStats(data, tailArgs);
        process.stdout.write(JSON.stringify({ decision: 'block', reason: out.trim() }));
      } catch (_) {
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: 'flint-stats: could not run stats script.\nTry manually: node hooks/flint-stats.js',
        }));
      }
      return;
    }

    if (/\b(activate|enable|turn on|start|talk like)\b.*\bflint\b/i.test(rawPrompt) ||
        /\bflint\b.*\b(mode|activate|enable|turn on|start)\b/i.test(rawPrompt)) {
      if (!/\b(stop|disable|turn off|deactivate)\b/i.test(rawPrompt)) {
        const mode = getDefaultMode();
        if (mode !== 'off') safeWriteFlag(flagPath, mode);
      }
    }

    const mode = parseModeCommand(prompt);
    if (mode && mode !== 'off') {
      safeWriteFlag(flagPath, mode);
    } else if (mode === 'off') {
      try { fs.unlinkSync(flagPath); } catch (_) {}
    }

    if (/\b(stop|disable|deactivate|turn off)\b.*\bflint\b/i.test(rawPrompt) ||
        /\bflint\b.*\b(stop|disable|deactivate|turn off)\b/i.test(rawPrompt) ||
        /\bnormal mode\b/i.test(rawPrompt)) {
      try { fs.unlinkSync(flagPath); } catch (_) {}
    }

    const activeMode = readFlag(flagPath);
    const decision = decideReinforcement({ data, prompt: rawPrompt, activeMode, config, claudeDir });
    if (decision.reinforce) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: decision.additionalContext,
        },
      }));
    }
  } catch (_) {
    // Silent fail.
  }
});
