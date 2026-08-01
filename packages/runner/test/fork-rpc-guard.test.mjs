import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { startForkRpcGuard } from '../src/fork-rpc-guard.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { status: response.status, body: await response.json() };
}

async function terminationWithin(termination, milliseconds = 1_000) {
  return Promise.race([
    termination,
    new Promise((_, reject) => setTimeout(() => reject(new Error('termination did not fire')), milliseconds))
  ]);
}

test('Cloudflare fork guard forwards an allowed request unchanged', async () => {
  const seen = [];
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    seen.push(payload);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: '0x6000' }));
  });
  const upstreamUrl = await listen(upstream);
  let guard;
  try {
    guard = await startForkRpcGuard({ upstreamUrl });
    const request = { jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: ['0x0000000000000000000000000000000000000001', 'latest'] };
    const response = await postJson(guard.url, request);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { jsonrpc: '2.0', id: 1, result: '0x6000' });
    assert.deepEqual(seen, [request]);
    assert.equal(guard.diagnostics.forwardedRequests, 1);
    assert.equal(guard.diagnostics.terminated, false);
  } finally {
    await guard?.close();
    await close(upstream);
  }
});

test('Cloudflare fork guard rejects an unsupported call without touching upstream and terminates', async () => {
  let upstreamCalls = 0;
  const upstream = http.createServer((_request, response) => {
    upstreamCalls += 1;
    response.writeHead(500);
    response.end();
  });
  const upstreamUrl = await listen(upstream);
  let guard;
  try {
    guard = await startForkRpcGuard({ upstreamUrl });
    const response = await postJson(guard.url, { jsonrpc: '2.0', id: 2, method: 'eth_sendTransaction', params: [] });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      jsonrpc: '2.0', id: 2,
      error: {
        code: -32601,
        message: 'Call not supported: eth_sendTransaction',
        data: { code: 'CALL_NOT_SUPPORTED', method: 'eth_sendTransaction', simulationTerminated: true }
      }
    });
    const error = await terminationWithin(guard.termination);
    assert.equal(error.code, 'CALL_NOT_SUPPORTED');
    assert.equal(error.method, 'eth_sendTransaction');
    assert.equal(upstreamCalls, 0);
    assert.equal(guard.diagnostics.forwardedRequests, 0);
    assert.equal(guard.diagnostics.terminated, true);
  } finally {
    await guard?.close();
    await close(upstream);
  }
});

test('Cloudflare fork guard rejects a complete mixed batch before forwarding any entry', async () => {
  let upstreamCalls = 0;
  const upstream = http.createServer((_request, response) => {
    upstreamCalls += 1;
    response.writeHead(500);
    response.end();
  });
  const upstreamUrl = await listen(upstream);
  let guard;
  try {
    guard = await startForkRpcGuard({ upstreamUrl });
    const response = await postJson(guard.url, [
      { jsonrpc: '2.0', id: 10, method: 'eth_getBalance', params: [] },
      { jsonrpc: '2.0', id: 11, method: 'personal_unlockAccount', params: [] },
      { jsonrpc: '2.0', id: 12, method: 'eth_getCode', params: [] }
    ]);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.map((entry) => entry.id), [10, 11, 12]);
    for (const entry of response.body) {
      assert.equal(entry.error.code, -32601);
      assert.equal(entry.error.data.code, 'CALL_NOT_SUPPORTED');
      assert.equal(entry.error.data.method, 'personal_unlockAccount');
      assert.equal(entry.error.data.simulationTerminated, true);
    }
    const error = await terminationWithin(guard.termination);
    assert.equal(error.method, 'personal_unlockAccount');
    assert.equal(upstreamCalls, 0);
    assert.equal(guard.diagnostics.forwardedRequests, 0);
  } finally {
    await guard?.close();
    await close(upstream);
  }
});
