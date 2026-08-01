import { ValidationError, assertAuditId, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';
import {
  assertJobTransition,
  attemptKey,
  campaignCreationKey,
  campaignCurrentKey,
  campaignJobIndexKey,
  eventBatchKey,
  jobPolicyKey,
  jobRequestKey,
  jobStatusKey,
  validateCampaignCreation,
  validateEventBatch,
  validateJobRequest,
  validateJobStatus,
  workspaceCampaignIndexKey
} from '../../audit-campaign-protocol/src/index.mjs';
import { workspaceSourceManifestKey } from '../../audit-workspace-protocol/src/index.mjs';
import { profileIndexKey } from '../../audit-profile-registry/src/index.mjs';

const decoder = new TextDecoder();
const encoder = new TextEncoder();
const ACTIVE_STATES = new Set(['provisioning', 'running', 'collecting_evidence']);

function object(value, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path);
}
function allowed(value, keys, path = '$') {
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
}
function required(value, keys, path = '$') {
  for (const key of keys) if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
}
function parse(record) {
  if (!record) return null;
  return JSON.parse(typeof record.value === 'string' ? record.value : decoder.decode(record.value));
}
function requireRecord(record, code, message, path) {
  if (!record) throw new ValidationError(code, message, path);
  return record;
}
function createOnly() { return { onlyIf: { etagDoesNotMatch: '*' } }; }
function match(etag) {
  if (typeof etag !== 'string' || etag.length < 1) throw new ValidationError('missing_etag', 'An ETag precondition is required', '$.etag');
  return { onlyIf: { etagMatches: etag } };
}
function indexWriteCondition(record) { return record ? match(record.etag) : createOnly(); }
function assertOptionalExpectedEtag(expected, record, path, code = 'stale_index') {
  if (expected === undefined) return;
  if (!record || record.etag !== expected) throw new ValidationError(code, `${path} is stale`, path);
}
function instant(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('now must produce a valid date');
  return date.toISOString();
}
function batchId(revision) { return String(revision).padStart(8, '0'); }
function metadataSize(value) { return encoder.encode(JSON.stringify(value)).byteLength; }
function makeBatch(jobId, revision, at, events) {
  return validateEventBatch({ schemaVersion: 'audit-event-batch-v1', jobId, batchId: batchId(revision), createdAt: at, events });
}
function validateWorkspaceIndex(value, workspaceId) {
  object(value, '$.workspaceIndex'); scanAuditForbiddenFields(value, '$.workspaceIndex');
  const keys = new Set(['schemaVersion', 'workspaceId', 'campaigns', 'records']);
  allowed(value, keys, '$.workspaceIndex'); required(value, new Set(['schemaVersion', 'workspaceId', 'campaigns']), '$.workspaceIndex');
  if (value.schemaVersion !== 'workspace-campaign-index-v1' || value.workspaceId !== workspaceId || !Array.isArray(value.campaigns)) throw new ValidationError('invalid_campaign_index', 'Workspace campaign index is invalid', '$.workspaceIndex');
  value.campaigns.forEach((id, index) => assertAuditId(id, 'campaign', `$.workspaceIndex.campaigns[${index}]`));
  return structuredClone(value);
}
function emptyWorkspaceIndex(workspaceId) { return { schemaVersion: 'workspace-campaign-index-v1', workspaceId, campaigns: [], records: {} }; }
function validateJobIndex(value, campaignId) {
  object(value, '$.jobIndex'); scanAuditForbiddenFields(value, '$.jobIndex');
  const keys = new Set(['schemaVersion', 'campaignId', 'jobs', 'records']);
  allowed(value, keys, '$.jobIndex'); required(value, new Set(['schemaVersion', 'campaignId', 'jobs']), '$.jobIndex');
  if (value.schemaVersion !== 'campaign-job-index-v1' || value.campaignId !== campaignId || !Array.isArray(value.jobs)) throw new ValidationError('invalid_job_index', 'Campaign job index is invalid', '$.jobIndex');
  value.jobs.forEach((id, index) => assertAuditId(id, 'job', `$.jobIndex.jobs[${index}]`));
  return structuredClone(value);
}
function emptyJobIndex(campaignId) { return { schemaVersion: 'campaign-job-index-v1', campaignId, jobs: [], records: {} }; }
function validateCampaign(value, campaignId, workspaceId) {
  object(value, '$.campaign');
  if (value.schemaVersion !== 'campaign-current-v1' || value.campaignId !== campaignId || value.workspaceId !== workspaceId || value.state !== 'active') throw new ValidationError('campaign_unavailable', 'Campaign is not active for the requested workspace', '$.campaignId');
  return value;
}
function validateProfile(value, profileId) {
  object(value, '$.profiles');
  if (value.schemaVersion !== 'profile-index-v1' || !Array.isArray(value.profiles) || !value.profiles.includes(profileId)) throw new ValidationError('profile_not_found', 'Audit profile is not published', '$.profileId');
  if (value.records?.[profileId]?.revoked === true) throw new ValidationError('profile_revoked', 'Audit profile is revoked', '$.profileId');
}

