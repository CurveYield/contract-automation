import { isProxy } from 'node:util/types';

export class ValidationError extends Error {
  constructor(code, message, path = '$') {
    super(String(message).slice(0, 320));
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
  artifact: 'art',
  profile: 'prf',
  fork: 'fork',
  snapshot: 'snap',
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

const MAX_GRAPH_DEPTH = 32;
const MAX_GRAPH_ITEMS = 10_000;
const MAX_GRAPH_STRING = 2_000_000;
const CONTROL = /[\u0000-\u001f\u007f]/;

function fail(code, path, message = code) {
  throw new ValidationError(code, message, path);
}

function safePrototype(value, path) {
  try { return Object.getPrototypeOf(value); }
  catch { fail('hostile_reflection', path, `${path} prototype could not be inspected`); }
}

function safeOwnKeys(value, path) {
  try { return Reflect.ownKeys(value); }
  catch { fail('hostile_reflection', path, `${path} keys could not be inspected`); }
}

function safeDescriptors(value, path) {
  try { return Object.getOwnPropertyDescriptors(value); }
  catch { fail('hostile_reflection', path, `${path} descriptors could not be inspected`); }
}

function propertyPath(path, key) {
  return typeof key === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(key) ? `${path}.${key}` : `${path}.[rejected-field]`;
}

export function sanitizeAuditValue(value, path = '$', seen = new WeakSet(), depth = 0) {
  if (depth > MAX_GRAPH_DEPTH) fail('graph_too_deep', path, `${path} exceeds the graph depth bound`);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > MAX_GRAPH_STRING || CONTROL.test(value)) fail('invalid_string', path, `${path} contains an invalid string`);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail('invalid_number', path, `${path} contains an invalid number`);
    return value;
  }
  if (typeof value !== 'object') fail('invalid_type', path, `${path} contains an unsupported value`);
  if (isProxy(value)) fail('hostile_object', path, `${path} cannot be a proxy`);
  if (value instanceof Uint8Array) {
    if (Object.getPrototypeOf(value) !== Uint8Array.prototype) fail('invalid_byte_array', path, `${path} must be an ordinary Uint8Array`);
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) fail('invalid_byte_array', path, `${path} must be an ordinary Uint8Array`);
  if (seen.has(value)) fail('cyclic_value', path, `${path} must be acyclic`);
  seen.add(value);

  const prototype = safePrototype(value, path);
  const keys = safeOwnKeys(value, path);
  const descriptors = safeDescriptors(value, path);

  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail('invalid_array', path, `${path} must use Array.prototype`);
    const lengthDescriptor = descriptors.length;
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_GRAPH_ITEMS) fail('invalid_array', path, `${path} has an invalid length`);
    for (const key of keys) {
      if (typeof key === 'symbol') fail('symbol_property', path, `${path} cannot contain symbol properties`);
      if (key === 'length') continue;
      if (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= length) fail('array_property', path, `${path} contains a non-index property`);
    }
    const output = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor) fail('sparse_array', `${path}[${index}]`, `${path} cannot contain holes`);
      if (!Object.hasOwn(descriptor, 'value')) fail('accessor_property', `${path}[${index}]`, `${path}[${index}] must be a data property`);
      if (descriptor.enumerable !== true) fail('hidden_property', `${path}[${index}]`, `${path}[${index}] must be enumerable`);
      output[index] = sanitizeAuditValue(descriptor.value, `${path}[${index}]`, seen, depth + 1);
    }
    seen.delete(value);
    return output;
  }

  if (prototype !== Object.prototype && prototype !== null) fail('invalid_plain_object', path, `${path} must be a plain object`);
  if (keys.length > MAX_GRAPH_ITEMS) fail('object_too_large', path, `${path} has too many fields`);
  const stringKeys = [];
  for (const key of keys) {
    if (typeof key === 'symbol') fail('symbol_property', path, `${path} cannot contain symbol properties`);
    if (key.length < 1 || key.length > 160 || CONTROL.test(key)) fail('invalid_key', `${path}.[rejected-field]`, 'Object field name is invalid');
    stringKeys.push(key);
  }
  stringKeys.sort();
  const output = {};
  for (const key of stringKeys) {
    const descriptor = descriptors[key];
    const childPath = propertyPath(path, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('accessor_property', childPath, `${childPath} must be a data property`);
    if (descriptor.enumerable !== true) fail('hidden_property', childPath, `${childPath} must be enumerable`);
    Object.defineProperty(output, key, {
      value: sanitizeAuditValue(descriptor.value, childPath, seen, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  seen.delete(value);
  return output;
}

export function deepFreezeAuditValue(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreezeAuditValue(child);
    Object.freeze(value);
  }
  return value;
}

export function assertAuditPlainObject(value, path = '$') {
  const safe = sanitizeAuditValue(value, path);
  if (safe === null || typeof safe !== 'object' || Array.isArray(safe)) fail('invalid_plain_object', path, `${path} must be a plain object`);
  return safe;
}

function normalizedKey(key) {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

export function scanAuditForbiddenFields(value, path = '$') {
  const safe = sanitizeAuditValue(value, path);
  const scan = (node, nodePath) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => scan(item, `${nodePath}[${index}]`));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const childPath = propertyPath(nodePath, key);
      if (FORBIDDEN_KEYS.has(normalizedKey(key))) fail('forbidden_field', childPath, `${childPath} is forbidden`);
      scan(child, childPath);
    }
  };
  scan(safe, path);
  return safe;
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

function checkedScopes(value, path) {
  const safe = sanitizeAuditValue(value, path);
  if (!Array.isArray(safe) || safe.some((scope) => typeof scope !== 'string' || !AUDIT_SCOPES.includes(scope))) {
    throw new ValidationError('invalid_scope', `${path} contains an unsupported Audit scope`, path);
  }
  const seen = new Set();
  for (const scope of safe) {
    if (seen.has(scope)) throw new ValidationError('duplicate_scope', `${path} contains a duplicate Audit scope`, path);
    seen.add(scope);
  }
  return safe;
}

export function assertScopes(granted, required, path = '$.scopes') {
  const safeGranted = checkedScopes(granted, path);
  const safeRequired = checkedScopes(required, path);
  for (const scope of safeRequired) {
    if (!safeGranted.includes(scope)) {
      throw new ValidationError('insufficient_scope', `Missing required scope: ${scope}`, path);
    }
  }
  return deepFreezeAuditValue([...safeRequired]);
}

function assertNonemptyString(value, path, maxLength = 160) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength || CONTROL.test(value)) {
    throw new ValidationError('invalid_string', `${path} must be a non-empty string up to ${maxLength} characters`, path);
  }
  return value;
}

