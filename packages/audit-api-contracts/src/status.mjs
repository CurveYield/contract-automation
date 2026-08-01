import {
  ApiContractError,
  validateExternalValue
} from './index.mjs';

function exactObjectKeys(value, keys, path) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join('\0') !== expected.join('\0')) {
    throw new ApiContractError('invalid_status', 'Status object keys are invalid', path);
  }
}

function identifier(value, path) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  ) {
    throw new ApiContractError('invalid_status', 'Status identifier is invalid', path);
  }
}

function instant(value, path) {
  if (typeof value !== 'string') {
    throw new ApiContractError('invalid_status', 'Status timestamp is invalid', path);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ApiContractError('invalid_status', 'Status timestamp is invalid', path);
  }
}

export function validateStatusSummary(value, {
  resourceType,
  resourceId,
  tenantId,
  workspaceId,
  path = '$.status'
}) {
  const safe = validateExternalValue(value, path);
  exactObjectKeys(safe, [
    'schemaVersion',
    'resourceType',
    'resourceId',
    'tenantId',
    'workspaceId',
    'state',
    'updatedAt',
    'terminal',
    'progress'
  ], path);
  if (safe.schemaVersion !== 'audit-status-summary-v1') {
    throw new ApiContractError('invalid_status', 'Status schema is invalid', `${path}.schemaVersion`);
  }
  if (safe.resourceType !== resourceType || safe.resourceId !== resourceId) {
    throw new ApiContractError('not_found', 'Resource not found', '$.resourceId', 404);
  }
  if (safe.tenantId !== tenantId || safe.workspaceId !== workspaceId) {
    throw new ApiContractError('not_found', 'Resource not found', '$.resourceId', 404);
  }
  for (const field of ['resourceId', 'tenantId', 'workspaceId']) {
    identifier(safe[field], `${path}.${field}`);
  }
  if (!['campaign', 'job'].includes(safe.resourceType)) {
    throw new ApiContractError('invalid_status', 'Resource type is invalid', `${path}.resourceType`);
  }
  if (![
    'accepted',
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled',
    'timed_out',
    'unavailable'
  ].includes(safe.state)) {
    throw new ApiContractError('invalid_status', 'Status state is invalid', `${path}.state`);
  }
  instant(safe.updatedAt, `${path}.updatedAt`);
  if (typeof safe.terminal !== 'boolean') {
    throw new ApiContractError('invalid_status', 'Terminal state is invalid', `${path}.terminal`);
  }
  exactObjectKeys(safe.progress, ['completed', 'total'], `${path}.progress`);
  for (const field of ['completed', 'total']) {
    if (
      !Number.isSafeInteger(safe.progress[field]) ||
      safe.progress[field] < 0 ||
      safe.progress[field] > 1_000_000
    ) {
      throw new ApiContractError('invalid_status', 'Progress is invalid', `${path}.progress.${field}`);
    }
  }
  if (safe.progress.completed > safe.progress.total) {
    throw new ApiContractError('invalid_status', 'Progress is invalid', `${path}.progress`);
  }
  return safe;
}
