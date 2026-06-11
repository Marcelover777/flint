#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getConfigDir, getConfigPath, loadConfig, mergeConfig, normalizeConfig } = require('../hooks/caveman-config');

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  let parsed = value;
  if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (/^\d+(?:\.\d+)?$/.test(value)) parsed = Number(value);
  cur[parts[parts.length - 1]] = parsed;
}

function main() {
  const [cmd, key, value] = process.argv.slice(2);
  if (!cmd || cmd === 'show') {
    process.stdout.write(JSON.stringify(loadConfig(), null, 2) + '\n');
    return;
  }
  if (cmd !== 'set' || !key || value == null) {
    process.stderr.write('Usage: node src/commands/caveman-config.js show|set <path> <value>\n');
    process.exit(2);
  }
  let current = {};
  try { current = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')); } catch (_) {}
  setPath(current, key, value);
  const next = normalizeConfig(mergeConfig(loadConfig(), current));
  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2) + '\n');
  process.stdout.write(JSON.stringify(next, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { setPath };
