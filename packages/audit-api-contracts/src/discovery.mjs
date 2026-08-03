import {
  ApiContractError,
  validateExternalValue
} from './index.mjs';

function exactObjectKeys(value, keys, path) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join('\0') !== expected.join('\0')) {
    throw new ApiContractError('invalid_contract', 'Object keys do not match the contract', path);
  }
}

function identifier(value, path, maximum = 160) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  ) {
    throw new ApiContractError('invalid_identifier', 'Identifier is invalid', path);
  }
  return value;
}

function instant(value, path) {
  if (typeof value !== 'string') {
    throw new ApiContractError('invalid_timestamp', 'Timestamp is invalid', path);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ApiContractError('invalid_timestamp', 'Timestamp is invalid', path);
  }
  return value;
}

export function resolveAuditReadScope(authenticatedIdentity, env = {}) {
  const identity = authenticatedIdentity?.identity;
  if (typeof identity !== 'string') {
    throw new ApiContractError('forbidden', 'Read scope is unavailable', '$', 403);
  }
  const scopes = env.AUDIT_READ_SCOPES;
  const descriptor = scopes && typeof scopes === 'object'
    ? Object.getOwnPropertyDescriptor(scopes, identity)
    : null;
  if (!descriptor || !('value' in descriptor)) {
    throw new ApiContractError('forbidden', 'Read scope is unavailable', '$', 403);
  }
  const scope = validateExternalValue(descriptor.value, '$.readScope');
  exactObjectKeys(scope, ['tenantId', 'workspaceId'], '$.readScope');
  identifier(scope.tenantId, '$.readScope.tenantId');
  identifier(scope.workspaceId, '$.readScope.workspaceId');
  return scope;
}

export function validateReportReference(value, path = '$.report') {
  const safe = validateExternalValue(value, path);
  exactObjectKeys(safe, [
    'schemaVersion',
    'reportId',
    'tenantId',
    'workspaceId',
    'campaignId',
    'jobId',
    'reportSchemaVersion',
    'digest',
    'createdAt',
    'summary'
  ], path);
  if (safe.schemaVersion !== 'audit-report-reference-v1') {
    throw new ApiContractError('invalid_report', 'Report schema is invalid', `${path}.schemaVersion`);
  }
  for (const field of [
    'reportId', 'tenantId', 'workspaceId', 'campaignId', 'jobId', 'reportSchemaVersion'
  ]) {
    identifier(safe[field], `${path}.${field}`);
  }
  if (typeof safe.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(safe.digest)) {
    throw new ApiContractError('invalid_report', 'Report digest is invalid', `${path}.digest`);
  }
  instant(safe.createdAt, `${path}.createdAt`);
  exactObjectKeys(
    safe.summary,
    ['classification', 'findingCount', 'evidenceCount', 'truncated'],
    `${path}.summary`
  );
  if (!['success', 'findings', 'failed', 'cancelled', 'partial'].includes(safe.summary.classification)) {
    throw new ApiContractError(
      'invalid_report',
      'Report classification is invalid',
      `${path}.summary.classification`
    );
  }
  for (const field of ['findingCount', 'evidenceCount']) {
    if (
      !Number.isSafeInteger(safe.summary[field]) ||
      safe.summary[field] < 0 ||
      safe.summary[field] > 1_000_000
    ) {
      throw new ApiContractError(
        'invalid_report',
        'Report count is invalid',
        `${path}.summary.${field}`
      );
    }
  }
  if (typeof safe.summary.truncated !== 'boolean') {
    throw new ApiContractError(
      'invalid_report',
      'Report truncation state is invalid',
      `${path}.summary.truncated`
    );
  }
  return safe;
}
