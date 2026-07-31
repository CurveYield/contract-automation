export class ValidationError extends Error {
  constructor(code, message, path = '$') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.path = path;
  }
}

export const AUDIT_SCOPES = Object.freeze([
  'audit:read',
  'audit:submit',
  'audit:admin',
  'audit:internal'
]);

export const AUDIT_JOB_STATES = Object.freeze([
  'submitted',
  'validating',
  'admitted',
  'queued',
  'awaiting_executor',
  'provisioning',
  'running',
  'collecting_evidence',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
  'policy_rejected'
]);

export const AUDIT_CAPABILITIES = Object.freeze({
  service: 'curveyield-audit',
  apiVersion: 'audit-v1',
  phase: 1,
  executionEnabled: false,
  storage: 'r2-standard',
  executionState: 'awaiting_executor'
});

const PREFIXES = Object.freeze({
  tenant: 'ten',
  workspace: 'ws',
  layer: 'lyr',
  campaign: 'cmp',
  job: 'ajob',
  attempt: 'att',
  profile: 'prf',
  fork: 'fork',
  evidence: 'evb',
  report: 'rpt'
});

const FORBIDDEN_KEYS = new Set([
  'shell', 'command', 'commands', 'script', 'scripts', 'npmscript',
  'dockerfile', 'workflow', 'workflowfile', 'ciworkflow',
  'image', 'containerimage', 'customimage', 'binary', 'executable',
  'plugin', 'plugins', 'packagemanagercommand', 'packagecommand',
  'url', 'rpcurl', 'rpc', 'rpcendpoint',
  'privatekey', 'privatekeys', 'mnemonic', 'seedphrase', 'signer',
  'rawtransaction', 'signedtransaction', 'wallet', 'walletmethod',
  'privileged', 'privilegedmode', 'capabilities', 'broadcast'
]);

const JOB_KEYS = new Set([
  'workspaceId',
  'campaignId',
  'profileId',
  'tool',
  'configuration',
  'resourceClass',
  'timeoutSeconds',
  'retentionPolicy',
  'expectedEvidence',
  'idempotencyKey'
]);

function assertPlainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('invalid_type', `${path} must be an object`, path);
  }
}

function normalizedKey(key) {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

export function scanAuditForbiddenFields(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanAuditForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizedKey(key))) {
      throw new ValidationError('forbidden_field', `${path}.${key} is forbidden`, `${path}.${key}`);
    }
    scanAuditForbiddenFields(child, `${path}.${key}`);
  }
}

export function assertAuditId(value, type, path = '$') {
  const prefix = PREFIXES[type];
  if (!prefix) throw new ValidationError('invalid_id_type', `Unknown Audit ID type: ${type}`, path);
  const expression = new RegExp(`^${prefix}_[0-9a-f]{32}$`);
  if (typeof value !== 'string' || !expression.test(value)) {
    throw new ValidationError('invalid_id', `${path} must be a ${type} Audit ID`, path);
  }
  return value;
}

export function assertProfileId(value, path = '$.profileId') {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/.test(value)) {
    throw new ValidationError('invalid_profile_id', `${path} must be a lowercase versioned profile slug`, path);
  }
  return value;
}

export function assertScopes(granted, required, path = '$.scopes') {
  if (!Array.isArray(granted) || granted.some((scope) => !AUDIT_SCOPES.includes(scope))) {
    throw new ValidationError('invalid_scope', `${path} contains an unsupported Audit scope`, path);
  }
  if (!Array.isArray(required) || required.some((scope) => !AUDIT_SCOPES.includes(scope))) {
    throw new ValidationError('invalid_scope', `${path} contains an unsupported required scope`, path);
  }
  for (const scope of required) {
    if (!granted.includes(scope)) {
      throw new ValidationError('insufficient_scope', `Missing required scope: ${scope}`, path);
    }
  }
  return [...required];
}

function assertNonemptyString(value, path, maxLength = 160) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
    throw new ValidationError('invalid_string', `${path} must be a non-empty string up to ${maxLength} characters`, path);
  }
  return value;
}

export function validateAuditJobRequest(value) {
  assertPlainObject(value, '$');
  scanAuditForbiddenFields(value);
  for (const key of Object.keys(value)) {
    if (!JOB_KEYS.has(key)) {
      throw new ValidationError('unknown_field', `$.${key} is not allowed`, `$.${key}`);
    }
  }
  for (const key of JOB_KEYS) {
    if (!(key in value)) {
      throw new ValidationError('missing_field', `$.${key} is required`, `$.${key}`);
    }
  }
  assertAuditId(value.workspaceId, 'workspace', '$.workspaceId');
  assertAuditId(value.campaignId, 'campaign', '$.campaignId');
  assertAuditId(value.profileId, 'profile', '$.profileId');
  assertNonemptyString(value.tool, '$.tool', 80);
  assertPlainObject(value.configuration, '$.configuration');
  assertNonemptyString(value.resourceClass, '$.resourceClass', 80);
  if (!Number.isSafeInteger(value.timeoutSeconds) || value.timeoutSeconds < 1 || value.timeoutSeconds > 86_400) {
    throw new ValidationError('invalid_timeout', '$.timeoutSeconds must be an integer from 1 to 86400', '$.timeoutSeconds');
  }
  assertNonemptyString(value.retentionPolicy, '$.retentionPolicy', 80);
  if (!Array.isArray(value.expectedEvidence) || value.expectedEvidence.length > 32 || value.expectedEvidence.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 80)) {
    throw new ValidationError('invalid_evidence', '$.expectedEvidence must be an array of up to 32 evidence identifiers', '$.expectedEvidence');
  }
  assertNonemptyString(value.idempotencyKey, '$.idempotencyKey', 160);
  return structuredClone(value);
}

export function createOperationBudget(value) {
  assertPlainObject(value, '$');
  const allowed = new Set(['classA', 'classB', 'storageBytes']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ValidationError('unknown_field', `$.${key} is not allowed`, `$.${key}`);
  }
  const result = {};
  for (const key of allowed) {
    const item = value[key];
    if (!Number.isSafeInteger(item) || item < 0) {
      throw new ValidationError('invalid_budget', `$.${key} must be a nonnegative safe integer`, `$.${key}`);
    }
    result[key] = item;
  }
  return result;
}
