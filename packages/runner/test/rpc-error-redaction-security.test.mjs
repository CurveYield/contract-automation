import test from 'node:test';
import assert from 'node:assert/strict';

import { createArchiveRpcRouter } from '../src/archive-rpc-pool.mjs';
import { startLiveForkProxy } from '../src/live-fork-proxy.mjs';

const HOSTILE = [
  'https://rpc.example/key-secret',
  'Authorization: Bearer leaked-token',
  'C:\\Users\\runner\\secret.txt',
  '/home/runner/private/key'
];
const HOSTILE_MESSAGE = `monthly quota exceeded ${HOSTILE.join(' ')}`;

function rpcErrorResponse(id, message = HOSTILE_MESSAGE, status = 200) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code: -32005, message }
  }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function assertRedacted(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const fragment of HOSTILE) assert.equal(text.includes(fragment), false, fragment);
}

test('archive router throws a stable redacted error while preserving failure classification', async () => {
  const router = createArchiveRpcRouter({
    slots: [{ id: 'secondary-01', pool: 'secondary', url: 'https://slot.invalid/key' }],
    retryDelaysMs: [0],
    fetchImpl: async (_url, request) => rpcErrorResponse(JSON.parse(request.body).id),
    healthPolicy: { sessionFailureThreshold: 1 }
  });

  await assert.rejects(
    router.request({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [] }),
    (error) => {
      assert.equal(error.message, 'Archive RPC request failed');
      assert.equal(error.code, 'ARCHIVE_RPC_UNAVAILABLE');
      assert.equal(error.failureClass, 'quota_or_rate_limit');
      assert.equal(error.method, 'eth_getCode');
      assertRedacted(error.message);
      return true;
    }
  );
});

test('archive router never reflects arbitrary caught errors through jsonError', () => {
  const router = createArchiveRpcRouter({
    slots: [{ id: 'secondary-01', pool: 'secondary', url: 'https://slot.invalid/key' }],
    retryDelaysMs: [0],
    fetchImpl: async () => { throw new Error(HOSTILE_MESSAGE); }
  });
  const response = router.jsonError(
    { jsonrpc: '2.0', id: 2, method: 'eth_getCode', params: [] },
    Object.assign(new Error(HOSTILE_MESSAGE), {
      code: 'ARCHIVE_RPC_UNAVAILABLE',
      failureClass: 'network_or_timeout',
      method: 'eth_getCode'
    })
  );
  assert.equal(response.error.message, 'Archive RPC request failed');
  assert.deepEqual(response.error.data, {
    code: 'ARCHIVE_RPC_UNAVAILABLE',
    failureClass: 'network_or_timeout',
    method: 'eth_getCode'
  });
  assertRedacted(response);
});

test('invalid JSON-RPC method text is not copied into public error metadata', async () => {
  const router = createArchiveRpcRouter({
    slots: [{ id: 'secondary-01', pool: 'secondary', url: 'https://slot.invalid/key' }],
    retryDelaysMs: [0],
    fetchImpl: async () => { throw new Error(HOSTILE_MESSAGE); }
  });
  await assert.rejects(
    router.request({
      jsonrpc: '2.0',
      id: 3,
      method: 'eth_getCode\nAuthorization: Bearer leaked-token',
      params: []
    }),
    (error) => {
      assert.equal(error.message, 'Archive RPC request failed');
      assert.equal(error.method, undefined);
      assertRedacted(error);
      return true;
    }
  );
});

test('live fork proxy returns a stable redacted JSON-RPC error', async () => {
  const fetchImpl = async (_url, request) => {
    const payload = JSON.parse(request.body);
    if (payload.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: '0x7b' }));
    }
    if (payload.method === 'eth_chainId') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: '0x1' }));
    }
    if (payload.method === 'eth_getBlockByNumber') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          number: '0x7b',
          hash: `0x${'ab'.repeat(32)}`,
          timestamp: '0x64',
          transactions: []
        }
      }));
    }
    return rpcErrorResponse(payload.id);
  };

  let proxy;
  try {
    proxy = await startLiveForkProxy({
      slots: [{ id: 'secondary-01', pool: 'secondary', url: 'https://slot.invalid/key' }],
      chainId: 1,
      blockPolicy: { mode: 'latest-at-start' },
      routing: { retryDelaysMs: [0] },
      fetchImpl
    });
    const response = await fetch(proxy.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'eth_getCode', params: [] })
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error.message, 'Archive RPC request failed');
    assert.deepEqual(body.error.data, {
      code: 'ARCHIVE_RPC_UNAVAILABLE',
      method: 'eth_getCode',
      failureClass: 'quota_or_rate_limit'
    });
    assertRedacted(body);
  } finally {
    await proxy?.close();
  }
});