import { ValidationError, assertAuditId } from '../../audit-protocol/src/index.mjs';
import { getProfileTemplate, scanPhase4ForbiddenFields, validateProfileConfiguration, validatePublishedProfileContract } from '../../audit-tool-profile-contracts/src/index.mjs';
import { layerArchiveKey, workspaceSourceManifestKey } from '../../audit-workspace-protocol/src/index.mjs';
import { MAX_RAW_ARTIFACT_BYTES } from '../../audit-evidence/src/index.mjs';

export const INVOCATION_PLAN_SCHEMA_VERSION = 'executor-invocation-plan-v1';
const MAX_LAYERS = 32;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function clone(value) { return structuredClone(value); }
function plainObject(value, path = '$') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new ValidationError('invalid_type', `${path} must be a plain object`, path);
  return value;
}
function exactKeys(value, keys, path = '$') {
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  for (const key of keys) if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
}
function integer(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new ValidationError('invalid_integer', `${path} must be an integer from ${minimum} to ${maximum}`, path);
  return value;
}
function immutableDigest(value, path) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new ValidationError('invalid_digest', `${path} must be an immutable lowercase sha256 digest`, path);
  return value;
}
function tokenId(value, path = '$.cancellationTokenId') {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(value)) throw new ValidationError('invalid_token_id', `${path} must be a lowercase safe token identifier`, path);
  return value;
}
function validateLayerIds(value) {
  if (!Array.isArray(value) || value.length > MAX_LAYERS) throw new ValidationError('invalid_layers', `$.context.layerIds must contain at most ${MAX_LAYERS} layer IDs`, '$.context.layerIds');
  const seen = new Set();
  return value.map((item, index) => {
    assertAuditId(item, 'layer', `$.context.layerIds[${index}]`);
    if (seen.has(item)) throw new ValidationError('duplicate_layer', `$.context.layerIds[${index}] is duplicated`, `$.context.layerIds[${index}]`);
    seen.add(item);
    return item;
  });
}
function verbosityArguments(level) {
  return level === 0 ? [] : [`-${'v'.repeat(level)}`];
}
function argumentsFor(profileId, configuration) {
  switch (profileId) {
    case 'solidity-compile-v1':
      return ['--standard-json'];
    case 'foundry-test-v1': {
      const tokens = [
        'test', '--json', '--match-path', configuration.matchPath,
        ...verbosityArguments(configuration.verbosity)
      ];
      if (configuration.failFast) tokens.push('--fail-fast');
      return tokens;
    }
    case 'foundry-fuzz-v1':
      return [
        'test', '--json', '--fuzz-runs', String(configuration.runs),
        '--fuzz-seed', String(configuration.seed)
      ];
    case 'foundry-invariant-v1':
      return [
        'test', '--json', '--match-test', '^invariant_',
        '--fuzz-seed', String(configuration.seed)
      ];
    case 'slither-v1': {
      const tokens = [
        '.', '--json', '-', '--detect', configuration.detectors.join(',')
      ];
      if (configuration.excludeDependencies) tokens.push('--exclude-dependencies');
      if (configuration.filterPaths.length > 0) {
        tokens.push('--filter-paths', configuration.filterPaths.join(','));
      }
      return tokens;
    }
    case 'coverage-forge-v1': {
      const tokens = ['coverage', '--json'];
      for (const format of configuration.reportFormats) tokens.push('--report', format);
      tokens.push('--match-path', configuration.matchPath);
      if (configuration.includeLibraries) tokens.push('--include-libs');
      return tokens;
    }
    default:
      throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileIdentity.profileId');
  }
}
function normalizeContext(context, path = '$.context') {
  plainObject(context, path);
  scanPhase4ForbiddenFields(context, path);
  exactKeys(context, new Set(['workspaceId','layerIds','jobId','attemptId','timeoutSeconds','cancellationTokenId']), path);
  assertAuditId(context.workspaceId, 'workspace', `${path}.workspaceId`);
  assertAuditId(context.jobId, 'job', `${path}.jobId`);
  assertAuditId(context.attemptId, 'attempt', `${path}.attemptId`);
  return {
    workspaceId: context.workspaceId,
    layerIds: validateLayerIds(context.layerIds),
    jobId: context.jobId,
    attemptId: context.attemptId,
    timeoutSeconds: integer(context.timeoutSeconds, `${path}.timeoutSeconds`, 1, 86_400),
    cancellationTokenId: tokenId(context.cancellationTokenId, `${path}.cancellationTokenId`)
  };
}
function mountDescriptors(context) {
  return [
    {
      mountId: 'workspace-source-v1',
      sourceObjectKey: workspaceSourceManifestKey(context.workspaceId),
      targetPath: '/audit/input/source-manifest-v1.json',
      readOnly: true
    },
    ...context.layerIds.map((layerId, index) => ({
      mountId: `workspace-layer-${String(index + 1).padStart(8, '0')}`,
      sourceObjectKey: layerArchiveKey(context.workspaceId, layerId),
      targetPath: `/audit/input/layers/${String(index + 1).padStart(8, '0')}.tar.zst`,
      readOnly: true
    }))
  ];
}
function buildPlan(template, digest, configuration, context) {
  return {
    schemaVersion: INVOCATION_PLAN_SCHEMA_VERSION,
    profileIdentity: { profileId: template.profileId, profileVersion: template.profileVersion },
    immutableDigestIdentity: { registryRepository: template.registryRepository, digest },
    toolIdentity: clone(template.tool),
    adapterVersion: template.adapterVersion,
    parserVersion: template.parserVersion,
    programId: template.programId,
    orderedArguments: argumentsFor(template.profileId, configuration),
    profileConfiguration: configuration,
    contextIdentity: {
      workspaceId: context.workspaceId,
      layerIds: context.layerIds,
      jobId: context.jobId,
      attemptId: context.attemptId
    },
    policyIdentifiers: { resourcePolicyId: template.resourcePolicyId, networkPolicyId: template.networkPolicyId },
    mountDescriptors: mountDescriptors(context),
    artifactContract: {
      schemaVersion: template.artifactManifestVersion,
      collectionRoot: '/audit/output',
      destinationPrefix: `jobs/${context.jobId}/attempts/${context.attemptId}/outputs/`,
      maximumBytes: MAX_RAW_ARTIFACT_BYTES
    },
    evidenceContract: { schemaVersion: template.evidenceSchemaVersion },
    deterministicSeed: {
      policyId: template.seedPolicyId,
      value: Number.isSafeInteger(configuration.seed) ? configuration.seed : null
    },
    timeout: { policyId: template.timeoutPolicyId, seconds: context.timeoutSeconds },
    cancellation: { policyId: template.cancellationPolicyId, tokenId: context.cancellationTokenId, graceSeconds: 10 },
    executionEnabled: false,
    executorState: 'unavailable'
  };
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
    return result;
  }
  return value;
}
function assertCanonicalEqual(actual, expected) {
  if (JSON.stringify(canonicalize(actual)) !== JSON.stringify(canonicalize(expected))) {
    throw new ValidationError('noncanonical_plan', '$ does not match the deterministic invocation-plan contract', '$');
  }
}

