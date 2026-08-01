const defineContract = (required, optional = []) => Object.freeze({
  required: Object.freeze([...required]),
  optional: Object.freeze([...optional])
});

export const UI_ENTITY_KINDS = Object.freeze([
  'capability', 'catalogTool', 'workspace', 'campaign', 'job', 'evidence',
  'report', 'fork', 'checkpoint', 'cleanRoomCampaign', 'provenance', 'diagnostic'
]);

export const UI_CONTRACTS = Object.freeze({
  capability: defineContract(['id', 'name', 'available'], ['summary', 'reason', 'category']),
  catalogTool: defineContract(['id', 'name', 'available'], ['summary', 'capabilityIds', 'tags']),
  workspace: defineContract(['id', 'name', 'status'], ['campaigns', 'updatedAt']),
  campaign: defineContract(['id', 'name', 'status'], ['jobs', 'workspaceId', 'updatedAt', 'summary']),
  job: defineContract(['id', 'status'], ['campaignId', 'title', 'error', 'updatedAt', 'reportId', 'resourceLimit']),
  evidence: defineContract(['id', 'title'], ['severity', 'url', 'summary', 'kind']),
  report: defineContract(['id', 'title', 'status'], ['createdAt', 'sourceUrl', 'evidence', 'summary', 'workspaceId', 'campaignId', 'jobId']),
  fork: defineContract(['id', 'status'], ['name', 'checkpoints', 'exportStatus', 'deleteStatus', 'retentionExpiresAt']),
  checkpoint: defineContract(['id', 'status'], ['createdAt', 'label', 'exportUrl']),
  cleanRoomCampaign: defineContract(['id', 'name', 'status'], ['merges', 'provenance', 'visibleResourceIds']),
  provenance: defineContract(['id', 'sourceType'], ['label', 'sourceId', 'commitSha', 'visible']),
  diagnostic: defineContract(['code', 'message'], ['correlationId', 'retryAfterSeconds', 'quotaRemaining', 'retentionDays', 'publicationStatus', 'staleState', 'details'])
});

export const UI_ERROR_CODES = Object.freeze([
  'UI_CONTRACT_KIND', 'UI_CONTRACT_INPUT', 'UI_CONTRACT_UNKNOWN_KEY',
  'UI_CONTRACT_MISSING_KEY', 'UI_CLIENT_UNSAFE_PATH', 'UI_CLIENT_ABORTED',
  'UI_CLIENT_STALE_RESPONSE', 'UI_CLIENT_TRANSPORT'
]);

export class UiContractError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = 'UiContractError';
    this.code = code;
  }
}

function ownEnumerableDataEntries(input) {
  if (input === null || typeof input !== 'object') return [];
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const entries = [];
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (descriptor.enumerable && Object.hasOwn(descriptor, 'value')) {
      entries.push([key, descriptor.value]);
    }
  }
  return entries;
}

export function parseUiEntity(kind, input) {
  const contract = UI_CONTRACTS[kind];
  if (!contract) throw new UiContractError('UI_CONTRACT_KIND', `Unsupported UI entity kind: ${String(kind)}`);
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new UiContractError('UI_CONTRACT_INPUT', `${kind} must be a plain record-like object`);
  }
  const allowed = new Set([...contract.required, ...contract.optional]);
  const result = {};
  for (const [key, value] of ownEnumerableDataEntries(input)) {
    if (!allowed.has(key)) {
      throw new UiContractError('UI_CONTRACT_UNKNOWN_KEY', `${kind} contains unknown key: ${key}`);
    }
    result[key] = value;
  }
  for (const key of contract.required) {
    if (!Object.hasOwn(result, key)) {
      throw new UiContractError('UI_CONTRACT_MISSING_KEY', `${kind} is missing required key: ${key}`);
    }
  }
  return result;
}

export function readUiEntityData(kind, input) {
  const contract = UI_CONTRACTS[kind];
  if (!contract || input === null || typeof input !== 'object') return {};
  const allowed = new Set([...contract.required, ...contract.optional]);
  const result = {};
  for (const [key, value] of ownEnumerableDataEntries(input)) {
    if (allowed.has(key)) result[key] = value;
  }
  return result;
}