export function validateAuditJobRequest(value) {
  const safe = assertAuditPlainObject(value, '$');
  scanAuditForbiddenFields(safe);
  for (const key of Object.keys(safe)) {
    if (!JOB_KEYS.has(key)) {
      throw new ValidationError('unknown_field', `$.${key} is not allowed`, `$.${key}`);
    }
  }
  for (const key of JOB_KEYS) {
    if (!(key in safe)) {
      throw new ValidationError('missing_field', `$.${key} is required`, `$.${key}`);
    }
  }
  assertAuditId(safe.workspaceId, 'workspace', '$.workspaceId');
  assertAuditId(safe.campaignId, 'campaign', '$.campaignId');
  assertAuditId(safe.profileId, 'profile', '$.profileId');
  assertNonemptyString(safe.tool, '$.tool', 80);
  assertAuditPlainObject(safe.configuration, '$.configuration');
  assertNonemptyString(safe.resourceClass, '$.resourceClass', 80);
  if (!Number.isSafeInteger(safe.timeoutSeconds) || safe.timeoutSeconds < 1 || safe.timeoutSeconds > 86_400) {
    throw new ValidationError('invalid_timeout', '$.timeoutSeconds must be an integer from 1 to 86400', '$.timeoutSeconds');
  }
  assertNonemptyString(safe.retentionPolicy, '$.retentionPolicy', 80);
  if (!Array.isArray(safe.expectedEvidence) || safe.expectedEvidence.length > 32 || safe.expectedEvidence.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 80 || CONTROL.test(item))) {
    throw new ValidationError('invalid_evidence', '$.expectedEvidence must be an array of up to 32 evidence identifiers', '$.expectedEvidence');
  }
  if (new Set(safe.expectedEvidence).size !== safe.expectedEvidence.length) {
    throw new ValidationError('duplicate_evidence', '$.expectedEvidence must not contain duplicates', '$.expectedEvidence');
  }
  assertNonemptyString(safe.idempotencyKey, '$.idempotencyKey', 160);
  return deepFreezeAuditValue(safe);
}

export function createOperationBudget(value) {
  const safe = assertAuditPlainObject(value, '$');
  const allowed = new Set(['classA', 'classB', 'storageBytes']);
  for (const key of Object.keys(safe)) {
    if (!allowed.has(key)) throw new ValidationError('unknown_field', `$.${key} is not allowed`, `$.${key}`);
  }
  const result = {};
  for (const key of allowed) {
    if (!(key in safe)) throw new ValidationError('missing_field', `$.${key} is required`, `$.${key}`);
    const item = safe[key];
    if (!Number.isSafeInteger(item) || item < 0) {
      throw new ValidationError('invalid_budget', `$.${key} must be a nonnegative safe integer`, `$.${key}`);
    }
    result[key] = item;
  }
  return deepFreezeAuditValue(result);
}
