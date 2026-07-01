import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformBatch, transformResponse } = require('../../src/mcp-servers/flint-shrink/transform.js');

test('JSON-RPC batch responses are each compressed (was passthrough)', () => {
  const batch = [
    { jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'a', description: 'Please note that this tool will basically just do the thing.' }] } },
    { jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'b', description: 'This is really a very simple tool, of course.' }] } },
  ];
  const out = transformBatch(batch, () => 'tools/list', { cache: false });
  assert.equal(out.length, 2);
  assert.ok(out[0].result.tools[0].description.length < batch[0].result.tools[0].description.length);
  assert.ok(out[1].result.tools[0].description.length < batch[1].result.tools[0].description.length);
  assert.equal(out[0].result.tools[0].name, 'a'); // identity preserved
});

const CALL = {
  jsonrpc: '2.0', id: 3,
  result: {
    content: [
      { type: 'text', text: 'Sure, the file basically contains the value `x=1` at https://e.com/p.' },
      { type: 'image', data: 'AAAA' },
    ],
    isError: false,
  },
};

test('tools/call result compression is OFF by default', () => {
  const out = transformResponse(JSON.parse(JSON.stringify(CALL)), 'tools/call', {});
  assert.deepEqual(out, CALL);
});

test('tools/call result compression (opt-in) shrinks text, preserves code/URL/non-text blocks', () => {
  const out = transformResponse(JSON.parse(JSON.stringify(CALL)), 'tools/call', { compressToolResults: true });
  assert.ok(out.result.content[0].text.length < CALL.result.content[0].text.length);
  assert.match(out.result.content[0].text, /`x=1`/);          // inline code byte-preserved
  assert.match(out.result.content[0].text, /https:\/\/e\.com\/p/); // URL byte-preserved
  assert.deepEqual(out.result.content[1], CALL.result.content[1]); // image block untouched
  assert.equal(out.result.isError, false);
});
