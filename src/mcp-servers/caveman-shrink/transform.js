const { compress } = require('./compress');
const { loadCache, saveCache, makeCacheKey } = require('./cache');

const METHOD_ARRAYS = {
  'tools/list': 'tools',
  'prompts/list': 'prompts',
  'resources/list': 'resources',
  'resources/templates/list': 'resourceTemplates',
};

function shouldShrink(method) {
  return Object.prototype.hasOwnProperty.call(METHOD_ARRAYS, method);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateTransform(before, after, opts = {}) {
  if (!before || !after || !before.result || !after.result) return false;
  if (!deepEqual(Object.keys(before).sort(), Object.keys(after).sort())) return false;
  const beforeResult = before.result;
  const afterResult = after.result;
  if (!deepEqual(Object.keys(beforeResult).sort(), Object.keys(afterResult).sort())) return false;
  for (const [key, value] of Object.entries(beforeResult)) {
    if (Array.isArray(value)) {
      if (!Array.isArray(afterResult[key]) || value.length !== afterResult[key].length) return false;
      for (let i = 0; i < value.length; i++) {
        if (value[i] && afterResult[key] && value[i].name !== afterResult[key][i].name) return false;
        if (opts.preserveInputSchema !== false && !deepEqual(value[i].inputSchema, afterResult[key][i].inputSchema)) return false;
      }
    }
  }
  return true;
}

function transformListItems(items, { fields, method, cache, cacheEnabled, debug, mode, serverId }) {
  if (!Array.isArray(items)) return 0;
  let changed = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    for (const field of fields) {
      if (typeof item[field] !== 'string') continue;
      const before = item[field];
      const key = makeCacheKey({ serverId, method, name: item.name || item.uri || '', field, before, version: 1, mode });
      const cached = cacheEnabled ? cache.entries[key] : null;
      const after = cached ? cached.compressed : compress(before, { mode }).compressed;
      if (cacheEnabled && !cached) {
        cache.entries[key] = { original_hash: key, compressed: after, before: before.length, after: after.length, created_at: new Date().toISOString() };
      }
      if (after !== before) {
        item[field] = after;
        changed++;
        if (debug) process.stderr.write(`[caveman-shrink] ${method}.${item.name || '?'} ${field}: ${before.length}->${after.length}\n`);
      }
    }
  }
  return changed;
}

// Opt-in: compress prose in tools/call RESULT text blocks. Default OFF because
// tool results are model-visible data. Only `type: 'text'` blocks are touched;
// the local compressor still byte-protects code/URLs/paths/numbers/identifiers.
// A structural validator guarantees block count, order, types, non-text blocks,
// and the isError flag are all unchanged — only the text shrinks.
function validateToolResult(before, after) {
  if (!before || !after || !before.result || !after.result) return false;
  if (!deepEqual(Object.keys(before).sort(), Object.keys(after).sort())) return false;
  if (!deepEqual(Object.keys(before.result).sort(), Object.keys(after.result).sort())) return false;
  if (before.result.isError !== after.result.isError) return false;
  const b = before.result.content, a = after.result.content;
  if (!Array.isArray(b) || !Array.isArray(a) || b.length !== a.length) return false;
  for (let i = 0; i < b.length; i++) {
    const bi = b[i] || {}, ai = a[i] || {};
    if (bi.type !== ai.type) return false;
    if (bi.type !== 'text' && !deepEqual(bi, ai)) return false; // non-text untouched
  }
  return true;
}

function transformToolResult(message, opts = {}) {
  if (!message || !message.result || !Array.isArray(message.result.content)) return message;
  const before = clone(message);
  const after = clone(message);
  let changed = 0;
  for (const block of after.result.content) {
    if (block && block.type === 'text' && typeof block.text === 'string') {
      const c = compress(block.text, { mode: opts.mode || 'full' }).compressed;
      if (c !== block.text) { block.text = c; changed++; }
    }
  }
  if (changed > 0 && !validateToolResult(before, after)) {
    if (opts.debug) process.stderr.write('[caveman-shrink] tools/call result validation failed; passing original\n');
    return message;
  }
  return after;
}

function transformResponse(message, method, opts = {}) {
  if (!message || typeof message !== 'object') return message;
  // Opt-in tools/call result compression (largest token sink; default off).
  if (method === 'tools/call' && opts.compressToolResults === true) {
    return transformToolResult(message, opts);
  }
  if (!shouldShrink(method) || !message.result || typeof message.result !== 'object') return message;
  const before = clone(message);
  const after = clone(message);
  const fields = opts.fields || ['description'];
  const arrayName = METHOD_ARRAYS[method];
  const cacheEnabled = opts.cache !== false;
  const cache = opts.cacheObject || (cacheEnabled ? loadCache(opts.cachePath) : { entries: {} });
  const changed = transformListItems(after.result[arrayName], {
    fields,
    method,
    cache,
    cacheEnabled,
    debug: opts.debug,
    mode: opts.mode || 'full',
    serverId: opts.serverId || 'default',
  });

  if (opts.compressNestedSchemas === true) {
    // Deliberately opt-in. Top-level descriptions are safe default.
    transformListItems([after.result], { fields, method, cache, cacheEnabled, debug: opts.debug, mode: opts.mode || 'full', serverId: opts.serverId || 'default' });
  }

  if (changed > 0 && !validateTransform(before, after, { preserveInputSchema: opts.preserveInputSchema !== false })) {
    if (opts.debug) process.stderr.write(`[caveman-shrink] validation failed for ${method}; passing original\n`);
    return message;
  }
  // Persist only when not using a caller-held in-memory cache (index.js flushes
  // the shared object once on exit instead of per-message).
  if (cacheEnabled && changed > 0 && !opts.cacheObject) saveCache(cache, opts.cachePath);
  return after;
}

// Handle a JSON-RPC batch (array of messages). `methodFor(el)` resolves the
// request method for each element by its id. A non-array message is passed to
// transformResponse directly. Previously a batch passed through uncompressed.
function transformBatch(message, methodFor, opts = {}) {
  if (Array.isArray(message)) {
    return message.map(el => transformResponse(el, methodFor(el), opts));
  }
  return transformResponse(message, methodFor(message), opts);
}

module.exports = {
  METHOD_ARRAYS,
  shouldShrink,
  transformResponse,
  transformBatch,
  transformToolResult,
  validateTransform,
  validateToolResult,
  deepEqual,
};
