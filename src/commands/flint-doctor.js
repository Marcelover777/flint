#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadLocalEnv } = require('../core/env');
const { loadConfig, getConfigDir, readFlag } = require('../hooks/flint-config');
const { pricingForModel } = require('../core/pricing');
const { scanSecrets } = require('../core/secret-scan');

loadLocalEnv({ root: path.resolve(__dirname, '..', '..') });

function checkFile(file) {
  return fs.existsSync(file) ? 'OK' : 'missing';
}

function doctor(opts = {}) {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const hooksDir = path.join(claudeDir, 'hooks');
  const config = loadConfig();
  const checks = {
    node: process.versions.node,
    config_dir: getConfigDir(),
    claude_config: claudeDir,
    hooks: {
      activate: checkFile(path.join(hooksDir, 'flint-activate.js')),
      tracker: checkFile(path.join(hooksDir, 'flint-mode-tracker.js')),
      stats: checkFile(path.join(hooksDir, 'flint-stats.js')),
    },
    mode: readFlag(path.join(claudeDir, '.flint-active')) || 'off',
    injection: `${config.injection.reinforcement}/${config.injection.sessionStart}`,
    statusline: 'unknown',
    pricing: pricingForModel(config.targetModel) ? `${config.targetModel} OK` : `${config.targetModel} unknown`,
    secret_scan: scanSecrets({ content: 'OPENAI_API_KEY=sk-proj-testtesttesttesttesttesttest' }).ok ? 'failed' : 'OK',
    mcp_shrink: checkFile(path.join(__dirname, '..', 'mcp-servers', 'flint-shrink', 'framing.js')),
    token_count_api: process.env.ANTHROPIC_API_KEY ? 'available' : 'no ANTHROPIC_API_KEY',
    warnings: [],
  };

  const settingsPath = path.join(claudeDir, 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    checks.statusline = settings.statusLine ? 'OK' : 'missing';
  } catch (_) {
    checks.statusline = 'missing';
  }
  if (checks.statusline !== 'OK') checks.warnings.push('statusline not configured. Run: /flint-doctor --fix-statusline');

  if (opts.fixStatusline) {
    fs.mkdirSync(claudeDir, { recursive: true });
    // A settings.json that exists but doesn't parse (JSONC comments, trailing
    // comma, corruption) must NEVER be replaced with {} — that would wipe the
    // user's model/permissions/hooks. Refuse and tell them instead.
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (e) {
        checks.warnings.push(`cannot --fix-statusline: ${settingsPath} is not valid JSON (${e.message}) — fix it manually.`);
        checks.fixed_statusline = false;
        return checks;
      }
    }
    const script = process.platform === 'win32'
      ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(hooksDir, 'flint-statusline.ps1')}"`
      : `bash "${path.join(hooksDir, 'flint-statusline.sh')}"`;
    settings.statusLine = { type: 'command', command: script };
    // Atomic write: temp + rename, so a crash mid-write can't truncate settings.
    const tmp = settingsPath + `.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(tmp, settingsPath);
    checks.statusline = 'OK';
    checks.fixed_statusline = true;
  }
  return checks;
}

function format(checks) {
  return `Flint Doctor
--------------
Claude config: ${checks.claude_config}
Hooks: activate=${checks.hooks.activate}, tracker=${checks.hooks.tracker}, stats=${checks.hooks.stats}
Mode: ${checks.mode}
Injection: ${checks.injection}
Stats pricing: ${checks.pricing}
Secret scan: ${checks.secret_scan}
MCP shrink: ${checks.mcp_shrink}
Token count API: ${checks.token_count_api}
Warnings:
${checks.warnings.map(w => `- ${w}`).join('\n') || '- none'}
`;
}

function main() {
  const args = process.argv.slice(2);
  const checks = doctor({ fixStatusline: args.includes('--fix-statusline') });
  process.stdout.write(args.includes('--json') ? JSON.stringify(checks, null, 2) + '\n' : format(checks));
}

if (require.main === module) main();
module.exports = { doctor, format };
