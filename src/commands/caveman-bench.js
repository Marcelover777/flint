#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { estimateTokensFromText } = require('../core/token-count');

const ROOT = path.resolve(__dirname, '..', '..');

function loadSnapshots() {
  const file = path.join(ROOT, 'evals', 'snapshots', 'results.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function offlineReport() {
  const snapshots = loadSnapshots();
  const promptsDir = path.join(ROOT, 'evals', 'prompts');
  const promptFiles = fs.existsSync(promptsDir) ? fs.readdirSync(promptsDir).filter(f => f.endsWith('.txt')) : [];
  const promptTokens = promptFiles.map(file => {
    const text = fs.readFileSync(path.join(promptsDir, file), 'utf8');
    return { file, approx_tokens: estimateTokensFromText(text), chars: text.length };
  });
  return {
    schema_version: 1,
    mode: 'offline',
    snapshots_present: !!snapshots,
    arms: ['baseline', 'terse', 'caveman-current-full', 'fable-micro-full', 'fable-adaptive-full', 'fable-lite', 'fable-ultra', 'local-compress-only', 'hybrid-compress'],
    prompts: promptTokens,
    recommendation: 'Use fable-micro-full as default until online evals prove hybrid/adaptive quality >=4.',
  };
}

function writeReport(report) {
  const dir = path.join(ROOT, 'evals', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(dir, `fable5-${date}.json`);
  const mdPath = path.join(dir, `fable5-${date}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(mdPath, `# Fable 5 Caveman Eval\n\nMode: ${report.mode}\n\nArms: ${report.arms.join(', ')}\n\nRecommendation: ${report.recommendation}\n`);
  return { jsonPath, mdPath };
}

function main() {
  const args = process.argv.slice(2);
  const report = offlineReport();
  if (args.includes('--report')) report.report_files = writeReport(report);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { offlineReport, writeReport };
