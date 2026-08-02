import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createArchiveRpcRouter,
  loadArchiveRpcSlots
} from '../src/archive-rpc-pool.mjs';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('loads only configured optional primary and secondary slots without exposing URLs', () => {
  const environment = {
    SIM_ARCHIVE_PRIMARY_ETHEREUM_01: 'https://primary-one.invalid/key-a',
    SIM_ARCHIVE_PRIMARY_ETHEREUM_03: 'https://primary-three.invalid/key-b',
    SIM_ARCHIVE_SECONDARY_ETHEREUM_02: 'https://secondary-two.invalid/key-c',
    RPC_ETHEREUM: 'https://legacy.invalid/key-d'
  };

  const slots = loadArchiveRpcSlots({
    chainName: 'ethereum',
    legacyEnv: 'RPC_ETHEREUM',
    environment,
    allowLegacyFallback: false
  });

  assert.deepEqual(slots.map(({ id, pool }) => ({ id, pool })), [
    { id: 'primary-01', pool: 'primary' },
    { id: 'primary-03', pool: 'primary' },
    { id: 'secondary-02', pool: 'secondary' }
  ]);
  assert.equal(JSON.stringify(slots).includes('key-a'), false);
  assert.equal(JSON.stringify(slots).includes('key-b'), false);
  assert.equal(JSON.stringify(slots).includes('key-c'), false);
  assert.equal(JSON.stringify(slots).includes('key-d'), false);
});

test('routes debug calls to primary and rotates standard calls evenly across secondary slots', async () => {
  const calls = [];
  const urlBySlot = new Map([
    ['primary-01', 'https://primary-one.invalid'],
    ['secondary-01', 'https://secondary-one.invalid'],
    ['secondary-02', 'https://secondary-two.invalid']
  ]);
  const slots = [...urlBySlot].map(([id, url]) => ({
    id,
    pool: id.startsWith('primary') ? 'primary' : 'secondary',
    url
  }));
  const fetchImpl = async (url, request) => {
    const payload = JSON.parse(request.body);
    const slot = [...urlBySlot].find(([, value]) => value === url)?.[0];
    calls.push({ slot, method: payload.method });
    return jsonResponse({ jsonrpc: '2.0', id: payload.id, result: slot });
  };

  const router = createArchiveRpcRouter({
    slots,
    fetchImpl,
    retryDelaysMs: [0],
    healthPolicy: { sessionFailureThreshold: 3 }
  });

  await router.request({ jsonrpc: '2.0', id: 1, method: 'debug_traceCall', params: [] });
  await router.request({ jsonrpc: '2.0', id: 2, method: 'eth_getCode', params: [] });
  await router.request({ jsonrpc: '2.0', id: 3, method: 'eth_getCode', params: [] });
  await router.request({ jsonrpc: '2.0', id: 4, method: 'eth_getCode', params: [] });

  assert.deepEqual(calls, [
    { slot: 'primary-01', method: 'debug_traceCall' },
    { slot: 'secondary-01', method: 'eth_getCode' },
    { slot: 'secondary-02', method: 'eth_getCode' },
    { slot: 'secondary-01', method: 'eth_getCode' }
  ]);
});

test('quarantines one endpoint after three qualifying session failures and fails over', async () => {
  const attempts = [];
  const slots = [
    { id: 'secondary-01', pool: 'secondary', url: 'https://secondary-one.invalid' },
    { id: 'secondary-02', pool: 'secondary', url: 'https://secondary-two.invalid' }
  ];
  const fetchImpl = async (url, request) => {
    const payload = JSON.parse(request.body);
    const slot = url.includes('one') ? 'secondary-01' : 'secondary-02';
    attempts.push(slot);
    if (slot === 'secondary-01') {
      return jsonResponse({ jsonrpc: '2.0', id: payload.id, error: { code: -32005, message: 'monthly quota exceeded' } });
    }
    return jsonResponse({ jsonrpc: '2.0', id: payload.id, result: '0x1234' });
  };

  const router = createArchiveRpcRouter({
    slots,
    fetchImpl,
    retryDelaysMs: [0],
    healthPolicy: { sessionFailureThreshold: 3 }
  });

  for (let id = 1; id <= 4; id += 1) {
    const response = await router.request({ jsonrpc: '2.0', id, method: 'eth_getCode', params: [] });
    assert.equal(response.result, '0x1234');
  }

  const slot = router.diagnostics.slots.find((entry) => entry.id === 'secondary-01');
  assert.equal(slot.quarantined, true);
  assert.equal(slot.failures, 3);
  assert.equal(attempts.filter((id) => id === 'secondary-01').length, 3);
  assert.equal(JSON.stringify(router.diagnostics).includes('secondary-one.invalid'), false);
});
