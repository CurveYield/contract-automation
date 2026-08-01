import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE4_PROFILE_IDS,
  PHASE4_PROFILE_TEMPLATES,
  PHASE4_PROFILE_TEMPLATE_SCHEMA_VERSION,
  PHASE4_PROFILE_CONTRACT_SCHEMA_VERSION,
  PHASE4_TOOL_VERSIONS,
  createPublishedProfileContract,
  getProfileTemplate,
  validateProfileConfiguration,
  validatePublishedProfileContract
} from '../src/index.mjs';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const PUBLISHED_AT = '2026-08-01T10:00:00.000Z';

export const VALID_CONFIGURATIONS = Object.freeze({
  'solidity-compile-v1': Object.freeze({
    compilerVersion: '0.8.30', optimizerEnabled: true, optimizerRuns: 200, evmVersion: 'cancun', viaIR: false
  }),
  'foundry-test-v1': Object.freeze({ matchPath: 'test/**/*.t.sol', verbosity: 3, failFast: false }),
  'foundry-fuzz-v1': Object.freeze({ runs: 1000, seed: 42, dictionaryWeight: 40, includeStorage: true }),
  'foundry-invariant-v1': Object.freeze({ runs: 256, depth: 64, seed: 42, failOnRevert: false, callOverride: false }),
  'slither-v1': Object.freeze({
    detectors: Object.freeze(['reentrancy-eth', 'uninitialized-state']),
    excludeDependencies: true,
    filterPaths: Object.freeze(['lib/**', 'test/**'])
  }),
  'coverage-forge-v1': Object.freeze({
    reportFormats: Object.freeze(['summary', 'lcov']), matchPath: 'test/**/*.t.sol', includeLibraries: false
  })
});

test('exports exactly six stable immutable unpublished templates', () => {
  assert.deepEqual(PHASE4_PROFILE_IDS, [
    'solidity-compile-v1',
    'foundry-test-v1',
    'foundry-fuzz-v1',
    'foundry-invariant-v1',
    'slither-v1',
    'coverage-forge-v1'
  ]);
  assert.equal(PHASE4_PROFILE_TEMPLATES.length, 6);
  assert.equal(PHASE4_PROFILE_TEMPLATE_SCHEMA_VERSION, 'tool-profile-template-v1');
  assert.equal(PHASE4_PROFILE_CONTRACT_SCHEMA_VERSION, 'tool-profile-contract-v1');
  for (const profile of PHASE4_PROFILE_TEMPLATES) {
    assert.equal(profile.schemaVersion, PHASE4_PROFILE_TEMPLATE_SCHEMA_VERSION);
    assert.equal(profile.profileVersion, 1);
    assert.equal(profile.publicationState, 'unpublished');
    assert.equal(profile.runnable, false);
    assert.equal(profile.executionEnabled, false);
    assert.equal(profile.executorState, 'unavailable');
    assert.equal(profile.digestRequired, true);
    assert.equal('registryArtifact' in profile, false);
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.tool), true);
    assert.equal(Object.isFrozen(profile.configurationFields), true);
  }
});

test('pins exact tool versions without ranges or aliases', () => {
  assert.deepEqual(PHASE4_TOOL_VERSIONS, {
    solidity: '0.8.30',
    foundry: '1.7.1',
    slither: '0.11.5'
  });
  assert.deepEqual(getProfileTemplate('solidity-compile-v1').tool, { name: 'solc', version: '0.8.30' });
  for (const id of ['foundry-test-v1', 'foundry-fuzz-v1', 'foundry-invariant-v1', 'coverage-forge-v1']) {
    assert.deepEqual(getProfileTemplate(id).tool, { name: 'forge', version: '1.7.1' });
  }
  assert.deepEqual(getProfileTemplate('slither-v1').tool, { name: 'slither', version: '0.11.5' });
  for (const profile of PHASE4_PROFILE_TEMPLATES) assert.doesNotMatch(profile.tool.version, /[<>=~^*xX]/);
});

test('validates all six exact configuration allowlists deterministically', () => {
  for (const [profileId, configuration] of Object.entries(VALID_CONFIGURATIONS)) {
    const reordered = Object.fromEntries(Object.entries(configuration).reverse());
    const first = validateProfileConfiguration(profileId, configuration);
    const second = validateProfileConfiguration(profileId, reordered);
    assert.deepEqual(first, configuration);
    assert.deepEqual(second, configuration);
    assert.deepEqual(Object.keys(first), getProfileTemplate(profileId).configurationFields);
    assert.notEqual(first, configuration);
  }
});

test('rejects forbidden fields recursively inside arrays and objects', () => {
  const base = VALID_CONFIGURATIONS['slither-v1'];
  for (const forbiddenField of [
    'command', 'rpcUrl', 'credentials', 'transaction', 'networkDestination',
    'packageInstallation', 'filesystemMutation', 'processSpawn', 'signing'
  ]) {
    assert.throws(
      () => validateProfileConfiguration('slither-v1', {
        ...base,
        filterPaths: [{ nested: [{ [forbiddenField]: 'forbidden' }] }]
      }),
      (error) => error.code === 'forbidden_field' && error.path.endsWith(`.${forbiddenField}`)
    );
  }
});

