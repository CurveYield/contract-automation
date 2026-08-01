import {
  ValidationError,
  assertProfileId,
  scanAuditForbiddenFields
} from '../../audit-protocol/src/index.mjs';

const MAX_UINT32 = 4_294_967_295;
const RETRIEVED_ON = '2026-08-01';
const TEST_MODES = new Set(['property', 'assertion', 'foundry', 'overflow', 'optimization', 'exploration']);
const MUTATION_OPERATORS = new Set([
  'binary-op-mutation',
  'unary-operator-mutation',
  'require-mutation',
  'assignment-mutation',
  'delete-expression-mutation',
  'if-cond-mutation',
  'swap-arguments-operator-mutation',
  'elim-delegate-mutation'
]);
const SEVERITIES = new Set(['low', 'moderate', 'high', 'critical']);
const LOCKFILE_NAMES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml',
  'bun.lock', 'bun.lockb', 'Cargo.lock', 'go.sum', 'requirements.txt',
  'poetry.lock', 'Pipfile.lock', 'Gemfile.lock', 'composer.lock'
]);

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
  resourcePolicy,
  seedPolicy,
  timeoutContract,
  evidenceContract,
  artifactContract,
  configurationFields,
  fixedRuntimeContract = {}
}) {
  return deepFreeze({
    schemaVersion: 'phase5-tool-profile-template-v1',
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
    resourcePolicy,
    networkPolicy: {
      policyId: 'audit-network-deny-v1',
      mode: 'deny-all',
      allowedDestinations: []
    },
    seedPolicy,
    timeoutContract,
    cancellationContract: {
      policyId: 'cooperative-then-hard-stop-v1',
      requestedState: 'cancellation_requested',
      terminalState: 'cancelled',
      graceSeconds: 10,
      executionAvailable: false
    },
    evidenceContract,
    artifactContract,
    configurationFields,
    fixedRuntimeContract
  });
}

const tool = (name, version, releaseId, releaseCommit, officialSource) => ({
  name,
  version,
  releaseId,
  releaseCommit,
  officialSource,
  retrievedOn: RETRIEVED_ON
});

const resource = (policyId, cpuMillis, memoryBytes, outputBytes, processCount) => ({
  policyId,
  cpuMillis,
  memoryBytes,
  outputBytes,
  processCount
});

const timeout = (policyId, minimumSeconds, defaultSeconds, maximumSeconds) => ({
  policyId,
  minimumSeconds,
  defaultSeconds,
  maximumSeconds,
  terminalClassification: 'timeout'
});

const evidence = (schemaVersion, allowedTypes) => ({
  schemaVersion,
  allowedTypes,
  maximumEntries: 10_000,
  deterministicOrdering: true
});

const artifacts = (schemaVersion, allowedNames) => ({
  schemaVersion,
  allowedNames,
  maximumArtifacts: allowedNames.length,
  maximumArtifactBytes: 16_777_216,
  submittedPathsAllowed: false
});

export const PHASE5_PROFILE_IDS = Object.freeze([
  'hardhat-test-v1',
  'echidna-v1',
  'mutation-v1',
  'dependency-scan-v1'
]);

