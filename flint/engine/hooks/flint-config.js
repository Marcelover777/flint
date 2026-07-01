#!/usr/bin/env node
// flint — shared configuration resolver (standalone, project-local).
//
// The whole install lives inside the project: engine at <project>/.claude/flint,
// config at <engine>/config.json, runtime state at <engine>/state. Nothing is
// read from or written to ~/.claude, XDG dirs, or APPDATA — flint is fully
// detached from the upstream caveman install layout.
//
// Resolution order for default mode:
//   1. FLINT_DEFAULT_MODE environment variable
//   2. <engine>/config.json defaultMode field
//   3. 'full'

const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_MODES = [
  'off', 'lite', 'full', 'ultra',
  'commit', 'review', 'compress'
];

const DEFAULT_CONFIG = {
  schema_version: 1,
  defaultMode: 'full',
  // Fable 5 (claude-fable-5) is Anthropic's current Mythos-class model and the
  // model this install optimizes for. At $10/$50 per MTok its output is 2x the
  // price of Opus 4.8 — every output token flint cuts is worth double here.
  // Override with FLINT_TARGET_MODEL or config.
  targetModel: 'claude-fable-5',
  injection: {
    strategy: 'adaptive',
    sessionStart: 'micro',
    reinforcement: 'adaptive',
    reinforceFirstNTurns: 2,
    reinforceEveryNTurns: 6,
    afterLongOutputTokens: 2500,
  },
  compression: {
    defaultStrategy: 'hybrid',
    strict: true,
    localFirst: true,
    llmEnabled: false,
    // Compression backend is a one-time, amortized cost on docs you reuse
    // forever, so default to a capable-but-cheap model rather than the pricey
    // session model. Sonnet 4.6 preserves quality and the validator/fallback
    // catches any miss.
    llmModel: 'claude-sonnet-4-6',
    minLocalSavingsToSkipLLM: 0.35,
    cache: true,
    sourceSplit: true,
  },
  security: {
    secretScan: true,
    entropyScan: true,
    abortOnSecret: true,
    allowLLMForSensitiveFiles: false,
  },
  stats: {
    useTokenCountApi: true,
    fallbackTokenizer: 'chars_approx',
    historySchema: 2,
  },
};

// Engine root = the .claude/flint directory this file lives under.
function getEngineRoot() {
  return path.resolve(__dirname, '..');
}

function getConfigDir() {
  return process.env.FLINT_CONFIG_DIR || getEngineRoot();
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

// Runtime state (mode flag, prompt state, stats history, statusline suffix).
// Lives inside the engine so the install is self-contained and per-project.
function getStateDir() {
  return process.env.FLINT_STATE_DIR || path.join(getEngineRoot(), 'state');
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!isPlainObject(override)) return out;
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeConfig(out[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeMode(mode, fallback = 'full') {
  if (!mode) return fallback;
  const raw = String(mode).toLowerCase();
  return VALID_MODES.includes(raw) ? raw : fallback;
}

function normalizeConfig(config) {
  const out = mergeConfig(DEFAULT_CONFIG, config || {});
  out.defaultMode = normalizeMode(out.defaultMode, 'full');
  if (!out.targetModel || typeof out.targetModel !== 'string') out.targetModel = DEFAULT_CONFIG.targetModel;
  if (!['micro', 'full'].includes(out.injection.sessionStart)) out.injection.sessionStart = DEFAULT_CONFIG.injection.sessionStart;
  if (!['adaptive', 'always', 'off'].includes(out.injection.reinforcement)) out.injection.reinforcement = DEFAULT_CONFIG.injection.reinforcement;
  for (const key of ['reinforceFirstNTurns', 'reinforceEveryNTurns', 'afterLongOutputTokens']) {
    if (!Number.isFinite(Number(out.injection[key])) || Number(out.injection[key]) < 0) {
      out.injection[key] = DEFAULT_CONFIG.injection[key];
    } else {
      out.injection[key] = Number(out.injection[key]);
    }
  }
  return out;
}

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
  } catch (_) {
    return {};
  }
}

function envConfig() {
  const out = {};
  if (process.env.FLINT_DEFAULT_MODE) out.defaultMode = process.env.FLINT_DEFAULT_MODE;
  if (process.env.FLINT_TARGET_MODEL) out.targetModel = process.env.FLINT_TARGET_MODEL;
  if (process.env.FLINT_INJECTION_SESSION_START) {
    out.injection = { ...(out.injection || {}), sessionStart: process.env.FLINT_INJECTION_SESSION_START };
  }
  if (process.env.FLINT_REINFORCEMENT) {
    out.injection = { ...(out.injection || {}), reinforcement: process.env.FLINT_REINFORCEMENT };
  }
  if (process.env.FLINT_COMPRESSION_LLM_ENABLED) {
    out.compression = {
      ...(out.compression || {}),
      llmEnabled: ['1', 'true', 'yes'].includes(process.env.FLINT_COMPRESSION_LLM_ENABLED.toLowerCase()),
    };
  }
  return out;
}

function loadConfig() {
  return normalizeConfig(mergeConfig(mergeConfig(DEFAULT_CONFIG, readConfigFile()), envConfig()));
}

function getTargetModel() {
  return loadConfig().targetModel;
}

function getInjectionConfig() {
  return loadConfig().injection;
}

function getCompressionConfig() {
  return loadConfig().compression;
}

function getStatsConfig() {
  return loadConfig().stats;
}

function getDefaultMode() {
  // 1. Environment variable (highest priority)
  const envMode = process.env.FLINT_DEFAULT_MODE;
  if (envMode && VALID_MODES.includes(envMode.toLowerCase())) {
    return envMode.toLowerCase();
  }

  // 2. Config file
  try {
    const configPath = getConfigPath();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.defaultMode) {
      return normalizeMode(config.defaultMode, 'full');
    }
  } catch (e) {
    // Config file doesn't exist or is invalid — fall through
  }

  // 3. Default
  return 'full';
}

