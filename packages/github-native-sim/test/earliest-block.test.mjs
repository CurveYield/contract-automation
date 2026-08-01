import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { startForkRpcProxy } from '../src/fork-rpc-proxy.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('normalizes eth_getBlockByNumber earliest to canonical block zero upstream', async () => {
  const blockTags = [];
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (payload.method === 'eth_getBlockByNumber') blockTags.push(payload.params[0]);
    const result = payload.method === 'eth_getBlockByNumber'
      ? { number: payload.params[0], transactions: [] }
      : '0x1';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });

  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({ upstreamUrl, block: 123, retryDelaysMs: [0] });
    const response = await fetch(proxy.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'eth_getBlockByNumber',
        params: ['earliest', false]
      })
    });
    const decoded = await response.json();

    assert.deepEqual(decoded, {
      jsonrpc: '2.0',
      id: 9,
      result: { number: '0x0', transactions: [] }
    });
    assert.deepEqual(blockTags, ['0x7b', '0x0']);
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});
