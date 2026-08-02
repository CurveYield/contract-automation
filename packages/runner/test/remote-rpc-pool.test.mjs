import test from 'node:test';
import assert from 'node:assert/strict';

import { loadRemoteRpcSlots, selectRemoteRpcSlot } from '../src/remote-rpc-pool.mjs';

test('loads numbered trusted Anvil endpoints without serializing their URLs', () => {
  const slots = loadRemoteRpcSlots({
    chainName: 'ethereum',
    environment: {
      RPC_ANVIL_ETHEREUM1: 'https://secret-one.invalid/token-one',
      RPC_ANVIL_ETHEREUM2: 'https://secret-two.invalid/token-two',
      RPC_ANVIL_BASE1: 'https://wrong-chain.invalid/token'
    }
  });

  assert.deepEqual(slots.map(({ id, secretName }) => ({ id, secretName })), [
    { id: 'anvil-ethereum-1', secretName: 'RPC_ANVIL_ETHEREUM1' },
    { id: 'anvil-ethereum-2', secretName: 'RPC_ANVIL_ETHEREUM2' }
  ]);
  assert.equal(slots[0].url, 'https://secret-one.invalid/token-one');
  assert.equal(JSON.stringify(slots).includes('token-one'), false);
  assert.equal(JSON.stringify(slots).includes('token-two'), false);
});

test('selects one sticky endpoint for the complete run', () => {
  const slots = loadRemoteRpcSlots({
    chainName: 'ethereum',
    environment: {
      RPC_ANVIL_ETHEREUM1: 'https://one.invalid',
      RPC_ANVIL_ETHEREUM2: 'https://two.invalid'
    }
  });

  const first = selectRemoteRpcSlot(slots, { stickyKey: 'job-123' });
  const again = selectRemoteRpcSlot(slots, { stickyKey: 'job-123' });
  assert.equal(first.id, again.id);
  assert.equal(first.url, again.url);
});

test('fails closed when no trusted remote Anvil endpoint exists', () => {
  assert.throws(
    () => selectRemoteRpcSlot([], { stickyKey: 'job-123' }),
    /No trusted remote Anvil RPC slots are configured/
  );
});
