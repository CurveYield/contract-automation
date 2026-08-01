import {
  ApiContractError,
  canonicalJson,
  validateExternalValue
} from '../../audit-api-contracts/src/index.mjs';

export const AUDIT_CATALOG_COMPOSITION_VERSION = 'audit-catalog-composition-v1';
export const ACCEPTED_SOURCE_COMMITS = Object.freeze({
  phase5: '2982614879f1f6d252a7630eb5331031d5934b4e',
  phase6: '1b20f634b6d3c5f1261d490e545415c81d7488f2'
});

const PHASE4_IDENTITIES = Object.freeze([
  ['coverage-forge-v1', 'coverage-forge-parser-v1', 'coverage-forge-adapter-v1', 'forge', '1.7.1'],
  ['foundry-fuzz-v1', 'foundry-fuzz-parser-v1', 'foundry-fuzz-adapter-v1', 'forge', '1.7.1'],
  ['foundry-invariant-v1', 'foundry-invariant-parser-v1', 'foundry-invariant-adapter-v1', 'forge', '1.7.1'],
  ['foundry-test-v1', 'foundry-test-parser-v1', 'foundry-test-adapter-v1', 'forge', '1.7.1'],
  ['slither-v1', 'slither-parser-v1', 'slither-adapter-v1', 'slither', '0.11.5'],
  ['solidity-compile-v1', 'solidity-compile-parser-v1', 'solidity-compile-adapter-v1', 'solc', '0.8.30']
]);
const PHASE5_IDENTITIES = Object.freeze([
  ['dependency-scan-v1', 'dependency-scan-parser-v1', 'dependency-scan-adapter-v1', 'osv-scanner', '2.3.8'],
  ['echidna-v1', 'echidna-parser-v1', 'echidna-adapter-v1', 'echidna', '2.3.2'],
  ['hardhat-test-v1', 'hardhat-test-parser-v1', 'hardhat-test-adapter-v1', 'hardhat', '3.6.0'],
  ['mutation-v1', 'mutation-parser-v1', 'mutation-adapter-v1', 'gambit', '1.0.6']
]);
const PHASE6_IDENTITIES = Object.freeze([
  ['formal-obligations-v1', '0.2.0', null, 'curveyield-formal-obligations', '1.0.0'],
  ['halmos-v1', '0.2.0', null, 'halmos', '0.3.3'],
  ['solidity-smt-v1', '0.2.0', null, 'Solidity SMTChecker', '0.8.30']
]);

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function entry(phase, identity, sourceCommit = null) {
  const [profileId, parserVersion, adapterVersion, toolName, toolVersion] = identity;
  return {
    schemaVersion: 'audit-tool-profile-summary-v1',
    phase,
    profileId,
    parserVersion,
    adapterVersion,
    toolName,
    toolVersion,
    publicationState: 'unpublished',
    digestRequired: true,
    digest: null,
    publishedAt: null,
    runnable: false,
    executionEnabled: false,
    executorState: 'unavailable',
    sourcePackage: phase === 4
      ? '@curveyield/audit-tool-catalog'
      : `@curveyield/audit-phase${phase}-tool-catalog`,
    sourceCommit
  };
}

const EXPECTED_PHASE4 = PHASE4_IDENTITIES.map((identity) => entry(4, identity));
const EXPECTED_PHASE5 = PHASE5_IDENTITIES.map((identity) => entry(5, identity, ACCEPTED_SOURCE_COMMITS.phase5));
const EXPECTED_PHASE6 = PHASE6_IDENTITIES.map((identity) => entry(6, identity, ACCEPTED_SOURCE_COMMITS.phase6));
const EXPECTED_ALL = [...EXPECTED_PHASE4, ...EXPECTED_PHASE5, ...EXPECTED_PHASE6];

function mismatch(path = '$') {
  throw new ApiContractError(
    'catalog_identity_mismatch',
    'Catalog identity does not match the accepted interface',
    path
  );
}

function exactPhase4Input(profiles) {
  let safe;
  try { safe = validateExternalValue(profiles, '$.phase4Profiles'); }
  catch { mismatch('$.phase4Profiles'); }
  if (!Array.isArray(safe) || safe.length !== PHASE4_IDENTITIES.length) mismatch('$.phase4Profiles');
  const sorted = [...safe].sort((left, right) => String(left?.profileId).localeCompare(String(right?.profileId)));
  sorted.forEach((profile, index) => {
    const [profileId, parserVersion, adapterVersion, toolName, toolVersion] = PHASE4_IDENTITIES[index];
    if (
      profile?.profileId !== profileId ||
      profile?.parserVersion !== parserVersion ||
      profile?.adapterVersion !== adapterVersion ||
      profile?.tool?.name !== toolName ||
      profile?.tool?.version !== toolVersion ||
      profile?.publicationState !== 'unpublished' ||
      profile?.digestRequired !== true ||
      profile?.runnable !== false ||
      profile?.executionEnabled !== false ||
      profile?.executorState !== 'unavailable'
    ) mismatch(`$.phase4Profiles[${index}]`);
  });
}

export function createAcceptedPhase5Catalog() {
  return freeze(structuredClone(EXPECTED_PHASE5));
}

export function createAcceptedPhase6Catalog() {
  return freeze(structuredClone(EXPECTED_PHASE6));
}

export function createAuditCatalogComposition({ phase4Profiles }) {
  exactPhase4Input(phase4Profiles);
  return freeze({
    schemaVersion: AUDIT_CATALOG_COMPOSITION_VERSION,
    entries: structuredClone(EXPECTED_ALL)
  });
}

export function validateAuditCatalogComposition(value) {
  let safe;
  try { safe = validateExternalValue(value, '$.catalog'); }
  catch { mismatch('$.catalog'); }
  const expected = freeze({
    schemaVersion: AUDIT_CATALOG_COMPOSITION_VERSION,
    entries: structuredClone(EXPECTED_ALL)
  });
  if (canonicalJson(safe) !== canonicalJson(expected)) mismatch('$.catalog');
  return expected;
}

export function createAggregateAuditCapabilities({
  catalog,
  basePhases = {},
  phase4ResultContracts = false,
  phase7Available = false,
  phase8Available = false
}) {
  const accepted = validateAuditCatalogComposition(catalog);
  const counts = new Map();
  for (const profile of accepted.entries) {
    counts.set(profile.phase, (counts.get(profile.phase) ?? 0) + 1);
  }
  return freeze({
    schemaVersion: 'audit-aggregate-capabilities-v1',
    service: 'curveyield-audit',
    apiVersion: 'audit-v1',
    phases: {
      phase1: { available: basePhases.phase1 === true },
      phase2: { available: basePhases.phase2 === true },
      phase3: { available: basePhases.phase3 === true },
      phase4: {
        available: true,
        catalog: counts.get(4) === 6,
        resultContracts: phase4ResultContracts === true
      },
      phase5: {
        available: false,
        catalog: counts.get(5) === 4,
        acceptedInterfaceCommit: ACCEPTED_SOURCE_COMMITS.phase5
      },
      phase6: {
        available: false,
        catalog: counts.get(6) === 3,
        acceptedInterfaceCommit: ACCEPTED_SOURCE_COMMITS.phase6
      },
      phase7: { available: phase7Available === true },
      phase8: { available: phase8Available === true }
    },
    executionEnabled: false,
    executionState: 'awaiting_executor',
    executorState: 'unavailable'
  });
}
