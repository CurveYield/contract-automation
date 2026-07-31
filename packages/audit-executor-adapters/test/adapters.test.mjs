import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryExecutorTransport,
  createInvocationPlan,
  serializeInvocationPlan
} from '../src/index.mjs';
import {
  PHASE4_PROFILE_IDS,
  createPublishedProfileContract
} from '../../audit-tool-profile-contracts/src/index.mjs';

const workspaceId = `ws_${'1'.repeat(32)}`;
const layerId = `lyr_${'2'.repeat(32)}`;
const jobId = `ajob_${'3'.repeat(32)}`;
const attemptId = `att_${'4'.repeat(32)}`;
const digest = `sha256:${'a'.repeat(64)}`;

const configurations = Object.freeze({
  'solidity-compile-v1': { compilerVersion: '0.8.30', optimizerEnabled: true, optimizerRuns: 200, evmVersion: 'cancun', viaIR: false },
  'foundry-test-v1': { matchPath: 'test/**/*.t.sol', verbosity: 3, failFast: false },
  'foundry-fuzz-v1': { runs: 1000, seed: 42, dictionaryWeight: 40, includeStorage: true },
  'foundry-invariant-v1': { runs: 256, depth: 64, seed: 42, failOnRevert: false, callOverride: false },
  'slither-v1': { detectors: ['reentrancy-eth', 'uninitialized-state'], excludeDependencies: true, filterPaths: ['lib/**'] },
  'coverage-forge-v1': { reportFormats: ['summary', 'lcov'], matchPath: 'test/**/*.t.sol', includeLibraries: false }
});

function published(profileId) {
  return createPublishedProfileContract(profileId, { digest, publishedAt: '2026-07-31T12:00:00.000Z' });
}

function context(overrides = {}) {
  return {
    workspaceId,
    layerIds: [layerId],
    jobId,
    attemptId,
    timeoutSeconds: 1800,
    cancellationTokenId: 'cancel-token-0001',
    ...overrides
  };
}

test('creates a deterministic non-executing invocation plan for all six profiles', () => {
  for (const profileId of PHASE4_PROFILE_IDS) {
    const first = createInvocationPlan(published(profileId), configurations[profileId], context());
    const second = createInvocationPlan(published(profileId), configurations[profileId], context());
    assert.deepEqual(first, second);
    assert.equal(first.schemaVersion, 'executor-invocation-plan-v1');
    assert.equal(first.profileId, profileId);
    assert.equal(first.executionEnabled, false);
    assert.equal(first.executorState, 'unavailable');
    assert.equal(first.registryArtifact.digest, digest);
    assert.equal(first.environmentPolicies.networkPolicyId, 'audit-network-deny-v1');
    assert.equal(first.mounts.inputs[0].sourceObjectKey, `workspaces/${workspaceId}/source-v1.zip`);
    assert.equal(first.mounts.inputs[1].sourceObjectKey, `workspaces/${workspaceId}/layers/${layerId}.tar.zst`);
    assert.equal(first.mounts.outputs[0].destinationPrefix, `jobs/${jobId}/attempts/${attemptId}/outputs/`);
  }
});

test('emits ordered allowlisted argument tokens for each profile', () => {
  assert.deepEqual(createInvocationPlan(published('solidity-compile-v1'), configurations['solidity-compile-v1'], context()).arguments, ['--standard-json']);
  assert.deepEqual(createInvocationPlan(published('foundry-test-v1'), configurations['foundry-test-v1'], context()).arguments, ['test','--json','--match-path','test/**/*.t.sol','--verbosity','3','--fail-fast','false']);
  assert.deepEqual(createInvocationPlan(published('foundry-fuzz-v1'), configurations['foundry-fuzz-v1'], context()).arguments, ['fuzz','--json','--runs','1000','--seed','42','--dictionary-weight','40','--include-storage','true']);
  assert.deepEqual(createInvocationPlan(published('foundry-invariant-v1'), configurations['foundry-invariant-v1'], context()).arguments, ['invariant','--json','--runs','256','--depth','64','--seed','42','--fail-on-revert','false','--call-override','false']);
  assert.deepEqual(createInvocationPlan(published('slither-v1'), configurations['slither-v1'], context()).arguments, ['analyze','--json','--detectors','reentrancy-eth,uninitialized-state','--exclude-dependencies','true','--filter-path','lib/**']);
  assert.deepEqual(createInvocationPlan(published('coverage-forge-v1'), configurations['coverage-forge-v1'], context()).arguments, ['coverage','--json','--report','summary','--report','lcov','--match-path','test/**/*.t.sol','--include-libraries','false']);
});

