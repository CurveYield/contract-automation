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

function createUpstream(seen) {
  return http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    seen.push(payload);
    const result = payload.method === 'eth_getBlockByNumber'
      ? { number: '0x7b', transactions: [] }
      : '0x1';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });
}

test('GitHub-native proxy rejects an unsupported call before local, cache, retry, or upstream handling', async () => {
  const seen = [];
  const upstream = createUpstream(seen);
  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({ upstreamUrl, block: 123, chainId: 1, retryDelaysMs: [0] });
    assert.equal(seen.length, 1, 'only the pinned-block prefetch should have reached upstream');
    const response = await postJson(proxy.url, { jsonrpc: '2.0', id: 30, method: 'eth_sendTransaction', params: [] });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      jsonrpc: '2.0', id: 30,
      error: {
        code: -32601,
        message: 'Call not supported: eth_sendTransaction',
        data: { code: 'CALL_NOT_SUPPORTED', method: 'eth_sendTransaction', simulationTerminated: true }
      }
    });
    const error = await terminationWithin(proxy.termination);
    assert.equal(error.code, 'CALL_NOT_SUPPORTED');
    assert.equal(error.method, 'eth_sendTransaction');
    assert.equal(seen.length, 1);
    assert.equal(proxy.diagnostics.forwardedRequests, 0);
    assert.equal(proxy.diagnostics.terminated, true);
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});

test('GitHub-native proxy rejects a mixed batch atomically and errors every request ID', async () => {
  const seen = [];
  const upstream = createUpstream(seen);
  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({ upstreamUrl, block: 123, chainId: 1, retryDelaysMs: [0] });
    assert.equal(seen.length, 1);
    const response = await postJson(proxy.url, [
      { jsonrpc: '2.0', id: 40, method: 'eth_getCode', params: [] },
      { jsonrpc: '2.0', id: 41, method: 'evm_mine', params: [] },
      { jsonrpc: '2.0', id: 42, method: 'eth_getBalance', params: [] }
    ]);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.map((entry) => entry.id), [40, 41, 42]);
    for (const entry of response.body) {
      assert.equal(entry.error.code, -32601);
      assert.equal(entry.error.data.code, 'CALL_NOT_SUPPORTED');
      assert.equal(entry.error.data.method, 'evm_mine');
      assert.equal(entry.error.data.simulationTerminated, true);
    }
    const error = await terminationWithin(proxy.termination);
    assert.equal(error.method, 'evm_mine');
    assert.equal(seen.length, 1, 'no batch entry may reach upstream');
    assert.equal(proxy.diagnostics.forwardedRequests, 0);
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});
