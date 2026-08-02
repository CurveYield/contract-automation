import {
  ApiContractError,
  validateExternalValue
} from './index.mjs';

const STATUS_STATES = Object.freeze({
  workspace: Object.freeze(['active', 'sealed', 'archived', 'failed']),
  campaign: Object.freeze(['accepted', 'queued', 'running', 'completed', 'failed', 'cancelled', 'timed_out', 'unavailable']),
  job: Object.freeze(['accepted', 'queued', 'awaiting_executor', 'running', 'completed', 'failed', 'cancelled', 'timed_out', 'resource_exhaustion', 'unavailable']),
  fork: Object.freeze(['requested', 'awaiting_executor', 'ready', 'checkpointing', 'restoring', 'exporting', 'deleting', 'deleted', 'failed', 'cancelled']),
  'clean-room': Object.freeze(['requested', 'active', 'validating', 'merging', 'completed', 'failed', 'cancelled', 'policy_rejected'])
});
const TERMINAL_STATES = Object.freeze({
  workspace: new Set(['archived', 'failed']),
  campaign: new Set(['completed', 'failed', 'cancelled', 'timed_out', 'unavailable']),
  job: new Set(['completed', 'failed', 'cancelled', 'timed_out', 'resource_exhaustion', 'unavailable']),
  fork: new Set(['deleted', 'failed', 'cancelled']),
  'clean-room': new Set(['completed', 'failed', 'cancelled', 'policy_rejected'])
});

function exactObjectKeys(value, keys, path, code = 'invalid_status') {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join('\0') !== expected.join('\0')) {
    throw new ApiContractError(code, 'Summary object keys are invalid', path);
  }
}

function identifier(value, path, code = 'invalid_status') {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) throw new ApiContractError(code, 'Summary identifier is invalid', path);
}

function instant(value, path, code = 'invalid_status') {
  if (typeof value !== 'string') throw new ApiContractError(code, 'Summary timestamp is invalid', path);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ApiContractError(code, 'Summary timestamp is invalid', path);
  }
}

function count(value, path, code) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
    throw new ApiContractError(code, 'Summary count is invalid', path);
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
    'schemaVersion', 'resourceType', 'resourceId', 'tenantId', 'workspaceId',
    'state', 'updatedAt', 'terminal', 'progress'
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
  for (const field of ['resourceId', 'tenantId', 'workspaceId']) identifier(safe[field], `${path}.${field}`);
  const states = STATUS_STATES[safe.resourceType];
  if (!states || !states.includes(safe.state)) {
    throw new ApiContractError('invalid_status', 'Status state is invalid', `${path}.state`);
  }
  instant(safe.updatedAt, `${path}.updatedAt`);
  if (typeof safe.terminal !== 'boolean') {
    throw new ApiContractError('invalid_status', 'Terminal state is invalid', `${path}.terminal`);
  }
  if (safe.terminal !== TERMINAL_STATES[safe.resourceType].has(safe.state)) {
    throw new ApiContractError('invalid_status', 'Terminal state contradicts lifecycle state', `${path}.terminal`);
  }
  exactObjectKeys(safe.progress, ['completed', 'total'], `${path}.progress`);
  count(safe.progress.completed, `${path}.progress.completed`, 'invalid_status');
  count(safe.progress.total, `${path}.progress.total`, 'invalid_status');
  if (safe.progress.completed > safe.progress.total) {
    throw new ApiContractError('invalid_status', 'Progress is invalid', `${path}.progress`);
  }
  return safe;
}

export function validateEvidenceSummary(value, {
  jobId,
  tenantId,
  workspaceId,
  path = '$.evidenceSummary'
}) {
  const safe = validateExternalValue(value, path);
  exactObjectKeys(safe, [
    'schemaVersion', 'jobId', 'tenantId', 'workspaceId', 'classification',
    'findingCount', 'evidenceCount', 'artifactCount', 'truncated', 'updatedAt'
  ], path, 'invalid_evidence_summary');
  if (safe.schemaVersion !== 'audit-evidence-summary-v1') {
    throw new ApiContractError('invalid_evidence_summary', 'Evidence summary schema is invalid', `${path}.schemaVersion`);
  }
  if (safe.jobId !== jobId || safe.tenantId !== tenantId || safe.workspaceId !== workspaceId) {
    throw new ApiContractError('not_found', 'Resource not found', '$.resourceId', 404);
  }
  for (const field of ['jobId', 'tenantId', 'workspaceId']) {
    identifier(safe[field], `${path}.${field}`, 'invalid_evidence_summary');
  }
  if (!['success', 'findings', 'partial', 'unavailable'].includes(safe.classification)) {
    throw new ApiContractError('invalid_evidence_summary', 'Evidence classification is invalid', `${path}.classification`);
  }
  for (const field of ['findingCount', 'evidenceCount', 'artifactCount']) {
    count(safe[field], `${path}.${field}`, 'invalid_evidence_summary');
  }
  if (typeof safe.truncated !== 'boolean') {
    throw new ApiContractError('invalid_evidence_summary', 'Evidence truncation state is invalid', `${path}.truncated`);
  }
  instant(safe.updatedAt, `${path}.updatedAt`, 'invalid_evidence_summary');
  return safe;
}
