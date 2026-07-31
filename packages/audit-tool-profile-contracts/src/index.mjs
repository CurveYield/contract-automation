import {
  ValidationError,
  assertProfileId,
  scanAuditForbiddenFields
} from '../../audit-protocol/src/index.mjs';

const SOLC_VERSION = '0.8.30';
const FOUNDRY_VERSION = '1.7.1';
const SLITHER_VERSION = '0.11.5';
const MAX_UINT32 = 4_294_967_295;

const EVM_VERSIONS = new Set(['paris', 'shanghai', 'cancun']);
const SLITHER_DETECTORS = new Set([
  'arbitrary-send-eth',
  'controlled-delegatecall',
  'incorrect-equality',
  'naming-convention',
  'reentrancy-eth',
  'reentrancy-no-eth',
  'shadowing-state',
  'suicidal',
  'unchecked-transfer',
  'uninitialized-state'
]);
const COVERAGE_FORMATS = new Set(['summary', 'lcov', 'json']);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function template({
  profileId,
  registryRepository,
  tool,
  adapterVersion,
  parserVersion,
  programId,
  resourcePolicyId,
  seedPolicy,
  configurationFields
}) {
  return deepFreeze({
    schemaVersion: 'tool-profile-template-v1',
    profileId,
    publicationState: 'unpublished',
    executionEnabled: false,
    executorState: 'unavailable',
    registryRepository,
    digestRequired: true,
    tool,
    adapterVersion,
    parserVersion,
    programId,
    resourcePolicyId,
    networkPolicyId: 'audit-network-deny-v1',
    evidenceSchemaVersion: 'tool-evidence-v1',
    artifactManifestVersion: 'tool-artifacts-v1',
    seedPolicy,
    cancellationPolicyId: 'cooperative-then-hard-stop-v1',
    configurationFields
  });
}

export const PHASE4_PROFILE_IDS = Object.freeze([
  'solidity-compile-v1',
  'foundry-test-v1',
  'foundry-fuzz-v1',
  'foundry-invariant-v1',
  'slither-v1',
  'coverage-forge-v1'
]);

export const PHASE4_PROFILE_TEMPLATES = Object.freeze([
  template({
    profileId: 'solidity-compile-v1',
    registryRepository: 'ghcr.io/curveyield/audit-solidity-compile',
    tool: { name: 'solc', version: SOLC_VERSION },
    adapterVersion: 'solidity-compile-adapter-v1',
    parserVersion: 'solidity-compile-parser-v1',
    programId: 'solc-standard-json',
    resourcePolicyId: 'audit-standard-2cpu-4g-v1',
    seedPolicy: 'none-v1',
    configurationFields: ['compilerVersion', 'optimizerEnabled', 'optimizerRuns', 'evmVersion', 'viaIR']
  }),
  template({
    profileId: 'foundry-test-v1',
    registryRepository: 'ghcr.io/curveyield/audit-foundry-test',
    tool: { name: 'forge', version: FOUNDRY_VERSION },
    adapterVersion: 'foundry-test-adapter-v1',
    parserVersion: 'foundry-test-parser-v1',
    programId: 'forge-test-json',
    resourcePolicyId: 'audit-standard-2cpu-4g-v1',
    seedPolicy: 'none-v1',
    configurationFields: ['matchPath', 'verbosity', 'failFast']
  }),
  template({
    profileId: 'foundry-fuzz-v1',
    registryRepository: 'ghcr.io/curveyield/audit-foundry-fuzz',
    tool: { name: 'forge', version: FOUNDRY_VERSION },
    adapterVersion: 'foundry-fuzz-adapter-v1',
    parserVersion: 'foundry-fuzz-parser-v1',
    programId: 'forge-fuzz-json',
    resourcePolicyId: 'audit-standard-2cpu-4g-v1',
    seedPolicy: 'explicit-uint32-v1',
    configurationFields: ['runs', 'seed', 'dictionaryWeight', 'includeStorage']
  }),
  template({
    profileId: 'foundry-invariant-v1',
    registryRepository: 'ghcr.io/curveyield/audit-foundry-invariant',
    tool: { name: 'forge', version: FOUNDRY_VERSION },
    adapterVersion: 'foundry-invariant-adapter-v1',
    parserVersion: 'foundry-invariant-parser-v1',
    programId: 'forge-invariant-json',
    resourcePolicyId: 'audit-intensive-4cpu-8g-v1',
    seedPolicy: 'explicit-uint32-v1',
    configurationFields: ['runs', 'depth', 'seed', 'failOnRevert', 'callOverride']
  }),
  template({
    profileId: 'slither-v1',
    registryRepository: 'ghcr.io/curveyield/audit-slither',
    tool: { name: 'slither', version: SLITHER_VERSION },
    adapterVersion: 'slither-adapter-v1',
    parserVersion: 'slither-parser-v1',
    programId: 'slither-json',
    resourcePolicyId: 'audit-standard-2cpu-4g-v1',
    seedPolicy: 'none-v1',
    configurationFields: ['detectors', 'excludeDependencies', 'filterPaths']
  }),
  template({
    profileId: 'coverage-forge-v1',
    registryRepository: 'ghcr.io/curveyield/audit-coverage-forge',
    tool: { name: 'forge', version: FOUNDRY_VERSION },
    adapterVersion: 'coverage-forge-adapter-v1',
    parserVersion: 'coverage-forge-parser-v1',
    programId: 'forge-coverage-json',
    resourcePolicyId: 'audit-standard-2cpu-4g-v1',
    seedPolicy: 'none-v1',
    configurationFields: ['reportFormats', 'matchPath', 'includeLibraries']
  })
]);

