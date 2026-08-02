import test from 'node:test';
import assert from 'node:assert/strict';

import { GanacheWorkflowRuntime } from '../src/engine.mjs';

function runtimeWithProvider({ blockNumber = 100, timestamp = 1_000, reforkHandler } = {}) {
  const calls = [];
  let currentBlock = blockNumber;
  let currentTimestamp = timestamp;
  const provider = {
    async send(method, params) {
      calls.push({ method, params });
      if (method === 'evm_setNextBlockTimestamp') currentTimestamp = Number(params[0]);
      if (method === 'evm_increaseTime') currentTimestamp += Number(params[0]);
      if (method === 'evm_mine') currentBlock += 1;
      return true;
    },
    async getBlockNumber() { return currentBlock; },
    async getBlock() { return { number: currentBlock, timestamp: currentTimestamp }; }
  };
  const runtime = new GanacheWorkflowRuntime({
    provider,
    artifacts: { get() { throw new Error('artifact lookup not expected'); } },
    ethers: {},
    reforkHandler
  });
  return { runtime, calls, state: () => ({ currentBlock, currentTimestamp }) };
}

const context = { aliases: {}, values: {}, snapshots: {}, deployments: {} };

test('mines arbitrary blocks with configurable timestamp intervals', async () => {
  const { runtime, calls, state } = runtimeWithProvider();
  const output = await runtime.execute({ action: 'mine', blocks: 3, intervalSeconds: 12 }, context);
  assert.deepEqual(output, { blocks: 3, intervalSeconds: 12 });
  assert.deepEqual(calls, [
    { method: 'evm_setNextBlockTimestamp', params: [1012] },
    { method: 'evm_mine', params: [] },
    { method: 'evm_setNextBlockTimestamp', params: [1024] },
    { method: 'evm_mine', params: [] },
    { method: 'evm_setNextBlockTimestamp', params: [1036] },
    { method: 'evm_mine', params: [] }
  ]);
  assert.deepEqual(state(), { currentBlock: 103, currentTimestamp: 1036 });
});

test('supports explicit timestamp, target timestamp, target block, and mining modes', async () => {
  const { runtime, calls } = runtimeWithProvider();
  await runtime.execute({ action: 'setNextBlockTimestamp', timestamp: 2_000 }, context);
  await runtime.execute({ action: 'mineAtTimestamp', timestamp: 2_012 }, context);
  await runtime.execute({ action: 'mineUntilTimestamp', timestamp: 2_048, intervalSeconds: 12 }, context);
  await runtime.execute({ action: 'advanceToBlock', blockNumber: 105, intervalSeconds: 6 }, context);
  await runtime.execute({ action: 'setAutomine', enabled: false }, context);
  await runtime.execute({ action: 'setIntervalMining', intervalMilliseconds: 1_500 }, context);

  assert.ok(calls.some((call) => call.method === 'evm_setAutomine' && call.params[0] === false));
  assert.ok(calls.some((call) => call.method === 'evm_setIntervalMining' && call.params[0] === 1_500));
  assert.ok(calls.filter((call) => call.method === 'evm_mine').length >= 5);
});

test('delegates configurable refork strategy to the engine adapter', async () => {
  const seen = [];
  const { runtime } = runtimeWithProvider({
    reforkHandler: async (request, runtimeContext) => {
      seen.push({ request, runtimeContext });
      return { blockNumber: 456, blockHash: `0x${'cd'.repeat(32)}`, stateStrategy: request.stateStrategy };
    }
  });
  const step = {
    action: 'refork',
    target: { mode: 'explicit', blockNumber: 456 },
    stateStrategy: 'replay-selected-steps',
    replay: { fromStep: 2, throughStep: 7 }
  };
  const output = await runtime.execute(step, context);
  assert.equal(output.blockNumber, 456);
  assert.equal(output.stateStrategy, 'replay-selected-steps');
  assert.equal(seen[0].request.target.blockNumber, 456);
  assert.equal(seen[0].runtimeContext, context);
});

test('fails an unsupported refork before mutating engine state', async () => {
  const { runtime, calls } = runtimeWithProvider();
  await assert.rejects(
    runtime.execute({
      action: 'refork',
      target: { mode: 'latest-at-action' },
      stateStrategy: 'discard'
    }, context),
    /does not support refork/
  );
  assert.deepEqual(calls, []);
});
