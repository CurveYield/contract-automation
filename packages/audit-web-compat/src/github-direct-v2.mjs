import { createGitHubDirectStatusViewModel } from '../../audit-report-view-model/src/index.mjs';

export const DIRECT_MODE = 'github-direct-audit-v1';
export const DIRECT_RESULT_SCHEMA = 'github-direct-service-result-v2';
export const DIRECT_ERROR_SCHEMA = 'github-direct-service-error-v1';
const COMMAND_STATES = Object.freeze({
  submit: ['accepted', 'completed', 'execution_plane_unavailable'], status: ['completed'],
  cancel: ['cancelled'], report: ['completed', 'cancelled', 'execution_plane_unavailable'],
  capabilities: ['completed'], 'verify-fixture': ['completed', 'execution_plane_unavailable']
});
const DIRECT_STATES = ['requested', 'validating', 'admitted', 'awaiting_executor', 'fixture_running', 'publishing', 'completed', 'failed', 'cancelled', 'policy_rejected', 'execution_plane_unavailable'];
const ERROR_CODES = ['invalid_command', 'authorization_denied', 'transport_failure', 'stale_state', 'publication_conflict', 'execution_plane_unavailable', 'internal_error'];

function descriptors(value) { if (value === null || typeof value !== 'object') return null; try { return Object.getOwnPropertyDescriptors(value); } catch { return null; } }
function own(value, key) { const item = descriptors(value)?.[key]; return item?.enumerable && Object.hasOwn(item, 'value') ? item.value : undefined; }
function keys(value) { const map = descriptors(value); return map ? Object.keys(map).filter((key) => map[key]?.enumerable && Object.hasOwn(map[key], 'value')) : null; }
function fail(ErrorClass, code, message) { throw new ErrorClass(code, message); }
function exact(value, required, optional, label, ErrorClass) {
  const found = keys(value); if (!found) fail(ErrorClass, 'UI_COMPAT_INPUT', `${label} must be a readable record.`);
  const allowed = new Set([...required, ...optional]);
  if (found.some((key) => !allowed.has(key)) || required.some((key) => !found.includes(key))) fail(ErrorClass, 'UI_COMPAT_INPUT', `${label} has invalid fields.`);
  return value;
}
function text(value, label, max, ErrorClass) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001F\u007F]/.test(value)) fail(ErrorClass, 'UI_COMPAT_INPUT', `${label} must be bounded text.`);
  return value;
}
function enumValue(value, allowed, label, ErrorClass) { const out = text(value, label, 120, ErrorClass); if (!allowed.includes(out)) fail(ErrorClass, 'UI_COMPAT_STATE', `${label} is unsupported.`); return out; }
function sha(value, label, ErrorClass) { const out = text(value, label, 40, ErrorClass); if (!/^[0-9a-f]{40}$/.test(out)) fail(ErrorClass, 'UI_COMPAT_IDENTITY', `${label} is invalid.`); return out; }
function digest(value, label, ErrorClass) { const out = text(value, label, 71, ErrorClass); if (!/^sha256:[0-9a-f]{64}$/.test(out)) fail(ErrorClass, 'UI_COMPAT_IDENTITY', `${label} is invalid.`); return out; }
function timestamp(value, label, ErrorClass) { const out = text(value, label, 80, ErrorClass); if (!/^\d{4}-\d{2}-\d{2}T/.test(out) || Number.isNaN(Date.parse(out))) fail(ErrorClass, 'UI_COMPAT_INPUT', `${label} is invalid.`); return out; }
function dense(value, limit = 2) {
  try { if (!Array.isArray(value)) return []; } catch { return []; }
  const map = descriptors(value); if (!map) return [];
  return Object.keys(map).filter((key) => /^(?:0|[1-9]\d*)$/.test(key)).map(Number).sort((a, b) => a - b)
    .filter((key) => map[String(key)]?.enumerable && Object.hasOwn(map[String(key)], 'value')).slice(0, limit).map((key) => map[String(key)].value);
}
function rejectCredentials(value, ErrorClass, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || depth > 12) return;
  try { if (seen.has(value)) return; seen.add(value); } catch { fail(ErrorClass, 'UI_COMPAT_INPUT', 'Unreadable compatibility input.'); }
  const map = descriptors(value); if (!map) fail(ErrorClass, 'UI_COMPAT_INPUT', 'Unreadable compatibility input.');
  let count = 0;
  for (const key of Object.keys(map).sort()) {
    const item = map[key]; if (!item?.enumerable || !Object.hasOwn(item, 'value')) continue;
    if (/(?:token|secret|authorization|credential|password|mnemonic|private.?key)/i.test(key)) fail(ErrorClass, 'UI_COMPAT_INPUT', 'Credential-shaped fields are forbidden.');
    rejectCredentials(item.value, ErrorClass, depth + 1, seen); if (++count > 500) fail(ErrorClass, 'UI_COMPAT_INPUT', 'Compatibility input is oversized.');
  }
}
function identity(value, context, label, ErrorClass) {
  if (!descriptors(value)) return null;
  if (text(own(value, 'jobId'), `${label}.jobId`, 96, ErrorClass) !== context.jobId || sha(own(value, 'targetCommitSha'), `${label}.targetCommitSha`, ErrorClass) !== context.targetCommitSha) {
    fail(ErrorClass, 'UI_COMPAT_IDENTITY', `${label} identity mismatch.`);
  }
  return value;
}
function projection(data, context, ErrorClass) {
  const current = own(data, 'currentState') == null ? null : identity(own(data, 'currentState'), context, 'currentState', ErrorClass);
  const currentState = current ? enumValue(own(current, 'state'), DIRECT_STATES, 'currentState.state', ErrorClass) : null;
  const repository = current && typeof own(current, 'repositoryFullName') === 'string' ? own(current, 'repositoryFullName') : '';
  const bundle = own(data, 'bundle') == null ? null : identity(own(data, 'bundle'), context, 'bundle', ErrorClass);
  const manifest = bundle && own(bundle, 'resultManifest') ? identity(own(bundle, 'resultManifest'), context, 'resultManifest', ErrorClass) : null;
  const index = bundle && own(bundle, 'reportIndex') ? identity(own(bundle, 'reportIndex'), context, 'reportIndex', ErrorClass) : null;
  const entries = index ? dense(own(index, 'entries')) : []; if (entries.length > 1) fail(ErrorClass, 'UI_COMPAT_CONFLICT', 'Conflicting report references.');
  let reportId = '', reportDigest = '';
  if (entries.length === 1) {
    const entry = exact(entries[0], ['reportId', 'reportDigest'], ['kind'], 'report entry', ErrorClass);
    reportId = text(own(entry, 'reportId'), 'reportId', 160, ErrorClass); reportDigest = digest(own(entry, 'reportDigest'), 'reportDigest', ErrorClass);
  }
  return {
    currentState, repository, reportId, reportDigest,
    executionState: manifest && typeof own(manifest, 'executionState') === 'string' ? own(manifest, 'executionState') : context.state === 'execution_plane_unavailable' ? 'execution_plane_unavailable' : 'not_executed',
    outcome: manifest && typeof own(manifest, 'outcome') === 'string' ? own(manifest, 'outcome') : ''
  };
}
function consistent(command, state, current, ErrorClass) {
  if (!COMMAND_STATES[command]?.includes(state)) fail(ErrorClass, 'UI_COMPAT_STATE', 'Contradictory command/result state.');
  const expected = command === 'submit' ? ({ accepted: 'awaiting_executor', completed: 'completed', execution_plane_unavailable: 'execution_plane_unavailable' })[state]
    : command === 'cancel' ? 'cancelled' : command === 'report' ? ({ completed: 'completed', cancelled: 'cancelled', execution_plane_unavailable: 'execution_plane_unavailable' })[state] : null;
  if (expected && current !== expected) fail(ErrorClass, 'UI_COMPAT_STATE', 'Contradictory nested lifecycle state.');
}