const TEMPLATE_BY_ID = new Map(PHASE4_PROFILE_TEMPLATES.map((item) => [item.profileId, item]));

function plainObject(value, path = '$') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('invalid_type', `${path} must be an object`, path);
  }
}

function exactKeys(value, expected, path = '$') {
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  }
  for (const key of expected) {
    if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
  }
}

function boolean(value, path) {
  if (typeof value !== 'boolean') throw new ValidationError('invalid_boolean', `${path} must be a boolean`, path);
  return value;
}

function integer(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ValidationError('invalid_integer', `${path} must be an integer from ${minimum} to ${maximum}`, path);
  }
  return value;
}

function enumeration(value, path, allowed) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new ValidationError('invalid_enum', `${path} is not allowlisted`, path);
  }
  return value;
}

function safeRelativePattern(value, path) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 160 ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
    value.includes('..') ||
    value.includes('\\') ||
    /[\u0000-\u001f]/.test(value) ||
    !/^[A-Za-z0-9_.*?{}\[\],/+-]+$/.test(value)
  ) {
    throw new ValidationError('invalid_path_pattern', `${path} must be a safe relative pattern`, path);
  }
  return value;
}

function uniqueStringArray(value, path, allowedValues, maximum = 32) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    throw new ValidationError('invalid_array', `${path} must contain 1 to ${maximum} entries`, path);
  }
  const result = [];
  const seen = new Set();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (typeof item !== 'string' || !allowedValues.has(item)) {
      throw new ValidationError('invalid_array_item', `${itemPath} is not allowlisted`, itemPath);
    }
    if (seen.has(item)) throw new ValidationError('duplicate_array_item', `${itemPath} is duplicated`, itemPath);
    seen.add(item);
    result.push(item);
  });
  return result;
}

function pathArray(value, path) {
  if (!Array.isArray(value) || value.length > 32) {
    throw new ValidationError('invalid_array', `${path} must contain at most 32 entries`, path);
  }
  const seen = new Set();
  return value.map((item, index) => {
    const checked = safeRelativePattern(item, `${path}[${index}]`);
    if (seen.has(checked)) throw new ValidationError('duplicate_array_item', `${path}[${index}] is duplicated`, `${path}[${index}]`);
    seen.add(checked);
    return checked;
  });
}

function knownProfile(profileId) {
  assertProfileId(profileId);
  const found = TEMPLATE_BY_ID.get(profileId);
  if (!found) throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
  return found;
}

export function getProfileTemplate(profileId) {
  return knownProfile(profileId);
}