export function createInvocationPlan(profileContract, configuration, context) {
  const profile = validatePublishedProfileContract(profileContract);
  if (profile.runnable !== true) throw new ValidationError('profile_not_runnable', '$.profileContract must be immutably published and runnable', '$.profileContract');
  const normalizedConfiguration = validateProfileConfiguration(profile.profileId, configuration);
  const normalizedContext = normalizeContext(context);
  return deepFreeze(buildPlan(profile, profile.registryArtifact.digest, normalizedConfiguration, normalizedContext));
}

export function validateInvocationPlan(value) {
  plainObject(value);
  scanPhase4ForbiddenFields(value);
  const keys = new Set([
    'schemaVersion','profileIdentity','immutableDigestIdentity','toolIdentity','adapterVersion','parserVersion','programId',
    'orderedArguments','profileConfiguration','contextIdentity','policyIdentifiers','mountDescriptors','artifactContract',
    'evidenceContract','deterministicSeed','timeout','cancellation','executionEnabled','executorState'
  ]);
  exactKeys(value, keys);
  if (value.schemaVersion !== INVOCATION_PLAN_SCHEMA_VERSION) throw new ValidationError('invalid_schema_version', `$.schemaVersion must be ${INVOCATION_PLAN_SCHEMA_VERSION}`, '$.schemaVersion');
  if (value.executionEnabled !== false) throw new ValidationError('execution_disabled', '$.executionEnabled must remain false', '$.executionEnabled');
  if (value.executorState !== 'unavailable') throw new ValidationError('executor_unavailable', '$.executorState must remain unavailable', '$.executorState');
  plainObject(value.profileIdentity, '$.profileIdentity');
  exactKeys(value.profileIdentity, new Set(['profileId','profileVersion']), '$.profileIdentity');
  const template = getProfileTemplate(value.profileIdentity.profileId);
  if (value.profileIdentity.profileVersion !== template.profileVersion) throw new ValidationError('invalid_profile_version', '$.profileIdentity.profileVersion does not match the registered template', '$.profileIdentity.profileVersion');
  plainObject(value.immutableDigestIdentity, '$.immutableDigestIdentity');
  exactKeys(value.immutableDigestIdentity, new Set(['registryRepository','digest']), '$.immutableDigestIdentity');
  if (value.immutableDigestIdentity.registryRepository !== template.registryRepository) throw new ValidationError('invalid_registry', '$.immutableDigestIdentity.registryRepository does not match the registered template', '$.immutableDigestIdentity.registryRepository');
  const digest = immutableDigest(value.immutableDigestIdentity.digest, '$.immutableDigestIdentity.digest');
  const configuration = validateProfileConfiguration(template.profileId, value.profileConfiguration);
  plainObject(value.contextIdentity, '$.contextIdentity');
  exactKeys(value.contextIdentity, new Set(['workspaceId','layerIds','jobId','attemptId']), '$.contextIdentity');
  plainObject(value.timeout, '$.timeout');
  exactKeys(value.timeout, new Set(['policyId','seconds']), '$.timeout');
  plainObject(value.cancellation, '$.cancellation');
  exactKeys(value.cancellation, new Set(['policyId','tokenId','graceSeconds']), '$.cancellation');
  const context = normalizeContext({
    workspaceId: value.contextIdentity.workspaceId,
    layerIds: value.contextIdentity.layerIds,
    jobId: value.contextIdentity.jobId,
    attemptId: value.contextIdentity.attemptId,
    timeoutSeconds: value.timeout.seconds,
    cancellationTokenId: value.cancellation.tokenId
  }, '$.contextIdentity');
  const expected = buildPlan(template, digest, configuration, context);
  assertCanonicalEqual(value, expected);
  return deepFreeze(clone(expected));
}

export function serializeInvocationPlan(plan) {
  return JSON.stringify(canonicalize(validateInvocationPlan(plan)));
}

export class ReferenceInvocationPlanRecorder {
  #plans = [];
  record(plan) {
    const validated = validateInvocationPlan(plan);
    const index = this.#plans.length;
    this.#plans.push(validated);
    return Object.freeze({ recorded: true, index });
  }
  recordedPlans() { return this.#plans.map((plan) => clone(plan)); }
}
