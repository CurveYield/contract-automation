import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVOCATION_PLAN_SCHEMA_VERSION,
  ReferenceInvocationPlanRecorder,
  createInvocationPlan,
  serializeInvocationPlan,
  validateInvocationPlan
} from '../src/index.mjs';
import {
  PHASE4_PROFILE_IDS,
  createPublishedProfileContract
} from '../../audit-tool-profile-contracts/src/index.mjs';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const WORKSPACE_ID = `ws_${'1'.repeat(32)}`;
const LAYER_ID = `lyr_${'2'.repeat(32)}`;
const JOB_ID = `ajob_${'3'.repeat(32)}`;
const ATTEMPT_ID = `att_${'4'.repeat(32)}`;

const CONFIGURATIONS = Object.freeze({
  'solidity-compile-v1': { compilerVersion: '0.8.30', optimizerEnabled: true, optimizerRuns: 200, evmVersion: 'cancun', viaIR: false },
  'foundry-test-v1': { matchPath: 'test/**/*.t.sol', verbosity: 3, failFast: false },
  'foundry-fuzz-v1': { runs: 1000, seed: 42, dictionaryWeight: 40, includeStorage: true },
  'foundry-invariant-v1': { runs: 256, depth: 64, seed: 42, failOnRevert: false, callOverride: false },
  'slither-v1': { detectors: ['reentrancy-eth', 'uninitialized-state'], excludeDependencies: true, filterPaths: ['lib/.*'] },
  'coverage-forge-v1': { reportFormats: ['summary', 'lcov'], matchPath: 'test/**/*.t.sol', includeLibraries: false }
});

function published(profileId) {
  return createPublishedProfileContract(profileId, { digest: DIGEST, publishedAt: '2026-08-01T10:00:00.000Z' });
}

function context(overrides = {}) {
  return {
    workspaceId: WORKSPACE_ID,
    layerIds: [LAYER_ID],
    jobId: JOB_ID,
    attemptId: ATTEMPT_ID,
    timeoutSeconds: 1800,
    cancellationTokenId: 'cancel-token-0001',
    ...overrides
  };
}

test('creates deterministic frozen data-only plans for all six profiles', () => {
  for (const profileId of PHASE4_PROFILE_IDS) {
    const first = createInvocationPlan(published(profileId), CONFIGURATIONS[profileId], context());
    const second = createInvocationPlan(published(profileId), CONFIGURATIONS[profileId], context());
    assert.deepEqual(first, second);
    assert.equal(first.schemaVersion, INVOCATION_PLAN_SCHEMA_VERSION);
    assert.deepEqual(first.profileIdentity, { profileId, profileVersion: 1 });
    assert.deepEqual(first.immutableDigestIdentity, {
      registryRepository: published(profileId).registryArtifact.repository,
      digest: DIGEST
    });
    assert.equal(first.executionEnabled, false);
    assert.equal(first.executorState, 'unavailable');
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.mountDescriptors), true);
    assert.deepEqual(validateInvocationPlan(first), first);
  }
});

test('emits exact pinned-tool argument tokens for every profile', () => {
  assert.deepEqual(
    createInvocationPlan(published('solidity-compile-v1'), CONFIGURATIONS['solidity-compile-v1'], context()).orderedArguments,
    ['--standard-json']
  );
  assert.deepEqual(
    createInvocationPlan(published('foundry-test-v1'), CONFIGURATIONS['foundry-test-v1'], context()).orderedArguments,
    ['test','--json','--match-path','test/**/*.t.sol','-vvv']
  );
  assert.deepEqual(
    createInvocationPlan(published('foundry-test-v1'), { ...CONFIGURATIONS['foundry-test-v1'], failFast: true }, context()).orderedArguments,
    ['test','--json','--match-path','test/**/*.t.sol','-vvv','--fail-fast']
  );
  assert.deepEqual(
    createInvocationPlan(published('foundry-fuzz-v1'), CONFIGURATIONS['foundry-fuzz-v1'], context()).orderedArguments,
    ['test','--json','--fuzz-runs','1000','--fuzz-seed','42']
  );
  assert.deepEqual(
    createInvocationPlan(published('foundry-invariant-v1'), CONFIGURATIONS['foundry-invariant-v1'], context()).orderedArguments,
    ['test','--json','--match-test','^invariant_','--fuzz-seed','42']
  );
  assert.deepEqual(
    createInvocationPlan(published('slither-v1'), CONFIGURATIONS['slither-v1'], context()).orderedArguments,
    ['.','--json','-','--detect','reentrancy-eth,uninitialized-state','--exclude-dependencies','--filter-paths','lib/.*']
  );
  assert.deepEqual(
    createInvocationPlan(published('coverage-forge-v1'), CONFIGURATIONS['coverage-forge-v1'], context()).orderedArguments,
    ['coverage','--json','--report','summary','--report','lcov','--match-path','test/**/*.t.sol']
  );
  assert.deepEqual(
    createInvocationPlan(published('coverage-forge-v1'), { ...CONFIGURATIONS['coverage-forge-v1'], includeLibraries: true }, context()).orderedArguments,
    ['coverage','--json','--report','summary','--report','lcov','--match-path','test/**/*.t.sol','--include-libs']
  );
});