export function validateProfileConfiguration(profileId, configuration) {
  const profile = knownProfile(profileId);
  plainObject(configuration, '$.configuration');
  scanAuditForbiddenFields(configuration, '$.configuration');
  exactKeys(configuration, new Set(profile.configurationFields), '$.configuration');

  let result;
  switch (profileId) {
    case 'solidity-compile-v1':
      if (configuration.compilerVersion !== SOLC_VERSION) {
        throw new ValidationError('invalid_compiler_version', `$.configuration.compilerVersion must equal ${SOLC_VERSION}`, '$.configuration.compilerVersion');
      }
      result = {
        compilerVersion: configuration.compilerVersion,
        optimizerEnabled: boolean(configuration.optimizerEnabled, '$.configuration.optimizerEnabled'),
        optimizerRuns: integer(configuration.optimizerRuns, '$.configuration.optimizerRuns', 0, 1_000_000),
        evmVersion: enumeration(configuration.evmVersion, '$.configuration.evmVersion', EVM_VERSIONS),
        viaIR: boolean(configuration.viaIR, '$.configuration.viaIR')
      };
      break;
    case 'foundry-test-v1':
      result = {
        matchPath: safeRelativePattern(configuration.matchPath, '$.configuration.matchPath'),
        verbosity: integer(configuration.verbosity, '$.configuration.verbosity', 0, 4),
        failFast: boolean(configuration.failFast, '$.configuration.failFast')
      };
      break;
    case 'foundry-fuzz-v1':
      result = {
        runs: integer(configuration.runs, '$.configuration.runs', 1, 100_000),
        seed: integer(configuration.seed, '$.configuration.seed', 0, MAX_UINT32),
        dictionaryWeight: integer(configuration.dictionaryWeight, '$.configuration.dictionaryWeight', 0, 100),
        includeStorage: boolean(configuration.includeStorage, '$.configuration.includeStorage')
      };
      break;
    case 'foundry-invariant-v1':
      result = {
        runs: integer(configuration.runs, '$.configuration.runs', 1, 10_000),
        depth: integer(configuration.depth, '$.configuration.depth', 1, 1024),
        seed: integer(configuration.seed, '$.configuration.seed', 0, MAX_UINT32),
        failOnRevert: boolean(configuration.failOnRevert, '$.configuration.failOnRevert'),
        callOverride: boolean(configuration.callOverride, '$.configuration.callOverride')
      };
      break;
    case 'slither-v1':
      result = {
        detectors: uniqueStringArray(configuration.detectors, '$.configuration.detectors', SLITHER_DETECTORS),
        excludeDependencies: boolean(configuration.excludeDependencies, '$.configuration.excludeDependencies'),
        filterPaths: pathArray(configuration.filterPaths, '$.configuration.filterPaths')
      };
      break;
    case 'coverage-forge-v1':
      result = {
        reportFormats: uniqueStringArray(configuration.reportFormats, '$.configuration.reportFormats', COVERAGE_FORMATS, 3),
        matchPath: safeRelativePattern(configuration.matchPath, '$.configuration.matchPath'),
        includeLibraries: boolean(configuration.includeLibraries, '$.configuration.includeLibraries')
      };
      break;
    default:
      throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
  }
  return structuredClone(result);
}

function immutableDigest(value, path = '$.digest') {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new ValidationError('invalid_digest', `${path} must be an immutable sha256 digest`, path);
  }
  return value;
}

function canonicalInstant(value, path = '$.publishedAt') {
  if (typeof value !== 'string') throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO instant`, path);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO instant`, path);
  }
  return value;
}

export function createPublishedProfileContract(profileId, { digest, publishedAt }) {
  const source = knownProfile(profileId);
  const contract = {
    ...structuredClone(source),
    schemaVersion: 'tool-profile-contract-v1',
    publicationState: 'published',
    digestRequired: false,
    executionEnabled: false,
    executorState: 'unavailable',
    registryArtifact: {
      repository: source.registryRepository,
      digest: immutableDigest(digest)
    },
    publishedAt: canonicalInstant(publishedAt)
  };
  return deepFreeze(contract);
}

export function validatePublishedProfileContract(value) {
  plainObject(value);
  scanAuditForbiddenFields(value);
  const profileId = value.profileId;
  const source = knownProfile(profileId);
  const expectedKeys = new Set([
    ...Object.keys(source),
    'registryArtifact',
    'publishedAt'
  ]);
  exactKeys(value, expectedKeys);
  if (value.schemaVersion !== 'tool-profile-contract-v1') {
    throw new ValidationError('invalid_schema_version', '$.schemaVersion must be tool-profile-contract-v1', '$.schemaVersion');
  }
  if (value.publicationState !== 'published') throw new ValidationError('invalid_publication_state', '$.publicationState must be published', '$.publicationState');
  if (value.digestRequired !== false) throw new ValidationError('invalid_digest_state', '$.digestRequired must be false after publication', '$.digestRequired');
  if (value.executionEnabled !== false) throw new ValidationError('execution_disabled', '$.executionEnabled must remain false', '$.executionEnabled');
  if (value.executorState !== 'unavailable') throw new ValidationError('executor_unavailable', '$.executorState must remain unavailable', '$.executorState');

  for (const [key, expected] of Object.entries(source)) {
    if (['schemaVersion', 'publicationState', 'digestRequired'].includes(key)) continue;
    if (JSON.stringify(value[key]) !== JSON.stringify(expected)) {
      throw new ValidationError('immutable_profile_mismatch', `$.${key} does not match the registered template`, `$.${key}`);
    }
  }
  plainObject(value.registryArtifact, '$.registryArtifact');
  exactKeys(value.registryArtifact, new Set(['repository', 'digest']), '$.registryArtifact');
  if (value.registryArtifact.repository !== source.registryRepository) {
    throw new ValidationError('registry_mismatch', '$.registryArtifact.repository does not match the template', '$.registryArtifact.repository');
  }
  immutableDigest(value.registryArtifact.digest, '$.registryArtifact.digest');
  canonicalInstant(value.publishedAt);
  return structuredClone(value);
}
