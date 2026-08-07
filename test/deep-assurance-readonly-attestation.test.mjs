import test from 'node:test';
import assert from 'node:assert/strict';

import { validateWorkflow } from '../packages/protocol/src/index.mjs';
import { GanacheWorkflowRuntime } from '../packages/runner/src/engine.mjs';

const TARGET = '0x1111111111111111111111111111111111111111';
const SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const STORAGE_VALUE = '0x0000000000000000000000002222222222222222222222222222222222222222';
const CODE_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function runtimeFixture() {
  const calls = [];
  const provider = {
    async getCode(target) {
      calls.push(['getCode', target]);
      return '0x6001600055';
    },
    async getStorage(target, slot) {
      calls.push(['getStorage', target, slot]);
      return STORAGE_VALUE;
    },
    async send() {
      throw new Error('read-only attestation must not invoke arbitrary provider.send');
    }
  };
  const ethers = {
    keccak256(value) {
      assert.equal(value, '0x6001600055');
      return CODE_HASH;
    }
  };
  return { runtime: new GanacheWorkflowRuntime({ provider, artifacts: null, ethers }), calls };
}

test('protocol accepts the two read-only attestation actions', () => {
  const workflow = validateWorkflow({ steps: [
    { action: 'readCodeHash', target: TARGET, equals: CODE_HASH, saveAs: 'boostHubCodeHash' },
    { action: 'readStorage', target: TARGET, slot: SLOT, equals: STORAGE_VALUE, saveAs: 'implementationSlot' }
  ]});
  assert.equal(workflow.steps[0].action, 'readCodeHash');
  assert.equal(workflow.steps[1].action, 'readStorage');
});

test('protocol rejects write-like fields on read-only attestation actions', () => {
  assert.throws(() => validateWorkflow({ steps: [
    { action: 'readCodeHash', target: TARGET, from: TARGET }
  ]}), /not allowed|unknown/i);
  assert.throws(() => validateWorkflow({ steps: [
    { action: 'readStorage', target: TARGET, slot: SLOT, value: '1' }
  ]}), /not allowed|unknown/i);
});

test('protocol requires exact 32-byte hashes and storage slots', () => {
  assert.throws(() => validateWorkflow({ steps: [
    { action: 'readCodeHash', target: TARGET, equals: '0x1234' }
  ]}), /32-byte|hash|equals/i);
  assert.throws(() => validateWorkflow({ steps: [
    { action: 'readStorage', target: TARGET, slot: '0x01' }
  ]}), /32-byte|slot/i);
});

test('readCodeHash reads code, hashes it, asserts, and never writes', async () => {
  const { runtime, calls } = runtimeFixture();
  const context = { aliases: {}, values: {}, snapshots: {}, deployments: {} };
  const output = await runtime.execute({ action: 'readCodeHash', target: TARGET, equals: CODE_HASH, saveAs: 'codeHash' }, context);
  assert.deepEqual(calls, [['getCode', TARGET]]);
  assert.equal(output.target, TARGET);
  assert.equal(output.codeHash, CODE_HASH);
  assert.equal(output.codeSizeBytes, 5);
  assert.equal(context.values.codeHash, CODE_HASH);
});

test('readCodeHash rejects a mismatched expected hash', async () => {
  const { runtime } = runtimeFixture();
  const context = { aliases: {}, values: {}, snapshots: {}, deployments: {} };
  await assert.rejects(
    runtime.execute({ action: 'readCodeHash', target: TARGET, equals: `0x${'b'.repeat(64)}` }, context),
    /code hash assertion failed/i
  );
});

test('readStorage reads one exact slot, asserts, saves, and never writes', async () => {
  const { runtime, calls } = runtimeFixture();
  const context = { aliases: {}, values: {}, snapshots: {}, deployments: {} };
  const output = await runtime.execute({ action: 'readStorage', target: TARGET, slot: SLOT, equals: STORAGE_VALUE, saveAs: 'impl' }, context);
  assert.deepEqual(calls, [['getStorage', TARGET, SLOT]]);
  assert.equal(output.value, STORAGE_VALUE);
  assert.equal(context.values.impl, STORAGE_VALUE);
});

test('readStorage rejects a mismatched expected value', async () => {
  const { runtime } = runtimeFixture();
  const context = { aliases: {}, values: {}, snapshots: {}, deployments: {} };
  await assert.rejects(
    runtime.execute({ action: 'readStorage', target: TARGET, slot: SLOT, equals: `0x${'0'.repeat(64)}` }, context),
    /storage assertion failed/i
  );
});
