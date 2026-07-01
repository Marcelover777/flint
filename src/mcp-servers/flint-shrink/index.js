#!/usr/bin/env node
// flint-shrink - MCP stdio proxy that compresses safe list descriptions.

const { spawn } = require('child_process');
const { JsonRpcFramer } = require('./framing');
const { transformResponse, transformBatch } = require('./transform');
const { loadCache, saveCache } = require('./cache');

const args = process.argv.slice(2);
if (args.length === 0) {
  process.stderr.write('flint-shrink: missing upstream command.\n');
  process.stderr.write('Usage: flint-shrink <upstream-command> [...args]\n');
  process.exit(2);
}

const debug = process.env.FLINT_SHRINK_DEBUG === '1';
const fields = (process.env.FLINT_SHRINK_FIELDS || 'description')
  .split(',').map(s => s.trim()).filter(Boolean);
const opts = {
  debug,
  fields,
  cache: process.env.FLINT_SHRINK_CACHE !== '0',
  compressNestedSchemas: process.env.FLINT_SHRINK_NESTED_SCHEMA === '1',
  compressToolResults: process.env.FLINT_SHRINK_TOOL_RESULTS === '1',
  preserveInputSchema: true,
  mode: process.env.FLINT_SHRINK_MODE || 'full',
  serverId: args.join(' '),
};

const upstream = spawn(args[0], args.slice(1), {
  stdio: ['pipe', 'pipe', 'inherit'],
});

upstream.on('error', err => {
  process.stderr.write(`flint-shrink: failed to spawn upstream: ${err.message}\n`);
  process.exit(1);
});

upstream.on('exit', (code, signal) => {
  if (signal) process.exit(128 + (signal === 'SIGTERM' ? 15 : 9));
  process.exit(code || 0);
});

const clientFramer = new JsonRpcFramer({ mode: process.env.FLINT_SHRINK_FRAMING || 'auto' });
const serverFramer = new JsonRpcFramer({ mode: process.env.FLINT_SHRINK_FRAMING || 'auto' });
const pending = new Map();
// Load the shrink cache once for the proxy lifetime; flush on exit instead of
// reading+writing the whole file on every MCP response.
opts.cacheObject = opts.cache ? loadCache() : { entries: {} };
function flushCache() { try { if (opts.cache) saveCache(opts.cacheObject); } catch (_) {} }
process.on('exit', flushCache);

process.stdin.on('data', chunk => {
  // Forward request bytes unchanged. We parse a side copy only to map id->method.
  upstream.stdin.write(chunk);
  for (const frame of clientFramer.push(chunk)) {
    const msgs = Array.isArray(frame.message) ? frame.message : [frame.message];
    for (const msg of msgs) {
      if (msg && msg.id != null && msg.method) pending.set(String(msg.id), msg.method);
    }
  }
});
process.stdin.on('end', () => upstream.stdin.end());

upstream.stdout.on('data', chunk => {
  const frames = serverFramer.push(chunk);
  if (frames.length === 0) return;
  for (const frame of frames) {
    if (!frame.message) {
      process.stdout.write(frame.raw);
      continue;
    }
    const methodFor = (el) => {
      const eid = el && el.id != null ? String(el.id) : null;
      const m = eid ? pending.get(eid) : null;
      if (eid) pending.delete(eid);
      return m;
    };
    const out = transformBatch(frame.message, methodFor, opts);
    process.stdout.write(serverFramer.encode(out, frame.mode));
  }
});
