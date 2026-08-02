import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { startLiveForkProxy } from '../src/live-fork-proxy.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function rpc(url, id, method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  return response.json();
}

function upstream(label, seen) {
  return http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    seen.push({ label, method: payload.method, params: payload.params });
    let result;
    if (payload.method === 'eth_blockNumber') result = '0x7b';
    else if (payload.method === 'eth_chainId') result = '0x1';
    else if (payload.method === 'eth_getBlockByNumber') {
      result = { number: '0x7b', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x64', transactions: [] };
    } else if (payload.method === 'debug_traceCall') result = { gas: '0x5208', returnValue: '' };
    else result = '0x6000';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });
}

test('resolves latest once, pins the block, and routes requests by capability', async () => {
  const seen = [];
  const primaryServer = upstream('primary', seen);
  const secondaryServer = upstream('secondary', seen);
  const primaryUrl = await listen(primaryServer);
  const secondaryUrl = await listen(secondaryServer);
  let proxy;
  try {
    proxy = await startLiveForkProxy({
      slots: [
        { id: 'primary-01', pool: 'primary', url: primaryUrl },
        { id: 'secondary-01', pool: 'secondary', url: secondaryUrl }
      ],
      chainId: 1,
      blockPolicy: { mode: 'latest-at-start' },
      routing: { retryDelaysMs: [0] }
    });

    assert.equal(proxy.blockNumber, 123);
    assert.equal(proxy.blockHash, `0x${'ab'.repeat(32)}`);
    const code = await rpc(proxy.url, 10, 'eth_getCode', ['0x0000000000000000000000000000000000000001', 'latest']);
    const trace = await rpc(proxy.url, 11, 'debug_traceCall', [{}, 'latest']);
    assert.equal(code.result, '0x6000');
    assert.deepEqual(trace.result, { gas: '0x5208', returnValue: '' });

    assert.ok(seen.some((entry) => entry.label === 'secondary' && entry.method === 'eth_getCode'));
    assert.ok(seen.some((entry) => entry.label === 'primary' && entry.method === 'debug_traceCall'));
    const forwardedCode = seen.find((entry) => entry.method === 'eth_getCode');
    assert.equal(forwardedCode.params[1], '0x7b', 'latest must be normalized to the pinned block');
    assert.equal(JSON.stringify(proxy.diagnostics).includes(primaryUrl), false);
    assert.equal(JSON.stringify(proxy.diagnostics).includes(secondaryUrl), false);
  } finally {
    await proxy?.close();
    await close(primaryServer);
    await close(secondaryServer);
  }
});

test('terminates the proxy when a batch contains one unsupported external method', async () => {
  const seen = [];
  const server = upstream('secondary', seen);
  const url = await listen(server);
  let proxy;
  try {
    proxy = await startLiveForkProxy({
      slots: [{ id: 'secondary-01', pool: 'secondary', url }],
      chainId: 1,
      blockPolicy: { mode: 'explicit', blockNumber: 123 },
      routing: { retryDelaysMs: [0] }
    });
    const response = await fetch(proxy.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [] },
        { jsonrpc: '2.0', id: 2, method: 'eth_sendTransaction', params: [] }
      ])
    });
    const body = await response.json();
    assert.equal(body[0].error.data.code, 'CALL_NOT_SUPPORTED');
    assert.equal(body[1].error.data.method, 'eth_sendTransaction');
    assert.equal(proxy.diagnostics.terminated, true);
    assert.equal(seen.some((entry) => entry.method === 'eth_getCode'), false);
  } finally {
    await proxy?.close();
    await close(server);
  }
});
