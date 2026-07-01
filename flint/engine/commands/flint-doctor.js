#!/usr/bin/env node
// flint-doctor — health check for the project-local flint install.
// Verifies hooks, skills, settings wiring, state dir, pricing, and the secret
// scanner. Exits 0 with a report; --json for machine-readable output.
const fs = require('fs');
const path = require('path');
const { loadConfig, getConfigPath, getStateDir, getEngineRoot, readFlag } = require('../hooks/flint-config');
const { pricingForModel } = require('../core/pricing');
const { scanSecrets } = require('../core/secret-scan');

function checkFile(file) {
  return fs.existsSync(file) ? 'OK' : 'missing';
}

function doctor() {
  const engineRoot = getEngineRoot();
  const dotClaude = path.resolve(engineRoot, '..');
  const skillsDir = path.join(dotClaude, 'skills');
  const config = loadConfig();

  const checks = {
    node: process.versions.node,
    engine_root: engineRoot,
    config_file: fs.existsSync(getConfigPath()) ? getConfigPath() : 'defaults (no config.json)',
    state_dir: getStateDir(),
    hooks: {
      activate: checkFile(path.join(engineRoot, 'hooks', 'flint-activate.js')),
      tracker: checkFile(path.join(engineRoot, 'hooks', 'flint-mode-tracker.js')),
      stats: checkFile(path.join(engineRoot, 'hooks', 'flint-stats.js')),
      statusline: checkFile(path.join(engineRoot, 'hooks', 'flint-statusline.ps1')),
    },
    skills: {
      flint: checkFile(path.join(skillsDir, 'flint', 'SKILL.md')),
      micro: checkFile(path.join(skillsDir, 'flint', 'MICRO.md')),
      stats: checkFile(path.join(skillsDir, 'flint-stats', 'SKILL.md')),
      compress: checkFile(path.join(skillsDir, 'flint-compress', 'SKILL.md')),
    },
    settings_wiring: 'unknown',
    mode: readFlag(path.join(getStateDir(), '.flint-active')) || 'off',
    default_mode: config.defaultMode,
    injection: `${config.injection.reinforcement}/${config.injection.sessionStart}`,
    target_model: config.targetModel,
    pricing: pricingForModel(config.targetModel) ? `${config.targetModel} OK` : `${config.targetModel} unknown`,
    savings_ratios: checkFile(path.join(engineRoot, 'data', 'output-savings.json')),
    secret_scan: scanSecrets({ content: 'OPENAI_API_KEY=sk-proj-testtesttesttesttesttesttest' }).ok ? 'failed' : 'OK',
    token_count_api: process.env.ANTHROPIC_API_KEY ? 'available' : 'no ANTHROPIC_API_KEY (offline estimates only)',
    warnings: [],
  };

  // Hooks + statusline are wired through the project settings file.
  const settingsPath = path.join(dotClaude, 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const flat = JSON.stringify(settings);
    const hooksWired = flat.includes('flint-activate.js') && flat.includes('flint-mode-tracker.js');
    const statuslineWired = !!settings.statusLine && flat.includes('flint-statusline');
    checks.settings_wiring = hooksWired ? (statuslineWired ? 'hooks+statusline OK' : 'hooks OK, statusline missing') : 'hooks NOT wired';
  } catch (_) {
    checks.settings_wiring = 'no .claude/settings.json';
  }
  if (checks.settings_wiring.includes('NOT') || checks.settings_wiring.includes('no .claude')) {
    checks.warnings.push('SessionStart/UserPromptSubmit hooks are not wired in .claude/settings.json — flint will not auto-activate.');
  }
  for (const [name, state] of Object.entries(checks.skills)) {
    if (state !== 'OK') checks.warnings.push(`skill file missing: ${name}`);
  }
  return checks;
}

function format(checks) {
  return `Flint Doctor
------------
Engine:  ${checks.engine_root}
Config:  ${checks.config_file}
State:   ${checks.state_dir}
Hooks: activate=${checks.hooks.activate}, tracker=${checks.hooks.tracker}, stats=${checks.hooks.stats}, statusline=${checks.hooks.statusline}
Skills: flint=${checks.skills.flint}, micro=${checks.skills.micro}, stats=${checks.skills.stats}, compress=${checks.skills.compress}
Settings wiring: ${checks.settings_wiring}
Mode: ${checks.mode} (default: ${checks.default_mode})
Injection: ${checks.injection}
Target model: ${checks.target_model} — pricing ${checks.pricing.endsWith('OK') ? 'OK' : 'UNKNOWN'}
Savings ratios: ${checks.savings_ratios}
Secret scan: ${checks.secret_scan}
Token count API: ${checks.token_count_api}
Warnings:
${checks.warnings.map(w => `- ${w}`).join('\n') || '- none'}
`;
}

function main() {
  const args = process.argv.slice(2);
  const checks = doctor();
  process.stdout.write(args.includes('--json') ? JSON.stringify(checks, null, 2) + '\n' : format(checks));
}

if (require.main === module) main();
module.exports = { doctor, format };