export const PHASE5_PROFILE_TEMPLATES = Object.freeze([
  template({
    profileId: 'hardhat-test-v1',
    registryRepository: 'ghcr.io/curveyield/audit-hardhat-test',
    tool: tool(
      'hardhat', '3.6.0', 'hardhat@3.6.0',
      'd6f606b4f3c47d6fa6de6cce83dd87b966bb425d',
      'https://github.com/NomicFoundation/hardhat/releases/tag/hardhat%403.6.0'
    ),
    adapterVersion: 'hardhat-test-adapter-v1',
    parserVersion: 'hardhat-test-parser-v1',
    programId: 'hardhat-test-json-v1',
    resourcePolicy: resource('audit-phase5-standard-2cpu-4g-v1', 3_600_000, 4_294_967_296, 16_777_216, 64),
    seedPolicy: { policyId: 'no-random-seed-v1', mode: 'none', deterministic: true },
    timeoutContract: timeout('hardhat-test-timeout-v1', 1, 600, 3_600),
    evidenceContract: evidence('phase5-hardhat-test-evidence-v1', ['test-case', 'failure-message', 'summary']),
    artifactContract: artifacts('phase5-hardhat-test-artifacts-v1', ['hardhat-test-result-v1.json', 'hardhat-test-stderr-v1.txt']),
    configurationFields: ['testFiles', 'grep', 'bail', 'parallel', 'concurrency'],
    fixedRuntimeContract: { compilationAllowed: false, submittedScriptsAllowed: false, packageInstallationAllowed: false }
  }),
  template({
    profileId: 'echidna-v1',
    registryRepository: 'ghcr.io/curveyield/audit-echidna',
    tool: tool(
      'echidna', '2.3.2', 'v2.3.2',
      '7cbb32f3ff558d8e0b6e249c199831915c971d76',
      'https://github.com/crytic/echidna/releases/tag/v2.3.2'
    ),
    adapterVersion: 'echidna-adapter-v1',
    parserVersion: 'echidna-parser-v1',
    programId: 'echidna-json-v1',
    resourcePolicy: resource('audit-phase5-intensive-4cpu-8g-v1', 14_400_000, 8_589_934_592, 33_554_432, 128),
    seedPolicy: { policyId: 'explicit-uint32-seed-v1', mode: 'required', minimum: 0, maximum: MAX_UINT32, deterministic: true },
    timeoutContract: timeout('echidna-timeout-v1', 1, 1_800, 7_200),
    evidenceContract: evidence('phase5-echidna-evidence-v1', ['property', 'counterexample', 'campaign-summary']),
    artifactContract: artifacts('phase5-echidna-artifacts-v1', ['echidna-result-v1.json', 'echidna-counterexamples-v1.json']),
    configurationFields: ['testMode', 'testLimit', 'sequenceLength', 'shrinkLimit', 'seed', 'workers'],
    fixedRuntimeContract: { outputFormat: 'json', corpusWritesAllowed: false, networkStateAllowed: false }
  }),
  template({
    profileId: 'mutation-v1',
    registryRepository: 'ghcr.io/curveyield/audit-gambit-mutation',
    tool: tool(
      'gambit', '1.0.6', 'v1.0.6',
      '072ff4c6d747397f859e0a15a20fe1ff05672332',
      'https://github.com/Certora/gambit/releases/tag/v1.0.6'
    ),
    adapterVersion: 'mutation-adapter-v1',
    parserVersion: 'mutation-parser-v1',
    programId: 'gambit-mutation-harness-v1',
    resourcePolicy: resource('audit-phase5-intensive-4cpu-8g-v1', 14_400_000, 8_589_934_592, 33_554_432, 128),
    seedPolicy: { policyId: 'explicit-uint32-seed-default-zero-v1', mode: 'required', minimum: 0, maximum: MAX_UINT32, default: 0, deterministic: true },
    timeoutContract: timeout('mutation-timeout-v1', 1, 1_800, 7_200),
    evidenceContract: evidence('phase5-mutation-evidence-v1', ['mutant', 'kill', 'survivor', 'mutation-summary']),
    artifactContract: artifacts('phase5-mutation-artifacts-v1', ['mutation-result-v1.json', 'mutation-manifest-v1.json']),
    configurationFields: ['sourceFiles', 'mutationOperators', 'maxMutants', 'seed', 'validateMutants'],
    fixedRuntimeContract: { testHarnessProfileId: 'hardhat-test-v1', randomSamplingAllowed: false, sourceMutationPersistenceAllowed: false }
  }),
  template({
    profileId: 'dependency-scan-v1',
    registryRepository: 'ghcr.io/curveyield/audit-osv-scanner',
    tool: tool(
      'osv-scanner', '2.3.8', 'v2.3.8',
      '408fcd6f8707999a29e7ba45e15809764cf24f67',
      'https://github.com/google/osv-scanner/releases/tag/v2.3.8'
    ),
    adapterVersion: 'dependency-scan-adapter-v1',
    parserVersion: 'dependency-scan-parser-v1',
    programId: 'osv-scanner-offline-json-v1',
    resourcePolicy: resource('audit-phase5-standard-2cpu-4g-v1', 3_600_000, 4_294_967_296, 33_554_432, 64),
    seedPolicy: { policyId: 'no-random-seed-v1', mode: 'none', deterministic: true },
    timeoutContract: timeout('dependency-scan-timeout-v1', 1, 300, 1_800),
    evidenceContract: evidence('phase5-dependency-scan-evidence-v1', ['package', 'vulnerability', 'scan-summary']),
    artifactContract: artifacts('phase5-dependency-scan-artifacts-v1', ['dependency-scan-result-v1.json', 'advisory-snapshot-manifest-v1.json']),
    configurationFields: ['lockfiles', 'includeDevDependencies', 'minimumSeverity', 'failOnFindings'],
    fixedRuntimeContract: { advisoryMode: 'offline-snapshot', packageInstallationAllowed: false, lockfileMutationAllowed: false }
  })
]);