test('rejects unknown, missing, unsafe, duplicate, and out-of-range configuration values', () => {
  assert.throws(() => validateProfileConfiguration('foundry-test-v1', { ...VALID_CONFIGURATIONS['foundry-test-v1'], extra: true }), /extra/);
  assert.throws(() => validateProfileConfiguration('foundry-test-v1', { matchPath: 'test/**', verbosity: 3 }), /failFast/);
  assert.throws(() => validateProfileConfiguration('solidity-compile-v1', { ...VALID_CONFIGURATIONS['solidity-compile-v1'], compilerVersion: '0.8.31' }), /compilerVersion/);
  assert.throws(() => validateProfileConfiguration('solidity-compile-v1', { ...VALID_CONFIGURATIONS['solidity-compile-v1'], optimizerRuns: 1_000_001 }), /optimizerRuns/);
  assert.throws(() => validateProfileConfiguration('foundry-test-v1', { ...VALID_CONFIGURATIONS['foundry-test-v1'], matchPath: '../test.t.sol' }), /matchPath/);
  assert.throws(() => validateProfileConfiguration('foundry-fuzz-v1', { ...VALID_CONFIGURATIONS['foundry-fuzz-v1'], seed: 4_294_967_296 }), /seed/);
  assert.throws(() => validateProfileConfiguration('foundry-invariant-v1', { ...VALID_CONFIGURATIONS['foundry-invariant-v1'], depth: 1025 }), /depth/);
  assert.throws(() => validateProfileConfiguration('slither-v1', { ...VALID_CONFIGURATIONS['slither-v1'], detectors: ['made-up'] }), /detectors/);
  assert.throws(() => validateProfileConfiguration('slither-v1', { ...VALID_CONFIGURATIONS['slither-v1'], detectors: ['reentrancy-eth', 'reentrancy-eth'] }), /duplicated/);
  assert.throws(() => validateProfileConfiguration('coverage-forge-v1', { ...VALID_CONFIGURATIONS['coverage-forge-v1'], reportFormats: ['html'] }), /reportFormats/);
  assert.throws(() => validateProfileConfiguration('coverage-forge-v1', { ...VALID_CONFIGURATIONS['coverage-forge-v1'], reportFormats: ['json'] }), /reportFormats/);
});

test('publishes only with a supplied real immutable digest and strict publication input', () => {
  const contract = createPublishedProfileContract('foundry-fuzz-v1', { digest: DIGEST, publishedAt: PUBLISHED_AT });
  assert.equal(contract.schemaVersion, PHASE4_PROFILE_CONTRACT_SCHEMA_VERSION);
  assert.equal(contract.publicationState, 'published');
  assert.equal(contract.runnable, true);
  assert.equal(contract.executionEnabled, false);
  assert.equal(contract.executorState, 'unavailable');
  assert.equal(contract.digestRequired, false);
  assert.deepEqual(contract.registryArtifact, {
    repository: 'ghcr.io/curveyield/audit-foundry-fuzz',
    digest: DIGEST
  });
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(Object.isFrozen(contract.registryArtifact), true);
  assert.deepEqual(validatePublishedProfileContract(contract), contract);
  assert.throws(() => createPublishedProfileContract('foundry-fuzz-v1', { digest: 'latest', publishedAt: PUBLISHED_AT }), /digest/);
  assert.throws(() => createPublishedProfileContract('foundry-fuzz-v1', { digest: `sha256:${'A'.repeat(64)}`, publishedAt: PUBLISHED_AT }), /digest/);
  assert.throws(() => createPublishedProfileContract('foundry-fuzz-v1', { digest: DIGEST, publishedAt: '2026-08-01' }), /publishedAt/);
  assert.throws(() => createPublishedProfileContract('foundry-fuzz-v1', { digest: DIGEST, publishedAt: PUBLISHED_AT, image: 'custom' }), /image/);
});

test('rejects all published-contract drift from the registered immutable template', () => {
  const contract = createPublishedProfileContract('slither-v1', { digest: DIGEST, publishedAt: PUBLISHED_AT });
  const mutations = [
    { tool: { name: 'slither', version: '0.11.6' } },
    { adapterVersion: 'slither-adapter-v2' },
    { parserVersion: 'slither-parser-v2' },
    { resourcePolicyId: 'other-policy-v1' },
    { networkPolicyId: 'audit-network-open-v1' },
    { executionEnabled: true },
    { executorState: 'ready' },
    { runnable: false },
    { registryArtifact: { ...contract.registryArtifact, repository: 'ghcr.io/other/image' } }
  ];
  for (const mutation of mutations) assert.throws(() => validatePublishedProfileContract({ ...contract, ...mutation }));
});

test('unknown profile IDs never fall back', () => {
  assert.throws(() => getProfileTemplate('unknown-v1'), /profileId/);
  assert.throws(() => validateProfileConfiguration('unknown-v1', {}), /profileId/);
  assert.throws(() => createPublishedProfileContract('unknown-v1', { digest: DIGEST, publishedAt: PUBLISHED_AT }), /profileId/);
});
