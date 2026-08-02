import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASE4_PROFILE_CATALOG } from '../../audit-tool-catalog/src/index.mjs';
import {
  ACCEPTED_PHASE78_INTERFACE,
  createAcceptedPhase6Catalog,
  createAcceptedPhase78ServiceCompatibility,
  createAggregateAuditCapabilities,
  createAuditCatalogComposition,
  validateAuditCatalogComposition,
  validatePhase78ServiceCompatibility
} from '../src/index.mjs';

const catalog = () => createAuditCatalogComposition({
  phase4Profiles: PHASE4_PROFILE_CATALOG.profiles
});

test('Round 3 catalog entries bind exact parser package, function, capture, result, and producer identities', () => {
  const composed = catalog();
  assert.equal(composed.schemaVersion, 'audit-catalog-composition-v2');
  assert.equal(composed.entries.length, 13);
  for (const entry of composed.entries) {
    for (const field of [
      'profileId', 'parserPackage', 'parserPackageVersion', 'parserFunction',
      'resultSchemaVersion', 'sourcePackage'
    ]) assert.equal(typeof entry[field], 'string', `${entry.profileId}.${field}`);
    assert.equal(entry.executionEnabled, false);
    assert.equal(entry.runnable, false);
    assert.equal(entry.executorState, 'unavailable');
  }
  assert.deepEqual(createAcceptedPhase6Catalog().map((entry) => ({
    profileId: entry.profileId,
    parserFunction: entry.parserFunction,
    captureSchemaVersion: entry.captureSchemaVersion,
    resultSchemaVersion: entry.resultSchemaVersion,
    trustedProducer: entry.trustedProducer
  })), [
    {
      profileId: 'formal-obligations-v1',
      parserFunction: 'parseFormalObligationsBytes',
      captureSchemaVersion: 'formal-obligations-capture-v1',
      resultSchemaVersion: 'formal-result-v1',
      trustedProducer: 'curveyield-formal-capture-producer-v1'
    },
    {
      profileId: 'halmos-v1',
      parserFunction: 'parseHalmosBytes',
      captureSchemaVersion: 'halmos-capture-v1',
      resultSchemaVersion: 'formal-result-v1',
      trustedProducer: 'curveyield-formal-capture-producer-v1'
    },
    {
      profileId: 'solidity-smt-v1',
      parserFunction: 'parseSoliditySmtBytes',
      captureSchemaVersion: 'solidity-smt-capture-v1',
      resultSchemaVersion: 'formal-result-v1',
      trustedProducer: 'curveyield-formal-capture-producer-v1'
    }
  ]);
  assert.deepEqual(validateAuditCatalogComposition(composed), composed);
});

test('every newly bound catalog identity field rejects one-field mutation', () => {
  for (const field of [
    'parserPackage', 'parserPackageVersion', 'parserFunction', 'captureSchemaVersion',
    'resultSchemaVersion', 'trustedProducer', 'sourceCommit'
  ]) {
    const mutated = structuredClone(catalog());
    mutated.entries.at(-1)[field] = 'mutated';
    assert.throws(
      () => validateAuditCatalogComposition(mutated),
      (error) => error.code === 'catalog_identity_mismatch'
    );
  }
});

test('Phase 7 and Phase 8 service discovery accepts only the exact transport-neutral compatibility record', () => {
  const compatibility = createAcceptedPhase78ServiceCompatibility();
  assert.deepEqual(compatibility, ACCEPTED_PHASE78_INTERFACE);
  assert.equal(compatibility.executionEnabled, false);
  assert.equal(compatibility.operationCount, 15);
  assert.ok(Object.isFrozen(compatibility));
  assert.deepEqual(validatePhase78ServiceCompatibility(compatibility), compatibility);
  for (const field of ['sourceCommit', 'indexBlobSha', 'serviceVersion', 'operationCount']) {
    const mutated = structuredClone(compatibility);
    mutated[field] = field === 'operationCount' ? 14 : 'wrong';
    assert.throws(
      () => validatePhase78ServiceCompatibility(mutated),
      (error) => error.code === 'phase78_compatibility_mismatch'
    );
  }
});

test('aggregate capabilities expose compatibility without allowing boolean or environment alias availability', () => {
  const capabilities = createAggregateAuditCapabilities({
    catalog: catalog(),
    phase7Available: true,
    phase8Available: true,
    basePhases: { phase1: true, phase2: true, phase3: true },
    env: { AUDIT_PHASE7_AVAILABLE: true, AUDIT_PHASE8_AVAILABLE: true }
  });
  assert.equal(capabilities.schemaVersion, 'audit-aggregate-capabilities-v2');
  assert.equal(capabilities.phases.phase7.available, false);
  assert.equal(capabilities.phases.phase8.available, false);
  assert.equal(capabilities.phases.phase7.serviceDiscovery, true);
  assert.equal(capabilities.phases.phase8.serviceDiscovery, true);
  assert.equal(capabilities.phases.phase7.sourceCommit, ACCEPTED_PHASE78_INTERFACE.sourceCommit);
  assert.equal(capabilities.executionEnabled, false);
  assert.equal(capabilities.executorState, 'unavailable');
});