const TEMPLATE_BY_ID = new Map(PHASE5_PROFILE_TEMPLATES.map((item) => [item.profileId, item]));

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

function boundedString(value, path, maximum, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0) || /[\u0000-\u001f]/.test(value)) {
    throw new ValidationError('invalid_string', `${path} is invalid`, path);
  }
  return value;
}

function safeRelativePath(value, path, suffixes) {
  boundedString(value, path, 512, false);
  if (
    value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.includes('\\') ||
    value.split('/').includes('..') || value.includes('//') ||
    !/^[A-Za-z0-9_.{}*?\[\],@+\/-]+$/.test(value) ||
    !suffixes.some((suffix) => value.endsWith(suffix))
  ) {
    throw new ValidationError('invalid_path', `${path} must be a safe allowlisted relative file`, path);
  }
  return value;
}

function uniqueArray(value, path, validator, maximum = 64) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    throw new ValidationError('invalid_array', `${path} must contain 1 to ${maximum} entries`, path);
  }
  const seen = new Set();
  return value.map((item, index) => {
    const checked = validator(item, `${path}[${index}]`);
    const key = JSON.stringify(checked);
    if (seen.has(key)) throw new ValidationError('duplicate_array_item', `${path}[${index}] is duplicated`, `${path}[${index}]`);
    seen.add(key);
    return checked;
  });
}

function knownProfile(profileId) {
  assertProfileId(profileId);
  const templateValue = TEMPLATE_BY_ID.get(profileId);
  if (!templateValue) throw new ValidationError('unknown_profile_id', `Unsupported Phase 5 profileId: ${profileId}`, '$.profileId');
  return templateValue;
}

export function getPhase5ProfileTemplate(profileId) {
  return knownProfile(profileId);
}

