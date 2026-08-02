import {
  ApiContractError,
  canonicalJson,
  validateExternalValue
} from '../../audit-api-contracts/src/index.mjs';

export const AUDIT_CATALOG_COMPOSITION_VERSION = 'audit-catalog-composition-v2';
export const ACCEPTED_SOURCE_COMMITS = Object.freeze({
  phase5: '2982614879f1f6d252a7630eb5331031d5934b4e',
  phase6: '1b20f634b6d3c5f1261d490e545415c81d7488f2'
});

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const PHASE4_IDENTITIES = freeze([
  ['coverage-forge-v1', 'coverage-forge-parser-v1', 'coverage-forge-adapter-v1', 'forge', '1.7.1'],
  ['foundry-fuzz-v1', 'foundry-fuzz-parser-v1', 'foundry-fuzz-adapter-v1', 'forge', '1.7.1'],
  ['foundry-invariant-v1', 'foundry-invariant-parser-v1', 'foundry-invariant-adapter-v1', 'forge', '1.7.1'],
  ['foundry-test-v1', 'foundry-test-parser-v1', 'foundry-test-adapter-v1', 'forge', '1.7.1'],
  ['slither-v1', 'slither-parser-v1', 'slither-adapter-v1', 'slither', '0.11.5'],
  ['solidity-compile-v1', 'solidity-compile-parser-v1', 'solidity-compile-adapter-v1', 'solc', '0.8.30']
]);
const PHASE5_IDENTITIES = freeze([
  ['dependency-scan-v1', 'dependency-scan-parser-v1', 'dependency-scan-adapter-v1', 'osv-scanner', '2.3.8'],
  ['echidna-v1', 'echidna-parser-v1', 'echidna-adapter-v1', 'echidna', '2.3.2'],
  ['hardhat-test-v1', 'hardhat-test-parser-v1', 'hardhat-test-adapter-v1', 'hardhat', '3.6.0'],
  ['mutation-v1', 'mutation-parser-v1', 'mutation-adapter-v1', 'gambit', '1.0.6']
]);
const PHASE6_IDENTITIES = freeze([
  ['formal-obligations-v1', '0.2.0', null, 'curveyield-formal-obligations', '1.0.0', 'parseFormalObligationsBytes', 'formal-obligations-capture-v1'],
  ['halmos-v1', '0.2.0', null, 'halmos', '0.3.3', 'parseHalmosBytes', 'halmos-capture-v1'],
  ['solidity-smt-v1', '0.2.0', null, 'Solidity SMTChecker', '0.8.30', 'parseSoliditySmtBytes', 'solidity-smt-capture-v1']
]);

function commonEntry({
  phase,
  profileId,
  parserVersion,
  adapterVersion,
  toolName,
  toolVersion,
  parserPackage,
  parserPackageVersion,
  parserFunction,
  captureSchemaVersion,
  resultSchemaVersion,
  evidenceSchemaVersion,
  trustedProducer,
  sourcePackage,
  sourceCommit
}) {
  return {
    schemaVersion: 'audit-tool-profile-summary-v2',
    phase,
    profileId,
    parserVersion,
    adapterVersion,
    toolName,
    toolVersion,
    parserPackage,
    parserPackageVersion,
    parserFunction,
    captureSchemaVersion,
    resultSchemaVersion,
    evidenceSchemaVersion,
    trustedProducer,
    publicationState: 'unpublished',
    digestRequired: true,
    digest: null,
    publishedAt: null,
    runnable: false,
    executionEnabled: false,
    executorState: 'unavailable',
    sourcePackage,
    sourceCommit
  };
}

const EXPECTED_PHASE4 = PHASE4_IDENTITIES.map((identity) => commonEntry({
  phase: 4,
  profileId: identity[0],
  parserVersion: identity[1],
  adapterVersion: identity[2],
  toolName: identity[3],
  toolVersion: identity[4],
  parserPackage: '@curveyield/audit-tool-parsers',
  parserPackageVersion: '0.4.0',
  parserFunction: 'parseToolOutput',
  captureSchemaVersion: 'parser-input-v1',
  resultSchemaVersion: 'tool-result-v1',
  evidenceSchemaVersion: 'tool-evidence-v1',
  trustedProducer: null,
  sourcePackage: '@curveyield/audit-tool-catalog',
  sourceCommit: null
}));

const EXPECTED_PHASE5 = PHASE5_IDENTITIES.map((identity) => commonEntry({
  phase: 5,
  profileId: identity[0],
  parserVersion: identity[1],
  adapterVersion: identity[2],
  toolName: identity[3],
  toolVersion: identity[4],
  parserPackage: '@curveyield/audit-phase5-parsers',
  parserPackageVersion: '1.0.0',
  parserFunction: 'parsePhase5ToolResult',
  captureSchemaVersion: null,
  resultSchemaVersion: 'phase5-tool-result-v1',
  evidenceSchemaVersion: 'phase5-parser-evidence-v1',
  trustedProducer: null,
  sourcePackage: '@curveyield/audit-phase5-tool-catalog',
  sourceCommit: ACCEPTED_SOURCE_COMMITS.phase5
}));

