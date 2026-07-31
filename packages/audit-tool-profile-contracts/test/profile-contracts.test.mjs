import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE4_PROFILE_IDS,
  PHASE4_PROFILE_TEMPLATES,
  createPublishedProfileContract,
  getProfileTemplate,
  validateProfileConfiguration,
  validatePublishedProfileContract
} from '../src/index.mjs';

const digest = `sha256:${'a'.repeat(64)}`;

const validConfigurations = Object.freeze({
  'solidity-compile-v1': {
    compilerVersion: '0.8.30', optimizerEnabled: true, optimizerRuns: 200, evmVersion: 'cancun', viaIR: false
  },
  'foundry-test-v1': {
    matchPath: 'test/**/*.t.sol', verbosity: 3, failFast: false
  },
  'foundry-fuzz-v1': {
    runs: 1000, seed: 42, dictionaryWeight: 40, includeStorage: true
  },
  'foundry-invariant-v1': {
    runs: 256, depth: 64, seed: 42, failOnRevert: false, callOverride: false
  },
  'slither-v1': {
    detectors: ['reentrancy-eth', 'uninitialized-state'], excludeDependencies: true, filterPaths: ['lib/**', 'test/**']
  },
  'coverage-forge-v1': {
    reportFormats: ['summary', 'lcov'], matchPath: 'test/**/*.t.sol', includeLibraries: false
  }
});

test('publishes exactly six immutable Phase 4 profile templates in stable order', () => {
  assert.deepEqual(PHASE4_PROFILE_IDS, [
    'solidity-compile-v1',
    'foundry-test-v1',
    'foundry-fuzz-v1',
    'foundry-invariant-v1',
    'slither-v1',
    'coverage-forge-v1'
  ]);
  assert.equal(PHASE4_PROFILE_TEMPLATES.length, 6);
  for (const template of PHASE4_PROFILE_TEMPLATES) {
    assert.equal(template.schemaVersion, 'tool-profile-template-v1');
    assert.equal(template.publicationState, 'unpublished');
    assert.equal(template.executionEnabled, false);
    assert.equal(template.digestRequired, true);
    assert.match(template.registryRepository, /^ghcr\.io\/curveyield\/audit-[a-z0-9-]+$/);
    assert.equal('registryArtifact' in template, false);
  }
});

test('pins exact current-stack tool versions without ranges', () => {
  assert.deepEqual(getProfileTemplate('solidity-compile-v1').tool, { name: 'solc', version: '0.8.30' });
  for (const id of ['foundry-test-v1', 'foundry-fuzz-v1', 'foundry-invariant-v1', 'coverage-forge-v1']) {
    assert.deepEqual(getProfileTemplate(id).tool, { name: 'forge', version: '1.7.1' });
  }
  assert.deepEqual(getProfileTemplate('slither-v1').tool, { name: 'slither', version: '0.11.5' });
  for (const template of PHASE4_PROFILE_TEMPLATES) {
    assert.doesNotMatch(template.tool.version, /[<>=~^*xX]/);
  }
});

test('validates each allowlisted profile configuration and rejects unknown or forbidden fields', () => {
  for (const [profileId, configuration] of Object.entries(validConfigurations)) {
    assert.deepEqual(validateProfileConfiguration(profileId, configuration), configuration);
    assert.throws(() => validateProfileConfiguration(profileId, { ...configuration, extra: true }), /extra/);
    assert.throws(() => validateProfileConfiguration(profileId, { ...configuration, command: 'forge test' }), /command/);
    assert.throws(() => validateProfileConfiguration(profileId, { ...configuration, rpcUrl: 'https:\/\/rpc.invalid' }), /rpcUrl/);
  }
});

test('enforces exact compile, seed, fuzz, invariant, path, detector, and coverage bounds', () => {
  assert.throws(() => validateProfileConfiguration('solidity-compile-v1', { ...validConfigurations['solidity-compile-v1'], compilerVersion: '0.8.31' }), /compilerVersion/);
  assert.throws(() => validateProfileConfiguration('solidity-compile-v1', { ...validConfigurations['solidity-compile-v1'], optimizerRuns: 1_000_001 }), /optimizerRuns/);
  assert.throws(() => validateProfileConfiguration('foundry-test-v1', { ...validConfigurations['foundry-test-v1'], matchPath: '../test.t.sol' }), /matchPath/);
  assert.throws(() => validateProfileConfiguration('foundry-fuzz-v1', { ...validConfigurations['foundry-fuzz-v1'], seed: 4_294_967_296 }), /seed/);
  assert.throws(() => validateProfileConfiguration('foundry-fuzz-v1', { ...validConfigurations['foundry-fuzz-v1'], runs: 100_001 }), /runs/);
  assert.throws(() => validateProfileConfiguration('foundry-invariant-v1', { ...validConfigurations['foundry-invariant-v1'], depth: 1025 }), /depth/);
  assert.throws(() => validateProfileConfiguration('slither-v1', { ...validConfigurations['slither-v1'], detectors: ['made-up-detector'] }), /detectors/);
  assert.throws(() => validateProfileConfiguration('coverage-forge-v1', { ...validConfigurations['coverage-forge-v1'], reportFormats: ['html'] }), /reportFormats/);
});

test('requires a real immutable digest to create a published profile contract', () => {
  const publishedAt = '2026-07-31T12:00:00.000Z';
  const contract = createPublishedProfileContract('foundry-fuzz-v1', { digest, publishedAt });
  assert.equal(contract.schemaVersion, 'tool-profile-contract-v1');
  assert.equal(contract.publicationState, 'published');
  assert.equal(contract.executionEnabled, false);
  assert.deepEqual(contract.registryArtifact, {
    repository: 'ghcr.io/curveyield/audit-foundry-fuzz',
    digest
  });
  assert.deepEqual(validatePublishedProfileContract(contract), contract);
  assert.throws(() => createPublishedProfileContract('foundry-fuzz-v1', { digest: 'latest', publishedAt }), /digest/);
  assert.throws(() => createPublishedProfileContract('foundry-fuzz-v1', { digest, publishedAt: 'not-a-date' }), /publishedAt/);
});

test('published profile contracts remain non-runnable without the separately approved executor', () => {
  for (const profileId of PHASE4_PROFILE_IDS) {
    const contract = createPublishedProfileContract(profileId, { digest, publishedAt: '2026-07-31T12:00:00.000Z' });
    assert.equal(contract.executionEnabled, false);
    assert.equal(contract.executorState, 'unavailable');
    assert.throws(() => validatePublishedProfileContract({ ...contract, executionEnabled: true }), /executionEnabled/);
    assert.throws(() => validatePublishedProfileContract({ ...contract, executorState: 'ready' }), /executorState/);
  }
});

test('unknown profile IDs are rejected without fallback behavior', () => {
  assert.throws(() => getProfileTemplate('unknown-v1'), /profileId/);
  assert.throws(() => validateProfileConfiguration('unknown-v1', {}), /profileId/);
  assert.throws(() => createPublishedProfileContract('unknown-v1', { digest, publishedAt: '2026-07-31T12:00:00.000Z' }), /profileId/);
});