export function adaptDirectResultV2(input, ErrorClass) {
  const record = exact(input, ['schemaVersion', 'modeId', 'commandKind', 'jobId', 'targetCommitSha', 'state', 'data', 'completedAt', 'cloudflareFallback', 'resultId', 'resultDigest'], [], 'GitHub Direct result', ErrorClass);
  if (own(record, 'schemaVersion') !== DIRECT_RESULT_SCHEMA || own(record, 'modeId') !== DIRECT_MODE) fail(ErrorClass, 'UI_COMPAT_VERSION', 'Unsupported GitHub Direct result version.');
  const command = enumValue(own(record, 'commandKind'), Object.keys(COMMAND_STATES), 'commandKind', ErrorClass);
  const state = enumValue(own(record, 'state'), ['accepted', 'completed', 'cancelled', 'execution_plane_unavailable', 'failed'], 'state', ErrorClass);
  const context = { jobId: text(own(record, 'jobId'), 'jobId', 96, ErrorClass), targetCommitSha: sha(own(record, 'targetCommitSha'), 'targetCommitSha', ErrorClass), state };
  const resultDigest = digest(own(record, 'resultDigest'), 'resultDigest', ErrorClass);
  const resultId = text(own(record, 'resultId'), 'resultId', 160, ErrorClass);
  if (resultId !== `direct-service-result-${resultDigest.slice(7, 31)}`) fail(ErrorClass, 'UI_COMPAT_IDENTITY', 'resultId/resultDigest mismatch.');
  if (own(record, 'cloudflareFallback') !== false) fail(ErrorClass, 'UI_COMPAT_STATE', 'Fallback must remain disabled.');
  const data = own(record, 'data'); if (!descriptors(data)) fail(ErrorClass, 'UI_COMPAT_INPUT', 'Result data must be readable.'); rejectCredentials(data, ErrorClass);
  const projected = projection(data, context, ErrorClass); consistent(command, state, projected.currentState, ErrorClass);
  return createGitHubDirectStatusViewModel({
    id: resultId, status: command === 'status' && projected.currentState ? projected.currentState : state === 'accepted' ? 'awaiting_executor' : projected.currentState || state,
    repository: projected.repository, targetSha: context.targetCommitSha,
    checkStatus: state === 'accepted' ? 'queued' : state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : state === 'execution_plane_unavailable' ? 'neutral' : 'failed',
    reportId: projected.reportId, updatedAt: timestamp(own(record, 'completedAt'), 'completedAt', ErrorClass),
    reason: state === 'execution_plane_unavailable' ? 'Execution plane unavailable; submitted source was not executed.' : '',
    sourceSchema: DIRECT_RESULT_SCHEMA, commandKind: command, serviceState: state, resultId, resultDigest,
    executionState: projected.executionState, outcome: projected.outcome, reportDigest: projected.reportDigest,
    retryable: false, errorCode: ''
  });
}

