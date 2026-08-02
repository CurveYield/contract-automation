import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateSimulationConfig,
  validateWorkflow
} from '../../protocol/src/index.mjs';

test('normalizes a fully configurable live-fork definition', () => {
  const value = validateSimulationConfig({
    engine: {
      mode: 'auto',
      preference: ['hardhat-edr', 'ganache'],
      fallbackOn: ['startup_failure', 'unsupported_evm']
    },
    fork: {
      start: { mode: 'explicit', blockNumber: 21_000_000 },
      upstreamProgression: {
        mode: 'manual',
        stateStrategy: 'replay-from-checkpoint'
      }
    },
    rpc: {
      allowLegacyRpcFallback: false,
      distribution: { strategy: 'weighted-round-robin' },
      methodRoutes: {
        debug_traceCall: 'primary-only',
        eth_getCode: 'secondary'
      },
      health: {
        sessionFailureThreshold: 3,
        crossSessionFailureThreshold: 4
      }
    }
  });

  assert.equal(value.engine.mode, 'auto');
  assert.deepEqual(value.engine.preference, ['hardhat-edr', 'ganache']);
  assert.equal(value.fork.start.blockNumber, 21_000_000);
  assert.equal(value.fork.upstreamProgression.stateStrategy, 'replay-from-checkpoint');
  assert.equal(value.rpc.health.sessionFailureThreshold, 3);
  assert.equal(value.rpc.health.crossSessionFailureThreshold, 4);
});

test('rejects RPC URLs and secret-bearing fields anywhere in simulation configuration', () => {
  assert.throws(
    () => validateSimulationConfig({ rpc: { rpcUrl: 'https://secret.invalid' } }),
    (error) => error?.code === 'forbidden_field'
  );
  assert.throws(
    () => validateSimulationConfig({ engine: { options: { privateKey: '0xabc' } } }),
    (error) => error?.code === 'forbidden_field'
  );
});

test('accepts arbitrary local block and timestamp progression actions', () => {
  const workflow = validateWorkflow({
    steps: [
      { action: 'setNextBlockTimestamp', timestamp: 1_800_000_000 },
      { action: 'mineAtTimestamp', timestamp: 1_800_000_012 },
      { action: 'mineUntilTimestamp', timestamp: 1_800_001_000, intervalSeconds: 12 },
      { action: 'advanceToBlock', blockNumber: 22_000_000, intervalSeconds: 12 },
      { action: 'setAutomine', enabled: false },
      { action: 'setIntervalMining', intervalMilliseconds: 1_000 },
      {
        action: 'refork',
        target: { mode: 'latest-at-action' },
        stateStrategy: 'replay-selected-steps',
        replay: { fromStep: 0, throughStep: 3 }
      }
    ]
  });

  assert.equal(workflow.steps.length, 7);
  assert.equal(workflow.steps[6].stateStrategy, 'replay-selected-steps');
});
