import {
  ValidationError,
  assertAuditId,
  scanAuditForbiddenFields
} from '../../audit-protocol/src/index.mjs';
import {
  validateProfileConfiguration,
  validatePublishedProfileContract
} from '../../audit-tool-profile-contracts/src/index.mjs';
import {
  layerArchiveKey,
  workspaceSourceManifestKey
} from '../../audit-workspace-protocol/src/index.mjs';
import { MAX_RAW_ARTIFACT_BYTES } from '../../audit-evidence/src/index.mjs';

const MAX_LAYERS = 32;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function plainObject(value, path = '$') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('invalid_type', `${path} must be an object`, path);
  }
}

function exactKeys(value, keys, path = '$') {
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  }
  for (const key of keys) {
    if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
  }
}

function integer(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ValidationError('invalid_integer', `${path} must be from ${minimum} to ${maximum}`, path);
  }
  return value;
}

function tokenId(value, path = '$.cancellationTokenId') {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(value)) {
    throw new ValidationError('invalid_token_id', `${path} must be a lowercase safe token identifier`, path);
  }
  return value;
}

function layerIds(value, workspaceId) {
  if (!Array.isArray(value) || value.length > MAX_LAYERS) {
    throw new ValidationError('invalid_layers', `$.layerIds must contain at most ${MAX_LAYERS} layer IDs`, '$.layerIds');
  }
  const seen = new Set();
  return value.map((item, index) => {
    assertAuditId(item, 'layer', `$.layerIds[${index}]`);
    if (seen.has(item)) throw new ValidationError('duplicate_layer', `$.layerIds[${index}] is duplicated`, `$.layerIds[${index}]`);
    seen.add(item);
    return {
      sourceObjectKey: layerArchiveKey(workspaceId, item),
      targetPath: `/audit/input/layers/${String(index + 1).padStart(8, '0')}.tar.zst`,
      readOnly: true
    };
  });
}

function booleanToken(value) {
  return value ? 'true' : 'false';
}

