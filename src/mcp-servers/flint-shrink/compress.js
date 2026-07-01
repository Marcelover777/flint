// flint-shrink prose compressor. Uses repo core modules when available and
// keeps a local fallback so the npm subpackage remains standalone.

let core;
try {
  core = require('../../core/deterministic-compress');
} catch (_) {
  core = null;
}

const FILLERS = /\b(?:just|really|basically|actually|simply|quite|very|essentially|literally|generally)\b\s*/gi;
const PLEASANTRIES = /\b(?:please|kindly|thank you|thanks|sure|certainly|of course|happy to|i'?d be happy)\b[,.]?\s*/gi;
const HEDGES = /\b(?:perhaps|maybe|might|could potentially|would like to|i think|in my opinion|it seems|it appears)\b\s*/gi;
const LEADERS = /^(?:i'?ll|i will|i can|i'?d|you can|we will|we can|let me|let'?s)\s+/gim;
const ARTICLES = /\b(?:a|an|the)\s+(?=[a-z])/gi;
const PROTECTED_PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /\bhttps?:\/\/\S+/gi,
  /\b[\w.-]*[\/\\][\w.\/\\-]+/g,
  /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,
  /\b\w+\.\w+(?:\.\w+)*\(\)?/g,
  /[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)/g,
  /\b\d+\.\d+\.\d+\b/g,
];

function fallbackProtected(text, transform) {
  const segments = [];
  let working = text;
  for (const re of PROTECTED_PATTERNS) {
    working = working.replace(re, m => {
      const i = segments.length;
      segments.push(m);
      return `__FLINT_MCP_${i}__`;
    });
  }
  let out = transform(working);
  out = out.replace(/__FLINT_MCP_(\d+)__/g, (_, i) => segments[Number(i)]);
  return out;
}

function fallbackCompress(text, opts = {}) {
  let s = String(text || '');
  s = s.replace(LEADERS, '');
  s = s.replace(PLEASANTRIES, '');
  s = s.replace(HEDGES, '');
  s = s.replace(FILLERS, '');
  if (opts.mode !== 'lite') s = s.replace(ARTICLES, '');
  s = s.replace(/\bin order to\b/gi, 'to');
  s = s.replace(/\bdue to the fact that\b/gi, 'because');
  s = s.replace(/\bat this point in time\b/gi, 'now');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\s+([,.;:!?])/g, '$1');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase());
  return s.trim();
}

function compress(text, opts = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    return { compressed: text, before: 0, after: 0 };
  }
  const before = text.length;
  const compressed = core
    ? core.compressDeterministic(text, { mode: opts.mode || 'full' }).compressed
    : fallbackProtected(text, value => fallbackCompress(value, opts));
  return { compressed, before, after: compressed.length };
}

function compressDescriptionsInPlace(obj, fieldNames, opts = {}) {
  const fields = new Set(fieldNames || ['description']);
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) compressDescriptionsInPlace(item, [...fields], opts);
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (fields.has(key) && typeof val === 'string') {
      obj[key] = compress(val, opts).compressed;
    } else if (val && typeof val === 'object') {
      compressDescriptionsInPlace(val, [...fields], opts);
    }
  }
}

function withProtectedSegments(text, transform) {
  return fallbackProtected(text, transform);
}

module.exports = { compress, compressDescriptionsInPlace, withProtectedSegments };
