import {
  ValidationError,
  scanAuditForbiddenFields
} from '../../../audit-protocol/src/index.mjs';

const PHASE5_ADDITIONAL_FORBIDDEN_KEYS = new Set([
  'credential', 'credentials', 'apikey', 'accesskey', 'authorization', 'bearertoken',
  'secret', 'secrets', 'key', 'keys', 'signing', 'sign', 'signature',
  'transaction', 'transactions', 'transactionconstruction', 'calldata',
  'networkdestination', 'egressdestination', 'endpoint', 'endpoints', 'host', 'hostname',
  'packageinstallation', 'installpackages', 'filesystemmutation', 'writefile', 'writepath',
  'processspawn', 'spawn', 'exec', 'executioncommand'
]);
function normalizedFieldName(key) {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function scanAdditionalForbiddenFields(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanAdditionalForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (PHASE5_ADDITIONAL_FORBIDDEN_KEYS.has(normalizedFieldName(key))) {
      throw new ValidationError('forbidden_field', `${path}.${key} is forbidden`, `${path}.${key}`);
    }
    scanAdditionalForbiddenFields(child, `${path}.${key}`);
  }
}

function assertPlainObjectTree(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainObjectTree(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ValidationError('invalid_type', `${path} must contain only plain objects`, path);
  }
  for (const [key, child] of Object.entries(value)) {
    assertPlainObjectTree(child, `${path}.${key}`);
  }
}

export function scanPhase5ForbiddenFields(value, path = '$') {
  assertPlainObjectTree(value, path);
  scanAuditForbiddenFields(value, path);
  scanAdditionalForbiddenFields(value, path);
}

export function plainObject(value, path = '$') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('invalid_type', `${path} must be an object`, path);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ValidationError('invalid_type', `${path} must be a plain object`, path);
  }
  return value;
}

export function exactKeys(value, expected, path = '$') {
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  }
  for (const key of expected) {
    if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
  }
}