function argumentsFor(profileId, configuration) {
  switch (profileId) {
    case 'solidity-compile-v1':
      return ['--standard-json'];
    case 'foundry-test-v1':
      return ['test', '--json', '--match-path', configuration.matchPath, '--verbosity', String(configuration.verbosity), '--fail-fast', booleanToken(configuration.failFast)];
    case 'foundry-fuzz-v1':
      return ['fuzz', '--json', '--runs', String(configuration.runs), '--seed', String(configuration.seed), '--dictionary-weight', String(configuration.dictionaryWeight), '--include-storage', booleanToken(configuration.includeStorage)];
    case 'foundry-invariant-v1':
      return ['invariant', '--json', '--runs', String(configuration.runs), '--depth', String(configuration.depth), '--seed', String(configuration.seed), '--fail-on-revert', booleanToken(configuration.failOnRevert), '--call-override', booleanToken(configuration.callOverride)];
    case 'slither-v1': {
      const result = ['analyze', '--json', '--detectors', configuration.detectors.join(','), '--exclude-dependencies', booleanToken(configuration.excludeDependencies)];
      for (const pattern of configuration.filterPaths) result.push('--filter-path', pattern);
      return result;
    }
    case 'coverage-forge-v1': {
      const result = ['coverage', '--json'];
      for (const format of configuration.reportFormats) result.push('--report', format);
      result.push('--match-path', configuration.matchPath, '--include-libraries', booleanToken(configuration.includeLibraries));
      return result;
    }
    default:
      throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
  }
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

export function serializeInvocationPlan(plan) {
  validateInvocationPlan(plan);
  return JSON.stringify(canonicalize(plan));
}

export function createInvocationPlan(profileContract, configuration, context) {
  const profile = validatePublishedProfileContract(profileContract);
  const normalizedConfiguration = validateProfileConfiguration(profile.profileId, configuration);
  plainObject(context, '$.context');
  scanAuditForbiddenFields(context, '$.context');
  exactKeys(context, new Set(['workspaceId', 'layerIds', 'jobId', 'attemptId', 'timeoutSeconds', 'cancellationTokenId']), '$.context');
  assertAuditId(context.workspaceId, 'workspace', '$.context.workspaceId');
  assertAuditId(context.jobId, 'job', '$.context.jobId');
  assertAuditId(context.attemptId, 'attempt', '$.context.attemptId');
  const inputs = [
    {
      sourceManifestKey: workspaceSourceManifestKey(context.workspaceId),
      targetPath: '/audit/input/source',
      readOnly: true
    },
    ...layerIds(context.layerIds, context.workspaceId)
  ];
  const plan = {
    schemaVersion: 'executor-invocation-plan-v1',
    profileId: profile.profileId,
    registryArtifact: structuredClone(profile.registryArtifact),
    programId: profile.programId,
    adapterVersion: profile.adapterVersion,
    parserVersion: profile.parserVersion,
    arguments: argumentsFor(profile.profileId, normalizedConfiguration),
    profileConfiguration: normalizedConfiguration,
    environmentPolicies: {
      resourcePolicyId: profile.resourcePolicyId,
      networkPolicyId: profile.networkPolicyId
    },
    mounts: {
      inputs,
      outputs: [
        {
          targetPath: '/audit/output',
          destinationPrefix: `jobs/${context.jobId}/attempts/${context.attemptId}/outputs/`,
          maximumBytes: MAX_RAW_ARTIFACT_BYTES
        }
      ]
    },
    evidenceContract: { schemaVersion: profile.evidenceSchemaVersion },
    artifactContract: { schemaVersion: profile.artifactManifestVersion, maximumBytes: MAX_RAW_ARTIFACT_BYTES },
    seed: Number.isSafeInteger(normalizedConfiguration.seed) ? normalizedConfiguration.seed : null,
    timeoutSeconds: integer(context.timeoutSeconds, '$.context.timeoutSeconds', 1, 86_400),
    cancellation: {
      policyId: profile.cancellationPolicyId,
      tokenId: tokenId(context.cancellationTokenId),
      graceSeconds: 10
    },
    executionEnabled: false,
    executorState: 'unavailable'
  };
  return deepFreeze(plan);
}

export function validateInvocationPlan(value) {
  plainObject(value);
  scanAuditForbiddenFields(value);
  const keys = new Set([
    'schemaVersion', 'profileId', 'registryArtifact', 'programId', 'adapterVersion', 'parserVersion',
    'arguments', 'profileConfiguration', 'environmentPolicies', 'mounts', 'evidenceContract',
    'artifactContract', 'seed', 'timeoutSeconds', 'cancellation', 'executionEnabled', 'executorState'
  ]);
  exactKeys(value, keys);
  if (value.schemaVersion !== 'executor-invocation-plan-v1') throw new ValidationError('invalid_schema_version', '$.schemaVersion must be executor-invocation-plan-v1', '$.schemaVersion');
  if (value.executionEnabled !== false) throw new ValidationError('execution_disabled', '$.executionEnabled must remain false', '$.executionEnabled');
  if (value.executorState !== 'unavailable') throw new ValidationError('executor_unavailable', '$.executorState must remain unavailable', '$.executorState');
  if (!Array.isArray(value.arguments) || value.arguments.length < 1 || value.arguments.length > 64 || value.arguments.some((item) => typeof item !== 'string' || item.length > 256)) {
    throw new ValidationError('invalid_arguments', '$.arguments must contain bounded string tokens', '$.arguments');
  }
  integer(value.timeoutSeconds, '$.timeoutSeconds', 1, 86_400);
  plainObject(value.registryArtifact, '$.registryArtifact');
  if (typeof value.registryArtifact.repository !== 'string' || !/^ghcr\.io\/curveyield\/audit-[a-z0-9-]+$/.test(value.registryArtifact.repository)) throw new ValidationError('invalid_registry', '$.registryArtifact.repository is invalid', '$.registryArtifact.repository');
  if (typeof value.registryArtifact.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value.registryArtifact.digest)) throw new ValidationError('invalid_digest', '$.registryArtifact.digest is invalid', '$.registryArtifact.digest');
  plainObject(value.mounts, '$.mounts');
  if (!Array.isArray(value.mounts.inputs) || !Array.isArray(value.mounts.outputs)) throw new ValidationError('invalid_mounts', '$.mounts is invalid', '$.mounts');
  plainObject(value.cancellation, '$.cancellation');
  tokenId(value.cancellation.tokenId, '$.cancellation.tokenId');
  return structuredClone(value);
}

export class InMemoryExecutorTransport {
  #plans = [];

  async submit(plan) {
    this.#plans.push(deepFreeze(validateInvocationPlan(plan)));
    return Object.freeze({ accepted: false, code: 'executor_unavailable', executorState: 'unavailable' });
  }

  recordedPlans() {
    return this.#plans.map((plan) => structuredClone(plan));
  }
}