// Symlink-safe flag file write.
// Uses O_NOFOLLOW where available, writes atomically via temp + rename with
// 0600 permissions. Protects against local attackers replacing the predictable
// flag path (~/.claude/.flint-active) with a symlink to clobber other files.
//
// When the parent directory is itself a symlink (legitimate pattern: ~/.claude
// symlinked to another drive or shared config dir), resolves through to the
// real path and verifies ownership on Unix (uid match). This allows e.g.
//   ln -s /opt/shared-claude-config ~/.claude
// while still refusing attacker-planted symlinks pointing to dirs owned by
// another user.
//
// On Windows, uid checks are unavailable — falls back to verifying the resolved
// path lives under the user's home directory.
//
// The flag file itself must never be a symlink (that's the actual clobber vector).
// Note: the state dir here lives under the project (.claude/flint/state), which
// sits under the user's home on this machine, so the Windows home-dir check holds.
//
// Set FLINT_DEBUG=1 to emit stderr diagnostics when flag writes are refused.
//
// Silent-fails on any filesystem error — the flag is best-effort.
function safeWriteFlag(flagPath, content) {
  const debug = process.env.FLINT_DEBUG === '1';
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    // When the parent directory is a symlink, resolve it and verify ownership.
    // This allows legitimate symlinked ~/.claude dirs while still refusing
    // attacker-planted symlinks pointing at dirs owned by another user.
    let realFlagDir;
    try {
      const lstat = fs.lstatSync(flagDir);
      if (lstat.isSymbolicLink()) {
        realFlagDir = fs.realpathSync(flagDir);
        const realStat = fs.statSync(realFlagDir);
        if (!realStat.isDirectory()) {
          if (debug) process.stderr.write(`[flint] safeWriteFlag: symlink target ${realFlagDir} is not a directory\n`);
          return;
        }
        if (typeof process.getuid === 'function') {
          if (realStat.uid !== process.getuid()) {
            if (debug) process.stderr.write(`[flint] safeWriteFlag: symlink target ${realFlagDir} owned by uid ${realStat.uid}, not current user ${process.getuid()}\n`);
            return;
          }
        } else {
          const home = os.homedir();
          const normalizedReal = path.resolve(realFlagDir);
          const normalizedHome = path.resolve(home);
          if (!normalizedReal.toLowerCase().startsWith(normalizedHome.toLowerCase() + path.sep) &&
              normalizedReal.toLowerCase() !== normalizedHome.toLowerCase()) {
            if (debug) process.stderr.write(`[flint] safeWriteFlag: symlink target ${normalizedReal} is outside home directory ${normalizedHome}\n`);
            return;
          }
        }
      } else {
        realFlagDir = flagDir;
      }
    } catch (e) {
      return;
    }

    // The flag file itself must never be a symlink (that's the actual clobber vector).
    const realFlagPath = path.join(realFlagDir, path.basename(flagPath));
    try {
      if (fs.lstatSync(realFlagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const tempPath = path.join(realFlagDir, `.flint-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) { /* best-effort on Windows */ }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, realFlagPath);
  } catch (e) {
    // Silent fail — flag is best-effort
  }
}

// Symlink-safe, size-capped, whitelist-validated flag file read.
// Symmetric with safeWriteFlag: refuses symlinks at the target, caps the read,
// and rejects anything that isn't a known mode. Returns null on any anomaly.
//
// Without this, a local attacker with write access to ~/.claude/ could replace
// the flag with a symlink to ~/.ssh/id_rsa (or any user-readable secret). Every
// reader — statusline, per-turn reinforcement — would slurp that content and
// either echo it to the terminal or inject it into model context.
//
// MAX_FLAG_BYTES is a hard cap. The longest legitimate value is "compress"
// (8 bytes); 64 leaves slack without enabling exfil.
const MAX_FLAG_BYTES = 64;

function readFlag(flagPath) {
  try {
    let st;
    try {
      st = fs.lstatSync(flagPath);
    } catch (e) {
      return null;
    }
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_RDONLY | O_NOFOLLOW;
    let fd;
    let out;
    try {
      fd = fs.openSync(flagPath, flags);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }

    const raw = out.trim().toLowerCase();
    if (!VALID_MODES.includes(raw)) return null;
    return raw;
  } catch (e) {
    return null;
  }
}

// Symlink-safe append. Same parent-dir + symlink-target rules as safeWriteFlag,
// but opens with O_APPEND so concurrent writers from different sessions don't
// clobber each other. Used for the lifetime stats log
// ($CLAUDE_CONFIG_DIR/.flint-history.jsonl).
//
// Silent-fails on any filesystem error.
function appendFlag(filePath, line) {
  const debug = process.env.FLINT_DEBUG === '1';
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    let realDir;
    try {
      const lstat = fs.lstatSync(dir);
      if (lstat.isSymbolicLink()) {
        realDir = fs.realpathSync(dir);
        const realStat = fs.statSync(realDir);
        if (!realStat.isDirectory()) return;
        if (typeof process.getuid === 'function') {
          if (realStat.uid !== process.getuid()) {
            if (debug) process.stderr.write(`[flint] appendFlag: symlink target ${realDir} owned by uid ${realStat.uid}\n`);
            return;
          }
        } else {
          const home = os.homedir();
          const normalized = path.resolve(realDir).toLowerCase();
          const normalizedHome = path.resolve(home).toLowerCase();
          if (!normalized.startsWith(normalizedHome + path.sep) && normalized !== normalizedHome) return;
        }
      } else {
        realDir = dir;
      }
    } catch (e) {
      return;
    }

    const realPath = path.join(realDir, path.basename(filePath));
    try {
      if (fs.lstatSync(realPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(realPath, flags, 0o600);
      fs.writeSync(fd, String(line).replace(/\n$/, '') + '\n');
      try { fs.fchmodSync(fd, 0o600); } catch (e) { /* best-effort on Windows */ }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  } catch (e) {
    // Silent fail — history is best-effort
  }
}

// Symlink-safe history read. Returns lines (untrimmed) or empty array on any
// anomaly. Caller is responsible for parsing JSON. Does NOT enforce a size cap
// the way readFlag does — history is expected to grow with use.
function readHistory(filePath) {
  try {
    const st = fs.lstatSync(filePath);
    if (st.isSymbolicLink() || !st.isFile()) return [];
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_RDONLY | O_NOFOLLOW;
    let fd;
    let raw;
    try {
      fd = fs.openSync(filePath, flags);
      raw = fs.readFileSync(fd, 'utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    return raw.split('\n').filter(line => line.trim());
  } catch (e) {
    return [];
  }
}

module.exports = {
  DEFAULT_CONFIG,
  getDefaultMode,
  getEngineRoot,
  getStateDir,
  getConfigDir,
  getConfigPath,
  loadConfig,
  mergeConfig,
  normalizeConfig,
  normalizeMode,
  getTargetModel,
  getInjectionConfig,
  getCompressionConfig,
  getStatsConfig,
  VALID_MODES,
  safeWriteFlag,
  readFlag,
  appendFlag,
  readHistory,
};
