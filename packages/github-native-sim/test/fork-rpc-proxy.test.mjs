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

async function rpc(url, id, method, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  return response.json();
}

test('prefetch retries a transient full-block error and serves the cached block to Ganache', async () => {
  let fullBlockAttempts = 0;
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    let body;
    if (payload.method === 'eth_getBlockByNumber' && payload.params[1] === true) {
      fullBlockAttempts += 1;
      body = fullBlockAttempts < 3
        ? { jsonrpc: '2.0', id: payload.id, error: { code: -32000, message: 'Request timeout on the free plan, please upgrade to paid plan' } }
        : { jsonrpc: '2.0', id: payload.id, result: { number: '0x7b', transactions: [{ hash: '0xabc' }] } };
    } else {
      body = { jsonrpc: '2.0', id: payload.id, result: '0x1' };
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  });

  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({
      upstreamUrl,
      block: 123,
      retryDelaysMs: [0, 1, 1]
    });

    assert.equal(fullBlockAttempts, 3);
    const response = await rpc(proxy.url, 99, 'eth_getBlockByNumber', ['0x7b', true]);
    assert.deepEqual(response, {
      jsonrpc: '2.0',
      id: 99,
      result: { number: '0x7b', transactions: [{ hash: '0xabc' }] }
    });
    assert.equal(fullBlockAttempts, 3, 'cached response must avoid another upstream request');
    assert.equal(proxy.diagnostics.prefetchAttempts, 3);
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});

test('proxy forwards ordinary JSON-RPC reads through Node fetch', async () => {
  const seen = [];
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    seen.push(payload.method);
    const result = payload.method === 'eth_getBlockByNumber'
      ? { number: '0x7b', transactions: [] }
      : '0x1234';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });

  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({
      upstreamUrl,
      block: 123,
      retryDelaysMs: [0]
    });
    const response = await rpc(proxy.url, 7, 'eth_getCode', ['0x0000000000000000000000000000000000000001', '0x7b']);
    assert.deepEqual(response, { jsonrpc: '2.0', id: 7, result: '0x1234' });
    assert.ok(seen.includes('eth_getCode'));
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});

test('proxy retries an upstream connection reset during a forwarded fork read', async () => {
  let codeAttempts = 0;
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (payload.method === 'eth_getCode') {
      codeAttempts += 1;
      if (codeAttempts === 1) {
        request.socket.destroy();
        return;
      }
    }
    const result = payload.method === 'eth_getBlockByNumber'
      ? { number: '0x7b', transactions: [] }
      : '0x6000';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });

  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({
      upstreamUrl,
      block: 123,
      retryDelaysMs: [0, 1]
    });
    const response = await rpc(proxy.url, 11, 'eth_getCode', ['0x0000000000000000000000000000000000000001', '0x7b']);
    assert.deepEqual(response, { jsonrpc: '2.0', id: 11, result: '0x6000' });
    assert.equal(codeAttempts, 2);
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});

test('proxy serves deterministic local account state without querying the fork RPC', async () => {
  const localAccount = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
  const seen = [];
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    seen.push(payload.method);
    const result = payload.method === 'eth_getBlockByNumber'
      ? { number: '0x7b', transactions: [] }
      : '0x999';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });

  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({
      upstreamUrl,
      block: 123,
      localAccounts: [localAccount],
      retryDelaysMs: [0]
    });
    const nonce = await rpc(proxy.url, 21, 'eth_getTransactionCount', [localAccount, '0x7b']);
    const code = await rpc(proxy.url, 22, 'eth_getCode', [localAccount, '0x7b']);
    const storage = await rpc(proxy.url, 23, 'eth_getStorageAt', [localAccount, '0x0', '0x7b']);

    assert.deepEqual(nonce, { jsonrpc: '2.0', id: 21, result: '0x0' });
    assert.deepEqual(code, { jsonrpc: '2.0', id: 22, result: '0x' });
    assert.deepEqual(storage, { jsonrpc: '2.0', id: 23, result: `0x${'00'.repeat(32)}` });
    assert.equal(seen.includes('eth_getTransactionCount'), false);
    assert.equal(seen.includes('eth_getCode'), false);
    assert.equal(seen.includes('eth_getStorageAt'), false);
    assert.equal(proxy.diagnostics.localAccountHits, 3);
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});