test('derives fixed mount descriptors and artifact destinations without caller paths', () => {
  const plan = createInvocationPlan(published('foundry-test-v1'), CONFIGURATIONS['foundry-test-v1'], context());
  assert.deepEqual(plan.mountDescriptors, [
    {
      mountId: 'workspace-source-v1',
      sourceObjectKey: `workspaces/${WORKSPACE_ID}/source-manifest-v1.json`,
      targetPath: '/audit/input/source-manifest-v1.json',
      readOnly: true
    },
    {
      mountId: 'workspace-layer-00000001',
      sourceObjectKey: `workspaces/${WORKSPACE_ID}/layers/${LAYER_ID}.tar.zst`,
      targetPath: '/audit/input/layers/00000001.tar.zst',
      readOnly: true
    }
  ]);
  assert.deepEqual(plan.artifactContract, {
    schemaVersion: 'tool-artifacts-v1',
    collectionRoot: '/audit/output',
    destinationPrefix: `jobs/${JOB_ID}/attempts/${ATTEMPT_ID}/outputs/`,
    maximumBytes: 64_000_000
  });
});

test('keeps policy, evidence, seed, timeout, and cancellation metadata explicit', () => {
  const plan = createInvocationPlan(published('foundry-fuzz-v1'), CONFIGURATIONS['foundry-fuzz-v1'], context());
  assert.deepEqual(plan.policyIdentifiers, {
    resourcePolicyId: 'audit-standard-2cpu-4g-v1',
    networkPolicyId: 'audit-network-deny-v1'
  });
  assert.deepEqual(plan.evidenceContract, { schemaVersion: 'tool-evidence-v1' });
  assert.deepEqual(plan.deterministicSeed, { policyId: 'explicit-uint32-v1', value: 42 });
  assert.deepEqual(plan.timeout, { policyId: 'bounded-wall-clock-v1', seconds: 1800 });
  assert.deepEqual(plan.cancellation, {
    policyId: 'cooperative-then-hard-stop-v1', tokenId: 'cancel-token-0001', graceSeconds: 10
  });
});

test('canonical serialization is independent of caller key order', () => {
  const first = createInvocationPlan(published('foundry-fuzz-v1'), CONFIGURATIONS['foundry-fuzz-v1'], context());
  const second = createInvocationPlan(
    published('foundry-fuzz-v1'),
    { includeStorage: true, dictionaryWeight: 40, seed: 42, runs: 1000 },
    context()
  );
  assert.equal(serializeInvocationPlan(first), serializeInvocationPlan(second));
});

test('validation re-derives and rejects every tampered security-critical field', () => {
  const plan = createInvocationPlan(published('foundry-fuzz-v1'), CONFIGURATIONS['foundry-fuzz-v1'], context());
  const mutations = [
    { orderedArguments: [...plan.orderedArguments, '--ffi'] },
    { policyIdentifiers: { ...plan.policyIdentifiers, networkPolicyId: 'audit-network-open-v1' } },
    { mountDescriptors: [{ ...plan.mountDescriptors[0], targetPath: '/host' }, ...plan.mountDescriptors.slice(1)] },
    { artifactContract: { ...plan.artifactContract, maximumBytes: 64_000_001 } },
    { evidenceContract: { schemaVersion: 'other-v1' } },
    { deterministicSeed: { ...plan.deterministicSeed, value: 43 } },
    { timeout: { ...plan.timeout, policyId: 'unbounded-v1' } },
    { cancellation: { ...plan.cancellation, graceSeconds: 11 } },
    { executionEnabled: true },
    { executorState: 'ready' }
  ];
  for (const mutation of mutations) assert.throws(() => validateInvocationPlan({ ...plan, ...mutation }));
});

test('rejects recursive forbidden fields, IDs, timeout, tokens, and unpublished profiles', () => {
  for (const forbiddenField of ['command','credentials','transaction','networkDestination','packageInstallation','filesystemMutation','processSpawn','signing']) {
    assert.throws(() => createInvocationPlan(published('foundry-test-v1'), CONFIGURATIONS['foundry-test-v1'], context({ layerIds: [{ nested: { [forbiddenField]: 'run' } }] })), new RegExp(forbiddenField, 'i'));
  }
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), CONFIGURATIONS['foundry-test-v1'], context({ workspaceId: '../escape' })), /workspace/i);
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), CONFIGURATIONS['foundry-test-v1'], context({ timeoutSeconds: 0 })), /timeout/i);
  assert.throws(() => createInvocationPlan(published('foundry-test-v1'), CONFIGURATIONS['foundry-test-v1'], context({ cancellationTokenId: '../token' })), /cancellationTokenId/);
  assert.throws(() => createInvocationPlan({ ...published('foundry-test-v1'), publicationState: 'unpublished' }, CONFIGURATIONS['foundry-test-v1'], context()));
});

test('reference recorder can only validate and record plans', () => {
  const recorder = new ReferenceInvocationPlanRecorder();
  const plan = createInvocationPlan(published('slither-v1'), CONFIGURATIONS['slither-v1'], context());
  assert.deepEqual(recorder.record(plan), { recorded: true, index: 0 });
  assert.deepEqual(recorder.recordedPlans(), [plan]);
  for (const prohibited of ['submit', 'execute', 'spawn', 'run', 'broadcast']) assert.equal(prohibited in recorder, false);
  const copy = recorder.recordedPlans();
  copy[0].orderedArguments.push('tamper');
  assert.deepEqual(recorder.recordedPlans(), [plan]);
});

test('serialized plans contain no execution, secret, transaction, URL, or privilege fields', () => {
  const forbidden = [
    '"shell"','"command"','"commands"','"script"','"scripts"','"image"','"binary"','"url"','"rpc"',
    '"privatekey"','"wallet"','"signer"','"credential"','"transaction"','"broadcast"','"privileged"',
    '"packagemanagercommand"','"networkdestination"','"filesystemmutation"','"processspawn"'
  ];
  for (const profileId of PHASE4_PROFILE_IDS) {
    const serialized = serializeInvocationPlan(createInvocationPlan(published(profileId), CONFIGURATIONS[profileId], context())).toLowerCase();
    for (const item of forbidden) assert.equal(serialized.includes(item), false, `${profileId}: ${item}`);
  }
});
