const defineContract = (required, optional = []) => Object.freeze({
  required: Object.freeze([...required]),
  optional: Object.freeze([...optional])
});

export const UI_ENTITY_KINDS = Object.freeze([
  'capability', 'catalogTool', 'workspace', 'campaign', 'job', 'evidence', 'report',
  'fork', 'checkpoint', 'export', 'cleanRoomCampaign', 'merge', 'provenance',
  'quota', 'retention', 'operationBudget', 'profile', 'parser', 'result',
  'githubDirectStatus', 'releaseProvenance', 'diagnostic'
]);

export const UI_CONTRACTS = Object.freeze({
  capability: defineContract(['id', 'name', 'available'], ['summary', 'reason', 'category', 'version']),
  catalogTool: defineContract(['id', 'name', 'available'], ['summary', 'capabilityIds', 'tags', 'profileId', 'parserId']),
  workspace: defineContract(['id', 'name', 'status'], ['campaigns', 'updatedAt', 'tenantId', 'quota']),
  campaign: defineContract(['id', 'name', 'status'], ['jobs', 'workspaceId', 'updatedAt', 'summary', 'admittedAt']),
  job: defineContract(['id', 'status'], ['campaignId', 'title', 'error', 'updatedAt', 'reportId', 'resourceLimit', 'timeoutAt', 'admittedAt']),
  evidence: defineContract(['id', 'title'], ['severity', 'url', 'summary', 'kind', 'visible', 'referenceId']),
  report: defineContract(['id', 'title', 'status'], ['createdAt', 'sourceUrl', 'evidence', 'summary', 'workspaceId', 'campaignId', 'jobId', 'references']),
  fork: defineContract(['id', 'status'], ['name', 'checkpoints', 'exports', 'exportStatus', 'restoreStatus', 'deleteStatus', 'tombstoneStatus', 'retentionExpiresAt', 'createdAt']),
  checkpoint: defineContract(['id', 'status'], ['createdAt', 'label', 'exportUrl', 'forkId']),
  export: defineContract(['id', 'status'], ['createdAt', 'label', 'url', 'checkpointId', 'forkId', 'sizeBytes']),
  cleanRoomCampaign: defineContract(['id', 'name', 'status'], ['merges', 'provenance', 'visibleResourceIds', 'accessStatus', 'shareStatus', 'updatedAt']),
  merge: defineContract(['id', 'status'], ['label', 'sourceIds', 'commitSha', 'visible', 'createdAt']),
  provenance: defineContract(['id', 'sourceType'], ['label', 'sourceId', 'commitSha', 'visible', 'reportId']),
  quota: defineContract(['id', 'remaining'], ['limit', 'used', 'resetsAt', 'scope']),
  retention: defineContract(['id', 'days'], ['expiresAt', 'policy', 'scope']),
  operationBudget: defineContract(['id', 'remaining'], ['limit', 'used', 'operation', 'scope']),
  profile: defineContract(['id', 'name', 'version'], ['available', 'summary', 'toolVersion', 'parserId']),
  parser: defineContract(['id', 'name', 'version'], ['available', 'summary', 'profileId']),
  result: defineContract(['id', 'status'], ['profileId', 'parserId', 'summary', 'reportId', 'createdAt', 'evidenceCount']),
  githubDirectStatus: defineContract(['id', 'status'], ['repository', 'targetSha', 'checkStatus', 'reportId', 'updatedAt', 'reason']),
  releaseProvenance: defineContract(['id', 'version'], ['candidateSha', 'startingSha', 'compatibilityVersions', 'createdAt', 'status']),
  diagnostic: defineContract(['code', 'message'], ['correlationId', 'retryAfterSeconds', 'quotaRemaining', 'retentionDays', 'publicationStatus', 'staleState', 'details', 'retryPlan', 'transportState', 'reportId'])
});

export const UI_ERROR_CODES = Object.freeze([
  'UI_CONTRACT_KIND', 'UI_CONTRACT_INPUT', 'UI_CONTRACT_UNKNOWN_KEY',
  'UI_CONTRACT_MISSING_KEY', 'UI_COMPAT_VERSION', 'UI_COMPAT_INPUT',
  'UI_CLIENT_UNSAFE_PATH', 'UI_CLIENT_ABORTED', 'UI_CLIENT_STALE_RESPONSE',
  'UI_CLIENT_TRANSPORT', 'UI_CLIENT_UNAUTHORIZED', 'UI_CLIENT_OFFLINE', 'UI_CLIENT_CACHE_MISS'
]);

export class UiContractError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = 'UiContractError';
    this.code = code;
  }
}

function safeArrayIsArray(value) {
  try { return Array.isArray(value); }
  catch { return false; }
}

function safeDescriptors(input) {
  try { return Object.getOwnPropertyDescriptors(input); }
  catch { return null; }
}

function isRecordLike(input) {
  return input !== null && typeof input === 'object' && !safeArrayIsArray(input) && safeDescriptors(input) !== null;
}

function ownEnumerableDataEntries(input) {
  if (!isRecordLike(input)) return null;
  const descriptors = safeDescriptors(input);
  if (!descriptors) return null;
  const entries = [];
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (descriptor.enumerable && Object.hasOwn(descriptor, 'value')) entries.push([key, descriptor.value]);
  }
  return entries;
}

export function parseUiEntity(kind, input) {
  const contract = UI_CONTRACTS[kind];
  if (!contract) throw new UiContractError('UI_CONTRACT_KIND', `Unsupported UI entity kind: ${String(kind)}`);
  const entries = ownEnumerableDataEntries(input);
  if (!entries) throw new UiContractError('UI_CONTRACT_INPUT', `${kind} must be a readable record-like object`);
  const allowed = new Set([...contract.required, ...contract.optional]);
  const result = {};
  for (const [key, value] of entries) {
    if (!allowed.has(key)) throw new UiContractError('UI_CONTRACT_UNKNOWN_KEY', `${kind} contains unknown key: ${key}`);
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
  }
  for (const key of contract.required) {
    if (!Object.hasOwn(result, key)) throw new UiContractError('UI_CONTRACT_MISSING_KEY', `${kind} is missing required key: ${key}`);
  }
  return result;
}

export function readUiEntityData(kind, input) {
  const contract = UI_CONTRACTS[kind];
  const result = Object.create(null);
  if (!contract) return result;
  const entries = ownEnumerableDataEntries(input);
  if (!entries) return result;
  const allowed = new Set([...contract.required, ...contract.optional]);
  for (const [key, value] of entries) {
    if (allowed.has(key)) Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return result;
}
