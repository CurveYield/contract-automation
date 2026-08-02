import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendJournal,
  assertRequiredCallRecord,
  diffEntitySnapshots,
  hashCanonical,
  makeSimulationCallId,
  normalizeReceipt
} from '../src/local-state-journal.mjs';

test('hashCanonical is stable across object key order and bigint values', () => {
  const left = hashCanonical({ b: 2n, a: { z: 'x', y: [3n, 4] } });
  const right = hashCanonical({ a: { y: [3n, 4], z: 'x' }, b: 2n });
  assert.equal(left, right);
  assert.match(left, /^0x[0-9a-f]{64}$/);
});

test('makeSimulationCallId is deterministic and index-prefixed', () => {
  const descriptor = { label: 'fund whale 1', from: '0x1', to: '0x2', data: '0x1234' };
  const first = makeSimulationCallId(7, descriptor);
  const second = makeSimulationCallId(7, { to: '0x2', data: '0x1234', from: '0x1', label: 'fund whale 1' });
  assert.equal(first, second);
  assert.match(first, /^0007-[0-9a-f]{12}$/);
});

test('diffEntitySnapshots reports nested additions, changes, and removals', () => {
  const before = {
    vault: { totalSupply: '10', balances: { operator: '5', fee: '1' } },
    strategy: { destination: 0 }
  };
  const after = {
    vault: { totalSupply: '12', balances: { operator: '7' } },
    strategy: { destination: 1 },
    yearn: { shares: '2' }
  };
  assert.deepEqual(diffEntitySnapshots(before, after), {
    'strategy.destination': { before: 0, after: 1 },
    'vault.balances.fee': { before: '1', after: null },
    'vault.balances.operator': { before: '5', after: '7' },
    'vault.totalSupply': { before: '10', after: '12' },
    'yearn': { before: null, after: { shares: '2' } }
  });
});

test('appendJournal changes cumulatively and deterministically', () => {
  const zero = `0x${'00'.repeat(32)}`;
  const one = appendJournal(zero, { callIndex: 1, stateDiffHash: '0x01' });
  const oneAgain = appendJournal(zero, { stateDiffHash: '0x01', callIndex: 1 });
  const two = appendJournal(one, { callIndex: 2, stateDiffHash: '0x02' });
  assert.equal(one, oneAgain);
  assert.notEqual(one, two);
  assert.match(two, /^0x[0-9a-f]{64}$/);
});

test('normalizeReceipt preserves the requested transaction evidence', () => {
  const normalized = normalizeReceipt({
    hash: '0xabc',
    blockHash: '0xblock',
    blockNumber: 123,
    status: 1,
    gasUsed: 21000n,
    cumulativeGasUsed: 42000n,
    gasPrice: 9n,
    contractAddress: null,
    from: '0xfrom',
    to: '0xto',
    logs: [{ address: '0xlog', topics: ['0xtopic'], data: '0xdata', index: 2 }]
  });
  assert.deepEqual(normalized, {
    transactionHash: '0xabc',
    blockHash: '0xblock',
    blockNumber: 123,
    status: 1,
    gasUsed: '21000',
    cumulativeGasUsed: '42000',
    effectiveGasPrice: '9',
    contractAddress: null,
    from: '0xfrom',
    to: '0xto',
    logs: [{ address: '0xlog', topics: ['0xtopic'], data: '0xdata', index: 2 }]
  });
});

test('assertRequiredCallRecord rejects reports that omit trace replacement fields', () => {
  const complete = {
    simulationCallId: '0001-123456789abc',
    callIndex: 1,
    label: 'deposit',
    method: 'eth_sendTransaction',
    sender: '0xfrom',
    target: '0xto',
    calldata: '0x1234',
    calldataHash: hashCanonical('0x1234'),
    blockContext: { baseBlock: 1, number: 2, timestamp: 3 },
    gasLimit: '100000',
    receipt: { transactionHash: '0xabc' },
    returnData: '0x',
    rawLogs: [],
    decodedLogs: [],
    localTrace: {},
    traceHash: hashCanonical({}),
    beforeSnapshotHash: hashCanonical({ before: true }),
    afterSnapshotHash: hashCanonical({ after: true }),
    stateDiff: {},
    stateDiffHash: hashCanonical({}),
    preJournalHash: `0x${'00'.repeat(32)}`,
    postJournalHash: hashCanonical({ journal: 1 })
  };
  assert.equal(assertRequiredCallRecord(complete), complete);
  const missing = { ...complete };
  delete missing.stateDiffHash;
  assert.throws(() => assertRequiredCallRecord(missing), /stateDiffHash/);
});