test('derives all object keys and mount paths instead of accepting arbitrary paths', () => {
  const plan = createInvocationPlan(published('foundry-test-v1'), configurations['foundry-test-v1'], context());
  assert.deepEqual(plan.mounts, {
    inputs: [
      { sourceObjectKey: `workspaces/${workspaceId}/source-v1.zip`, targetPath: '/audit/input/source.zip', readOnly: true },
      { sourceObjectKey: `workspaces/${workspaceId}/layers/${layerId}.tar.zst`, targetPath: '/audit/input/layers/00000001.tar.zst', readOnly: true }
    ],
    outputs: [
      { targetPath: '/audit/output', destinationPrefix: `jobs/${jobId}/attempts/${attemptId}/outputs/`, maximumBytes: 64_000_000 }
    ]
  });
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), configurations['foundry-test-v1'], context({ workspaceId: '../escape' })), /workspace/i);
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), configurations['foundry-test-v1'], context({ layerIds: ['lyr_bad'] })), /layer/i);
});

test('keeps seeds, timeout, evidence, artifacts, and cancellation metadata explicit', () => {
  const fuzz = createInvocationPlan(published('foundry-fuzz-v1'), configurations['foundry-fuzz-v1'], context());
  assert.equal(fuzz.seed, 42);
  assert.equal(fuzz.timeoutSeconds, 1800);
  assert.deepEqual(fuzz.evidenceContract, { schemaVersion: 'tool-evidence-v1' });
  assert.deepEqual(fuzz.artifactContract, { schemaVersion: 'tool-artifacts-v1', maximumBytes: 64_000_000 });
  assert.deepEqual(fuzz.cancellation, { policyId: 'cooperative-then-hard-stop-v1', tokenId: 'cancel-token-0001', graceSeconds: 10 });
});

test('stable serialization is independent of caller object key order', () => {
  const first = createInvocationPlan(published('foundry-fuzz-v1'), configurations['foundry-fuzz-v1'], context());
  const reorderedConfiguration = { includeStorage: true, dictionaryWeight: 40, seed: 42, runs: 1000 };
  const second = createInvocationPlan(published('foundry-fuzz-v1'), reorderedConfiguration, context());
  assert.equal(serializeInvocationPlan(first), serializeInvocationPlan(second));
});

test('rejects invalid profile contracts, configuration, IDs, timeout, and cancellation tokens', () => {
  assert.throws(() => createInvocationPlan({ ...published('foundry-test-v1'), executionEnabled: true }, configurations['foundry-test-v1'], context()), /executionEnabled/);
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), { ...configurations['foundry-test-v1'], command: 'forge test' }, context()), /command/);
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), configurations['foundry-test-v1'], context({ timeoutSeconds: 0 })), /timeoutSeconds/);
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), configurations['foundry-test-v1'], context({ cancellationTokenId: '../token' })), /cancellationTokenId/);
});

test('in-memory executor transport records plans but is incapable of execution', async () => {
  const transport = new InMemoryExecutorTransport();
  const plan = createInvocationPlan(published('slither-v1'), configurations['slither-v1'], context());
  const result = await transport.submit(plan);
  assert.deepEqual(result, { accepted: false, code: 'executor_unavailable', executorState: 'unavailable' });
  assert.deepEqual(transport.recordedPlans(), [plan]);
  assert.equal('execute' in transport, false);
  assert.equal('spawn' in transport, false);
});

test('serialized plans contain no forbidden execution or secret field names', () => {
  for (const profileId of PHASE4_PROFILE_IDS) {
    const serialized = serializeInvocationPlan(createInvocationPlan(published(profileId), configurations[profileId], context())).toLowerCase();
    for (const forbidden of ['"shell"','"command"','"script"','"image"','"binary"','"url"','"rpc"','"privatekey"','"wallet"','"signer"','"broadcast"','"privileged"']) {
      assert.equal(serialized.includes(forbidden), false, `${profileId}: ${forbidden}`);
    }
  }
});