export class CampaignService {
  constructor(store, options = {}) {
    if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') throw new TypeError('CampaignService requires an Audit store');
    this.store = store;
    this.now = options.now ?? (() => new Date());
    this.trustedFixture = options.trustedFixture === true;
  }

  async createCampaign(input) {
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['creation', 'workspaceIndexEtag'])); required(input, new Set(['creation']));
    const creation = validateCampaignCreation(input.creation);
    const [workspaceRecord, indexRecord] = await Promise.all([
      this.store.get(workspaceSourceManifestKey(creation.workspaceId)),
      this.store.get(workspaceCampaignIndexKey(creation.workspaceId))
    ]);
    requireRecord(workspaceRecord, 'workspace_not_found', 'Workspace is not sealed', '$.workspaceId');
    assertOptionalExpectedEtag(input.workspaceIndexEtag, indexRecord, '$.workspaceIndexEtag');
    const index = indexRecord ? validateWorkspaceIndex(parse(indexRecord), creation.workspaceId) : emptyWorkspaceIndex(creation.workspaceId);
    if (index.campaigns.includes(creation.campaignId)) throw new ValidationError('campaign_exists', 'Campaign already exists', '$.campaignId');
    const current = { schemaVersion: 'campaign-current-v1', campaignId: creation.campaignId, workspaceId: creation.workspaceId, state: 'active', revision: 1, updatedAt: creation.createdAt };
    const updatedIndex = { ...index, campaigns: [...index.campaigns, creation.campaignId].sort(), records: { ...(index.records ?? {}), [creation.campaignId]: { state: 'active', createdAt: creation.createdAt } } };
    await this.store.put(campaignCreationKey(creation.campaignId), JSON.stringify(creation), createOnly());
    await this.store.put(campaignCurrentKey(creation.campaignId), JSON.stringify(current), createOnly());
    await this.store.put(workspaceCampaignIndexKey(creation.workspaceId), JSON.stringify(updatedIndex), indexWriteCondition(indexRecord));
    return Object.freeze({ campaignId: creation.campaignId, current: Object.freeze(current) });
  }

  async submitJob(input) {
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['request', 'jobIndexEtag'])); required(input, new Set(['request']));
    const request = validateJobRequest(input.request);
    const [campaignRecord, profileRecord, indexRecord] = await Promise.all([
      this.store.get(campaignCurrentKey(request.campaignId)),
      this.store.get(profileIndexKey()),
      this.store.get(campaignJobIndexKey(request.campaignId))
    ]);
    const campaign = validateCampaign(parse(requireRecord(campaignRecord, 'campaign_not_found', 'Campaign not found', '$.campaignId')), request.campaignId, request.workspaceId);
    validateProfile(parse(requireRecord(profileRecord, 'profile_index_not_found', 'Profile index not found', '$.profileId')), request.profileId);
    assertOptionalExpectedEtag(input.jobIndexEtag, indexRecord, '$.jobIndexEtag');
    const index = indexRecord ? validateJobIndex(parse(indexRecord), request.campaignId) : emptyJobIndex(request.campaignId);
    if (index.jobs.includes(request.jobId)) throw new ValidationError('job_exists', 'Job already exists', '$.jobId');
    if (Object.values(index.records ?? {}).some((entry) => entry?.idempotencyKey === request.idempotencyKey)) throw new ValidationError('idempotency_conflict', 'Idempotency key already exists in this campaign', '$.idempotencyKey');
    const at = instant(this.now);
    const status = validateJobStatus({ schemaVersion: 'audit-job-status-v1', jobId: request.jobId, campaignId: request.campaignId, state: 'awaiting_executor', revision: 5, highestLogSequence: 0, updatedAt: at, executionEnabled: false });
    const policy = { schemaVersion: 'audit-policy-decision-v1', jobId: request.jobId, campaignId: request.campaignId, decision: 'admitted_metadata_only', executionEnabled: false, decidedAt: at };
    const events = makeBatch(request.jobId, 1, at, [{ type: 'job_submitted', at }, { type: 'job_validating', at }, { type: 'job_admitted', at }, { type: 'job_queued', at }, { type: 'job_awaiting_executor', at }]);
    const updatedIndex = { ...index, jobs: [...index.jobs, request.jobId].sort(), records: { ...(index.records ?? {}), [request.jobId]: { state: status.state, profileId: request.profileId, submittedAt: request.submittedAt, idempotencyKey: request.idempotencyKey } } };
    if (metadataSize(request) > 64_000 || metadataSize(policy) > 32_000 || metadataSize(status) > 32_000) throw new ValidationError('job_metadata_too_large', 'Job metadata exceeds Phase 3 limits', '$');
    await this.store.put(jobRequestKey(request.jobId), JSON.stringify(request), createOnly());
    await this.store.put(jobPolicyKey(request.jobId), JSON.stringify(policy), createOnly());
    await this.store.put(jobStatusKey(request.jobId), JSON.stringify(status), createOnly());
    await this.store.put(campaignJobIndexKey(request.campaignId), JSON.stringify(updatedIndex), indexWriteCondition(indexRecord));
    await this.store.put(eventBatchKey(request.jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    return Object.freeze({ campaign, status: Object.freeze(status), error: Object.freeze({ code: 'execution_plane_unavailable', message: 'Submitted Audit execution is disabled until the hardened executor is approved' }) });
  }

  async claimAttempt(input) {
    if (!this.trustedFixture) throw new ValidationError('trusted_fixture_required', 'Attempt claims require explicit trusted fixture authorization', '$');
    object(input); scanAuditForbiddenFields(input); allowed(input, new Set(['jobId', 'attemptId'])); required(input, new Set(['jobId', 'attemptId']));
    assertAuditId(input.jobId, 'job', '$.jobId'); assertAuditId(input.attemptId, 'attempt', '$.attemptId');
    const requestRecord = await this.store.get(jobRequestKey(input.jobId));
    const request = validateJobRequest(parse(requireRecord(requestRecord, 'job_request_not_found', 'Job request not found', '$.jobId')));
    const [statusRecord, campaignRecord] = await Promise.all([this.store.get(jobStatusKey(input.jobId)), this.store.get(campaignCurrentKey(request.campaignId))]);
    const current = validateJobStatus(parse(requireRecord(statusRecord, 'job_not_found', 'Job not found', '$.jobId')));
    validateCampaign(parse(requireRecord(campaignRecord, 'campaign_not_found', 'Campaign not found', '$.campaignId')), request.campaignId, request.workspaceId);
    if (current.campaignId !== request.campaignId) throw new ValidationError('campaign_mismatch', 'Job status and request campaign differ', '$.campaignId');
    assertJobTransition(current.state, 'provisioning', { trustedFixture: true });
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state: 'provisioning', revision: current.revision + 1, updatedAt: at, attemptId: input.attemptId, executionEnabled: false });
    const attempt = { schemaVersion: 'audit-attempt-v1', attemptId: input.attemptId, jobId: input.jobId, campaignId: current.campaignId, state: 'provisioning', trustedFixture: true, createdAt: at };
    const events = makeBatch(input.jobId, next.revision, at, [{ type: 'trusted_fixture_attempt_claimed', at, attemptId: input.attemptId }]);
    await this.store.put(attemptKey(input.jobId, input.attemptId), JSON.stringify(attempt), createOnly());
    await this.store.put(jobStatusKey(input.jobId), JSON.stringify(next), match(statusRecord.etag));
    await this.store.put(eventBatchKey(input.jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    return Object.freeze({ attempt: Object.freeze(attempt), status: Object.freeze(next) });
  }

  async heartbeat(input) {
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['jobId', 'attemptId', 'state', 'statusEtag'])); required(input, new Set(['jobId', 'attemptId', 'state']));
    assertAuditId(input.jobId, 'job', '$.jobId'); assertAuditId(input.attemptId, 'attempt', '$.attemptId');
    if (!ACTIVE_STATES.has(input.state)) throw new ValidationError('invalid_heartbeat_state', '$.state must be an active job state', '$.state');
    const statusRecord = requireRecord(await this.store.get(jobStatusKey(input.jobId)), 'job_not_found', 'Job not found', '$.jobId');
    assertOptionalExpectedEtag(input.statusEtag, statusRecord, '$.statusEtag', 'stale_status');
    const current = validateJobStatus(parse(statusRecord));
    if (current.attemptId !== input.attemptId) throw new ValidationError('attempt_mismatch', 'Heartbeat attempt does not match current job attempt', '$.attemptId');
    if (!ACTIVE_STATES.has(current.state)) throw new ValidationError('invalid_heartbeat_state', 'Current job state is not active', '$.state');
    if (input.state !== current.state) assertJobTransition(current.state, input.state, { trustedFixture: this.trustedFixture });
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state: input.state, revision: current.revision + 1, updatedAt: at, executionEnabled: false });
    await this.store.put(jobStatusKey(input.jobId), JSON.stringify(next), match(statusRecord.etag));
    return Object.freeze(next);
  }

  async appendEventBatch(batch) {
    const validated = validateEventBatch(batch);
    await this.store.put(eventBatchKey(validated.jobId, validated.batchId), `${JSON.stringify(validated)}\n`, createOnly());
    return Object.freeze(validated);
  }

  async pollJob(jobId) {
    assertAuditId(jobId, 'job', '$.jobId');
    const record = await this.store.get(jobStatusKey(jobId));
    return Object.freeze(validateJobStatus(parse(requireRecord(record, 'job_not_found', 'Job not found', '$.jobId'))));
  }

  async completeJob(input) {
    if (!this.trustedFixture) throw new ValidationError('trusted_fixture_required', 'Job completion requires explicit trusted fixture authorization', '$');
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['jobId', 'attemptId', 'finalState', 'reason', 'statusEtag'])); required(input, new Set(['jobId', 'attemptId', 'finalState']));
    assertAuditId(input.jobId, 'job', '$.jobId'); assertAuditId(input.attemptId, 'attempt', '$.attemptId');
    const statusRecord = requireRecord(await this.store.get(jobStatusKey(input.jobId)), 'job_not_found', 'Job not found', '$.jobId');
    assertOptionalExpectedEtag(input.statusEtag, statusRecord, '$.statusEtag', 'stale_status');
    const current = validateJobStatus(parse(statusRecord));
    if (current.attemptId !== input.attemptId) throw new ValidationError('attempt_mismatch', 'Completion attempt does not match current job attempt', '$.attemptId');
    assertJobTransition(current.state, input.finalState, { trustedFixture: true });
    const indexRecord = await this.store.get(campaignJobIndexKey(current.campaignId));
    const index = validateJobIndex(parse(requireRecord(indexRecord, 'job_index_not_found', 'Campaign job index not found', '$.campaignId')), current.campaignId);
    if (!index.jobs.includes(current.jobId)) throw new ValidationError('job_index_mismatch', 'Campaign job index does not contain the job', '$.jobId');
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state: input.finalState, revision: current.revision + 1, updatedAt: at, executionEnabled: false, ...(input.reason ? { reason: input.reason } : {}) });
    const events = makeBatch(current.jobId, next.revision, at, [{ type: `job_${input.finalState}`, at, ...(input.reason ? { reason: input.reason } : {}) }]);
    const updatedIndex = { ...index, records: { ...(index.records ?? {}), [current.jobId]: { ...(index.records?.[current.jobId] ?? {}), state: input.finalState, completedAt: at } } };
    await this.store.put(jobStatusKey(current.jobId), JSON.stringify(next), match(statusRecord.etag));
    await this.store.put(eventBatchKey(current.jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
    return Object.freeze({ status: Object.freeze(next) });
  }

  async cancelJob(jobId, reason = 'cancelled') {
    assertAuditId(jobId, 'job', '$.jobId');
    const statusRecord = await this.store.get(jobStatusKey(jobId));
    const current = validateJobStatus(parse(requireRecord(statusRecord, 'job_not_found', 'Job not found', '$.jobId')));
    assertJobTransition(current.state, 'cancelled');
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state: 'cancelled', revision: current.revision + 1, updatedAt: at, reason, executionEnabled: false });
    const events = makeBatch(jobId, next.revision, at, [{ type: 'job_cancelled', at, reason }]);
    await this.store.put(jobStatusKey(jobId), JSON.stringify(next), match(statusRecord.etag));
    await this.store.put(eventBatchKey(jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    return Object.freeze(next);
  }

  async transitionJob(jobId, state) {
    assertAuditId(jobId, 'job', '$.jobId');
    const statusRecord = await this.store.get(jobStatusKey(jobId));
    const current = validateJobStatus(parse(requireRecord(statusRecord, 'job_not_found', 'Job not found', '$.jobId')));
    assertJobTransition(current.state, state, { trustedFixture: this.trustedFixture });
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state, revision: current.revision + 1, updatedAt: at, executionEnabled: false });
    await this.store.put(jobStatusKey(jobId), JSON.stringify(next), match(statusRecord.etag));
    return Object.freeze(next);
  }
}