export function adaptDirectErrorV1(input, ErrorClass) {
  const record = exact(input, ['schemaVersion', 'modeId', 'code', 'retryable', 'message', 'at'], [], 'GitHub Direct error', ErrorClass);
  if (own(record, 'schemaVersion') !== DIRECT_ERROR_SCHEMA || own(record, 'modeId') !== DIRECT_MODE) fail(ErrorClass, 'UI_COMPAT_VERSION', 'Unsupported GitHub Direct error version.');
  const code = enumValue(own(record, 'code'), ERROR_CODES, 'error code', ErrorClass);
  if (typeof own(record, 'retryable') !== 'boolean' || own(record, 'message') !== 'GitHub Direct service operation failed') fail(ErrorClass, 'UI_COMPAT_INPUT', 'Non-canonical GitHub Direct error.');
  return createGitHubDirectStatusViewModel({
    id: `github-direct-error-${code}`, status: code === 'execution_plane_unavailable' ? 'execution_plane_unavailable' : 'failed',
    repository: '', targetSha: '', checkStatus: 'failed', reportId: '', updatedAt: timestamp(own(record, 'at'), 'at', ErrorClass),
    reason: 'GitHub Direct service operation failed', sourceSchema: DIRECT_ERROR_SCHEMA, commandKind: 'unknown', serviceState: 'failed',
    resultId: '', resultDigest: '', executionState: 'not_executed', outcome: '', reportDigest: '', retryable: own(record, 'retryable'), errorCode: code
  });
}
