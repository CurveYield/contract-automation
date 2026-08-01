import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEPTED_SOURCE_COMMITS,
  createAcceptedPhase5Catalog,
  createAcceptedPhase6Catalog,
  createAggregateAuditCapabilities,
  createAuditCatalogComposition,
  validateAuditCatalogComposition
} from '../src/index.mjs';

const phase4Profiles = [
  ['coverage-forge-v1', 'coverage-forge-parser-v1', 'coverage-forge-adapter-v1', 'forge', '1.7.1'],
  ['foundry-fuzz-v1', 'foundry-fuzz-parser-v1', 'foundry-fuzz-adapter-v1', 'forge', '1.7.1'],
  ['foundry-invariant-v1', 'foundry-invariant-parser-v1', 'foundry-invariant-adapter-v1', 'forge', '1.7.1'],
  ['foundry-test-v1', 'foundry-test-parser-v1', 'foundry-test-adapter-v1', 'forge', '1.7.1'],
  ['slither-v1', 'slither-parser-v1', 'slither-adapter-v1', 'slither', '0.11.5'],
  ['solidity-compile-v1', 'solidity-compile-parser-v1', 'solidity-compile-adapter-v1', 'solc', '0.8.30']
].map(([profileId, parserVersion, adapterVersion, toolName, toolVersion]) => ({
  profileId,
  parserVersion,
  adapterVersion,
  tool: { name: toolName, version: toolVersion },
  publicationState: 'unpublished',
  digestRequired: true,
  runnable: false,
  executionEnabled: false,
  executorState: 'unavailable'
}));

test('accepted Phase 5 and Phase 6 snapshots preserve exact pinned interface identity', () => {
  assert.deepEqual(ACCEPTED_SOURCE_COMMITS, {
    phase5: '2982614879f1f6d252a7630eb5331031d5934b4e',
    phase6: '1b20f634b6d3c5f1261d490e545415c81d7488f2'
  });
  const phase5 = createAcceptedPhase5Catalog();
  assert.deepEqual(phase5.map((value) => [
    value.profileId,
    value.parserVersion,
    value.adapterVersion,
    value.toolName,
    value.toolVersion
  ]), [
    ['dependency-scan-v1', 'dependency-scan-parser-v1', 'dependency-scan-adapter-v1', 'osv-scanner', '2.3.8'],
    ['echidna-v1', 'echidna-parser-v1', 'echidna-adapter-v1', 'echidna', '2.3.2'],
    ['hardhat-test-v1', 'hardhat-test-parser-v1', 'hardhat-test-adapter-v1', 'hardhat', '3.6.0'],
    ['mutation-v1', 'mutation-parser-v1', 'mutation-adapter-v1', 'gambit', '1.0.6']
  ]);
  const phase6 = createAcceptedPhase6Catalog();
  assert.deepEqual(phase6.map((value) => [
    value.profileId,
    value.parserVersion,
    value.toolName,
    value.toolVersion
  ]), [
    ['formal-obligations-v1', '0.2.0', 'curveyield-formal-obligations', '1.0.0'],
    ['halmos-v1', '0.2.0', 'halmos', '0.3.3'],
    ['solidity-smt-v1', '0.2.0', 'Solidity SMTChecker', '0.8.30']
  ]);
  for (const value of [...phase5, ...phase6]) {
    assert.equal(value.executionEnabled, false);
    assert.equal(value.runnable, false);
    assert.equal(value.executorState, 'unavailable');
    assert.ok(Object.isFrozen(value));
  }
});

test('Phase 4 through 6 composition has exact 13-profile membership and deterministic order', () => {
  const one = createAuditCatalogComposition({ phase4Profiles });
  const two = createAuditCatalogComposition({ phase4Profiles: [...phase4Profiles].reverse() });
  assert.equal(JSON.stringify(one), JSON.stringify(two));
  assert.equal(one.entries.length, 13);
  assert.deepEqual(one.entries.map((value) => value.phase), [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6]);
  assert.ok(Object.isFrozen(one));
  assert.deepEqual(validateAuditCatalogComposition(one), one);
});

test('one-field catalog identity mutations fail deterministically', () => {
  const catalog = structuredClone(createAuditCatalogComposition({ phase4Profiles }));
  for (const [field, value] of [
    ['parserVersion', 'wrong'],
    ['toolVersion', 'latest'],
    ['executionEnabled', true],
    ['runnable', true],
    ['executorState', 'available']
  ]) {
    const mutated = structuredClone(catalog);
    mutated.entries[0][field] = value;
    assert.throws(
      () => validateAuditCatalogComposition(mutated),
      (error) => error.code === 'catalog_identity_mismatch'
    );
  }
  const duplicate = structuredClone(catalog);
  duplicate.entries[1].profileId = duplicate.entries[0].profileId;
  assert.throws(
    () => validateAuditCatalogComposition(duplicate),
    (error) => error.code === 'catalog_identity_mismatch'
  );
});

test('aggregate capability truth is derived from validated server-owned catalogs only', () => {
  const catalog = createAuditCatalogComposition({ phase4Profiles });
  const capabilities = createAggregateAuditCapabilities({
    catalog,
    phase4ResultContracts: false,
    phase7Available: false,
    phase8Available: false,
    executionEnabled: true
  });
  assert.equal(capabilities.phases.phase4.catalog, true);
  assert.equal(capabilities.phases.phase5.catalog, true);
  assert.equal(capabilities.phases.phase6.catalog, true);
  assert.equal(capabilities.phases.phase7.available, false);
  assert.equal(capabilities.phases.phase8.available, false);
  assert.equal(capabilities.executionEnabled, false);
  assert.equal(capabilities.executorState, 'unavailable');
  assert.ok(Object.isFrozen(capabilities));
});
