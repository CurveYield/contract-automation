import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL('../src/index.mjs', import.meta.url);
const load = () => import(moduleUrl.href);

const validConfigurations = Object.freeze({
  'hardhat-test-v1': {
    testFiles: ['test/**/*.test.mjs'],
    grep: 'critical path',
    bail: false,
    parallel: false,
    concurrency: 1
  },
  'echidna-v1': {
    testMode: 'property',
    testLimit: 50000,
    sequenceLength: 100,
    shrinkLimit: 5000,
    seed: 42,
    workers: 2
  },
  'mutation-v1': {
    sourceFiles: ['contracts/Example.sol'],
    mutationOperators: ['require-mutation', 'binary-op-mutation'],
    maxMutants: 500,
    seed: 0,
    validateMutants: true
  },
  'dependency-scan-v1': {
    lockfiles: ['package-lock.json'],
    includeDevDependencies: true,
    minimumSeverity: 'moderate',
    failOnFindings: true
  }
});

test('exports four exact unpublished Phase 5 templates with official immutable release identities', async () => {
  const {
    PHASE5_PROFILE_IDS,
    PHASE5_PROFILE_TEMPLATES,
    getPhase5ProfileTemplate
  } = await load();

  assert.deepEqual(PHASE5_PROFILE_IDS, [
    'hardhat-test-v1',
    'echidna-v1',
    'mutation-v1',
    'dependency-scan-v1'
  ]);
  assert.equal(PHASE5_PROFILE_TEMPLATES.length, 4);
  const expected = {
    'hardhat-test-v1': ['hardhat', '3.6.0', 'hardhat@3.6.0', 'd6f606b4f3c47d6fa6de6cce83dd87b966bb425d'],
    'echidna-v1': ['echidna', '2.3.2', 'v2.3.2', '7cbb32f3ff558d8e0b6e249c199831915c971d76'],
    'mutation-v1': ['gambit', '1.0.6', 'v1.0.6', '072ff4c6d747397f859e0a15a20fe1ff05672332'],
    'dependency-scan-v1': ['osv-scanner', '2.3.8', 'v2.3.8', '408fcd6f8707999a29e7ba45e15809764cf24f67']
  };
  for (const [profileId, [name, version, releaseId, releaseCommit]] of Object.entries(expected)) {
    const template = getPhase5ProfileTemplate(profileId);
    assert.deepEqual(template.tool, {
      name,
      version,
      releaseId,
      releaseCommit,
      officialSource: template.tool.officialSource,
      retrievedOn: '2026-08-01'
    });
    assert.match(template.tool.officialSource, /^https:\/\/github\.com\//);
    assert.doesNotMatch(version, /[<>=~^*xX]/);
    assert.equal(template.schemaVersion, 'phase5-tool-profile-template-v1');
    assert.equal(template.publicationState, 'unpublished');
    assert.equal(template.executionEnabled, false);
    assert.equal(template.executorState, 'unavailable');
    assert.equal(template.digestRequired, true);
    assert.equal('registryArtifact' in template, false);
    assert.equal(Object.isFrozen(template), true);
  }
});

test('templates define strict resource, deny-all network, timeout, cancellation, evidence, and artifact contracts', async () => {
  const { PHASE5_PROFILE_TEMPLATES } = await load();
  for (const template of PHASE5_PROFILE_TEMPLATES) {
    assert.equal(template.networkPolicy.policyId, 'audit-network-deny-v1');
    assert.equal(template.networkPolicy.mode, 'deny-all');
    assert.deepEqual(template.networkPolicy.allowedDestinations, []);
    assert.ok(template.resourcePolicy.cpuMillis > 0);
    assert.ok(template.resourcePolicy.memoryBytes > 0);
    assert.ok(template.resourcePolicy.outputBytes > 0);
    assert.ok(template.resourcePolicy.processCount > 0);
    assert.ok(template.timeoutContract.minimumSeconds >= 1);
    assert.ok(template.timeoutContract.defaultSeconds <= template.timeoutContract.maximumSeconds);
    assert.equal(template.cancellationContract.policyId, 'cooperative-then-hard-stop-v1');
    assert.equal(template.cancellationContract.executionAvailable, false);
    assert.match(template.evidenceContract.schemaVersion, /^phase5-[a-z-]+-evidence-v1$/);
    assert.match(template.artifactContract.schemaVersion, /^phase5-[a-z-]+-artifacts-v1$/);
    assert.ok(template.evidenceContract.allowedTypes.length > 0);
    assert.ok(template.artifactContract.allowedNames.length > 0);
  }
});

test('validates each exact configuration allowlist and recursively rejects forbidden concepts', async () => {
  const { validatePhase5ProfileConfiguration } = await load();
  for (const [profileId, configuration] of Object.entries(validConfigurations)) {
    assert.deepEqual(validatePhase5ProfileConfiguration(profileId, configuration), configuration);
    assert.throws(
      () => validatePhase5ProfileConfiguration(profileId, { ...configuration, unexpected: true }),
      /unexpected/
    );
    assert.throws(
      () => validatePhase5ProfileConfiguration(profileId, {
        ...configuration,
        nested: { harmless: { command: 'forbidden' } }
      }),
      /command/
    );
  }
});

test('enforces deterministic seeds, safe relative files, exact enums, and bounded numeric values', async () => {
  const { validatePhase5ProfileConfiguration } = await load();
  assert.throws(() => validatePhase5ProfileConfiguration('hardhat-test-v1', {
    ...validConfigurations['hardhat-test-v1'], testFiles: ['../outside.test.mjs']
  }), /testFiles/);
  assert.throws(() => validatePhase5ProfileConfiguration('hardhat-test-v1', {
    ...validConfigurations['hardhat-test-v1'], concurrency: 9
  }), /concurrency/);
  assert.throws(() => validatePhase5ProfileConfiguration('echidna-v1', {
    ...validConfigurations['echidna-v1'], seed: -1
  }), /seed/);
  assert.throws(() => validatePhase5ProfileConfiguration('echidna-v1', {
    ...validConfigurations['echidna-v1'], testMode: 'network-fork'
  }), /testMode/);
  assert.throws(() => validatePhase5ProfileConfiguration('mutation-v1', {
    ...validConfigurations['mutation-v1'], mutationOperators: ['made-up-operator']
  }), /mutationOperators/);
  assert.throws(() => validatePhase5ProfileConfiguration('dependency-scan-v1', {
    ...validConfigurations['dependency-scan-v1'], lockfiles: ['scripts/run.sh']
  }), /lockfiles/);
});

test('publication requires a supplied immutable digest and cannot enable execution', async () => {
  const {
    PHASE5_PROFILE_IDS,
    createPublishedPhase5ProfileContract,
    validatePublishedPhase5ProfileContract
  } = await load();
  const digest = `sha256:${'a'.repeat(64)}`;
  const publishedAt = '2026-08-01T10:00:00.000Z';
  for (const profileId of PHASE5_PROFILE_IDS) {
    const contract = createPublishedPhase5ProfileContract(profileId, { digest, publishedAt });
    assert.equal(contract.schemaVersion, 'phase5-tool-profile-contract-v1');
    assert.equal(contract.publicationState, 'published');
    assert.equal(contract.executionEnabled, false);
    assert.equal(contract.executorState, 'unavailable');
    assert.equal(contract.registryArtifact.digest, digest);
    assert.deepEqual(validatePublishedPhase5ProfileContract(contract), contract);
    assert.throws(() => validatePublishedPhase5ProfileContract({ ...contract, executionEnabled: true }), /executionEnabled/);
  }
  assert.throws(() => createPublishedPhase5ProfileContract('hardhat-test-v1', { digest: 'latest', publishedAt }), /digest/);
  assert.throws(() => createPublishedPhase5ProfileContract('hardhat-test-v1', { digest, publishedAt: '2026-08-01' }), /publishedAt/);
});