const EXPECTED_PHASE6 = PHASE6_IDENTITIES.map((identity) => commonEntry({
  phase: 6,
  profileId: identity[0],
  parserVersion: identity[1],
  adapterVersion: identity[2],
  toolName: identity[3],
  toolVersion: identity[4],
  parserPackage: '@curveyield/audit-phase6-parsers',
  parserPackageVersion: '0.2.0',
  parserFunction: identity[5],
  captureSchemaVersion: identity[6],
  resultSchemaVersion: 'formal-result-v1',
  evidenceSchemaVersion: 'formal-evidence-v1',
  trustedProducer: 'curveyield-formal-capture-producer-v1',
  sourcePackage: '@curveyield/audit-phase6-tool-catalog',
  sourceCommit: ACCEPTED_SOURCE_COMMITS.phase6
}));

const EXPECTED_ALL = freeze([...EXPECTED_PHASE4, ...EXPECTED_PHASE5, ...EXPECTED_PHASE6]);

export const ACCEPTED_PHASE78_INTERFACE = freeze({
  schemaVersion: 'audit-phase78-service-compatibility-v1',
  servicePackage: '@curveyield/audit-phase78-service',
  serviceVersion: '0.1.0',
  sourceCommit: '13af0c6c6c3d74ceacdc1894d6f3146460884fb4',
  indexBlobSha: 'd23b4922f8209b5829618b4d9a4174f3b5849be9',
  constantsBlobSha: '8f8ae95fb8a6b582aa8d91af3183bf5fbbadc79a',
  operationCount: 15,
  operations: [
    'campaign.create', 'campaign.read', 'fork.action', 'fork.checkpoint', 'fork.create',
    'fork.delete', 'fork.export', 'fork.read', 'merge.create', 'merge.read',
    'provenance.read', 'report.publish', 'report.read', 'share.create', 'share.revoke'
  ],
  phase7ServiceDiscovery: true,
  phase8ServiceDiscovery: true,
  storageInternalsImported: false,
  executionEnabled: false,
  executorState: 'unavailable'
});

function catalogMismatch(path = '$') {
  throw new ApiContractError(
    'catalog_identity_mismatch',
    'Catalog identity does not match the accepted interface',
    path
  );
}

function exactPhase4Input(profiles) {
  let safe;
  try { safe = validateExternalValue(profiles, '$.phase4Profiles'); }
  catch { catalogMismatch('$.phase4Profiles'); }
  if (!Array.isArray(safe) || safe.length !== PHASE4_IDENTITIES.length) catalogMismatch('$.phase4Profiles');
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
    ) catalogMismatch(`$.phase4Profiles[${index}]`);
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
  catch { catalogMismatch('$.catalog'); }
  const expected = freeze({
    schemaVersion: AUDIT_CATALOG_COMPOSITION_VERSION,
    entries: structuredClone(EXPECTED_ALL)
  });
  if (canonicalJson(safe) !== canonicalJson(expected)) catalogMismatch('$.catalog');
  return expected;
}

export function createAcceptedPhase78ServiceCompatibility() {
  return freeze(structuredClone(ACCEPTED_PHASE78_INTERFACE));
}

export function validatePhase78ServiceCompatibility(value) {
  let safe;
  try { safe = validateExternalValue(value, '$.phase78Compatibility'); }
  catch {
    throw new ApiContractError(
      'phase78_compatibility_mismatch',
      'Phase 7–8 service compatibility is invalid',
      '$.phase78Compatibility'
    );
  }
  if (canonicalJson(safe) !== canonicalJson(ACCEPTED_PHASE78_INTERFACE)) {
    throw new ApiContractError(
      'phase78_compatibility_mismatch',
      'Phase 7–8 service compatibility is invalid',
      '$.phase78Compatibility'
    );
  }
  return createAcceptedPhase78ServiceCompatibility();
}

export function createAggregateAuditCapabilities({
  catalog,
  legacyCapabilities = null,
  phase4ResultContracts = false,
  phase78Compatibility = ACCEPTED_PHASE78_INTERFACE
}) {
  const accepted = validateAuditCatalogComposition(catalog);
  const compatibility = validatePhase78ServiceCompatibility(phase78Compatibility);
  const counts = new Map();
  for (const profile of accepted.entries) counts.set(profile.phase, (counts.get(profile.phase) ?? 0) + 1);
  const legacy = legacyCapabilities && typeof legacyCapabilities === 'object'
    ? validateExternalValue(legacyCapabilities, '$.legacyCapabilities')
    : {};
  const legacyIdentity = legacy.service === 'curveyield-audit' && legacy.apiVersion === 'audit-v1';
  const phaseNumber = legacyIdentity && Number.isSafeInteger(legacy.phase) ? legacy.phase : 0;
  return freeze({
    schemaVersion: 'audit-aggregate-capabilities-v2',
    service: 'curveyield-audit',
    apiVersion: 'audit-v1',
    phases: {
      phase1: { available: phaseNumber >= 1 },
      phase2: { available: phaseNumber >= 2 },
      phase3: { available: phaseNumber >= 3 },
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
      phase7: {
        available: false,
        serviceDiscovery: compatibility.phase7ServiceDiscovery,
        sourceCommit: compatibility.sourceCommit,
        serviceVersion: compatibility.serviceVersion
      },
      phase8: {
        available: false,
        serviceDiscovery: compatibility.phase8ServiceDiscovery,
        sourceCommit: compatibility.sourceCommit,
        serviceVersion: compatibility.serviceVersion
      }
    },
    executionEnabled: false,
    executionState: 'awaiting_executor',
    executorState: 'unavailable'
  });
}