export function validatePhase5ProfileConfiguration(profileId, configuration) {
  const profile = knownProfile(profileId);
  plainObject(configuration, '$.configuration');
  scanAuditForbiddenFields(configuration, '$.configuration');
  exactKeys(configuration, new Set(profile.configurationFields), '$.configuration');

  let result;
  switch (profileId) {
    case 'hardhat-test-v1':
      result = {
        testFiles: uniqueArray(configuration.testFiles, '$.configuration.testFiles', (item, path) => safeRelativePath(item, path, ['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts']), 32),
        grep: boundedString(configuration.grep, '$.configuration.grep', 160),
        bail: boolean(configuration.bail, '$.configuration.bail'),
        parallel: boolean(configuration.parallel, '$.configuration.parallel'),
        concurrency: integer(configuration.concurrency, '$.configuration.concurrency', 1, 8)
      };
      if (!result.parallel && result.concurrency !== 1) {
        throw new ValidationError('invalid_concurrency', '$.configuration.concurrency must equal 1 when parallel is false', '$.configuration.concurrency');
      }
      break;
    case 'echidna-v1':
      result = {
        testMode: enumeration(configuration.testMode, '$.configuration.testMode', TEST_MODES),
        testLimit: integer(configuration.testLimit, '$.configuration.testLimit', 1, 1_000_000),
        sequenceLength: integer(configuration.sequenceLength, '$.configuration.sequenceLength', 1, 1_000),
        shrinkLimit: integer(configuration.shrinkLimit, '$.configuration.shrinkLimit', 0, 100_000),
        seed: integer(configuration.seed, '$.configuration.seed', 0, MAX_UINT32),
        workers: integer(configuration.workers, '$.configuration.workers', 1, 8)
      };
      break;
    case 'mutation-v1':
      result = {
        sourceFiles: uniqueArray(configuration.sourceFiles, '$.configuration.sourceFiles', (item, path) => safeRelativePath(item, path, ['.sol']), 64),
        mutationOperators: uniqueArray(configuration.mutationOperators, '$.configuration.mutationOperators', (item, path) => enumeration(item, path, MUTATION_OPERATORS), MUTATION_OPERATORS.size),
        maxMutants: integer(configuration.maxMutants, '$.configuration.maxMutants', 1, 10_000),
        seed: integer(configuration.seed, '$.configuration.seed', 0, MAX_UINT32),
        validateMutants: boolean(configuration.validateMutants, '$.configuration.validateMutants')
      };
      break;
    case 'dependency-scan-v1':
      result = {
        lockfiles: uniqueArray(configuration.lockfiles, '$.configuration.lockfiles', (item, path) => {
          const checked = safeRelativePath(item, path, [...LOCKFILE_NAMES]);
          const name = checked.split('/').at(-1);
          if (!LOCKFILE_NAMES.has(name)) throw new ValidationError('invalid_lockfile', `${path} is not an allowlisted lockfile`, path);
          return checked;
        }, 64),
        includeDevDependencies: boolean(configuration.includeDevDependencies, '$.configuration.includeDevDependencies'),
        minimumSeverity: enumeration(configuration.minimumSeverity, '$.configuration.minimumSeverity', SEVERITIES),
        failOnFindings: boolean(configuration.failOnFindings, '$.configuration.failOnFindings')
      };
      break;
    default:
      throw new ValidationError('unknown_profile_id', `Unsupported Phase 5 profileId: ${profileId}`, '$.profileId');
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

export function createPublishedPhase5ProfileContract(profileId, { digest, publishedAt }) {
  const source = knownProfile(profileId);
  return deepFreeze({
    ...structuredClone(source),
    schemaVersion: 'phase5-tool-profile-contract-v1',
    publicationState: 'published',
    digestRequired: false,
    executionEnabled: false,
    executorState: 'unavailable',
    registryArtifact: {
      repository: source.registryRepository,
      digest: immutableDigest(digest)
    },
    publishedAt: canonicalInstant(publishedAt)
  });
}

export function validatePublishedPhase5ProfileContract(value) {
  plainObject(value);
  scanAuditForbiddenFields(value);
  const source = knownProfile(value.profileId);
  exactKeys(value, new Set([...Object.keys(source), 'registryArtifact', 'publishedAt']));
  if (value.schemaVersion !== 'phase5-tool-profile-contract-v1') {
    throw new ValidationError('invalid_schema_version', '$.schemaVersion must be phase5-tool-profile-contract-v1', '$.schemaVersion');
  }
  if (value.publicationState !== 'published') throw new ValidationError('invalid_publication_state', '$.publicationState must be published', '$.publicationState');
  if (value.digestRequired !== false) throw new ValidationError('invalid_digest_state', '$.digestRequired must be false', '$.digestRequired');
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
    throw new ValidationError('invalid_registry_repository', '$.registryArtifact.repository does not match the template', '$.registryArtifact.repository');
  }
  immutableDigest(value.registryArtifact.digest, '$.registryArtifact.digest');
  canonicalInstant(value.publishedAt, '$.publishedAt');
  return deepFreeze(structuredClone(value));
}
