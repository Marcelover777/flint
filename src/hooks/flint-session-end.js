#!/usr/bin/env node
// flint — SessionEnd hook. Records the finished session into the lifetime
// stats history and refreshes the statusline savings suffix, so the ⚡ badge
// and /flint-stats --all stay current without the user ever running
// /flint-stats manually. Injects nothing into context — zero token cost.

const path = require('path');
const { execFileSync } = require('child_process');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (!data.transcript_path) return;
    execFileSync(process.execPath, [
      path.join(__dirname, 'flint-stats.js'),
      '--session-file', data.transcript_path,
      '--record',
    ], { encoding: 'utf8', timeout: 8000 });
  } catch (_) {
    // Best-effort — never block session shutdown.
  }
});
