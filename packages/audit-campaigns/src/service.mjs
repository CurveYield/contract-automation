import { ValidationError, assertAuditId, deepFreezeAuditValue, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';
import {
  TERMINAL_JOB_STATES,
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
import { ConditionalWriteError } from '../../audit-r2-store/src/index.mjs';

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
  if (typeof etag !== 'string' || !/^[0-9a-f]{64}$/.test(etag)) throw new ValidationError('missing_etag', 'A canonical ETag precondition is required', '$.etag');
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
function frozen(value) { return deepFreezeAuditValue(structuredClone(value)); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
async function putImmutableJson(store, key, value, conflictCode = 'immutable_conflict') {
  try {
    await store.put(key, JSON.stringify(value), createOnly());
    return false;
  } catch (error) {
    if (!(error instanceof ConditionalWriteError)) throw error;
    const existing = await store.get(key);
    if (!existing || !sameJson(parse(existing), value)) throw new ValidationError(conflictCode, `Existing immutable object at ${key} differs from the retry`, '$');
    return true;
  }
}
async function putImmutableText(store, key, value, conflictCode = 'immutable_conflict') {
  try {
    await store.put(key, value, createOnly());
    return false;
  } catch (error) {
    if (!(error instanceof ConditionalWriteError)) throw error;
    const existing = await store.get(key);
    const text = existing ? (typeof existing.value === 'string' ? existing.value : decoder.decode(existing.value)) : null;
    if (text !== value) throw new ValidationError(conflictCode, `Existing immutable object at ${key} differs from the retry`, '$');
    return true;
  }
}
function validateWorkspaceIndex(value, workspaceId) {
  object(value, '$.workspaceIndex'); scanAuditForbiddenFields(value, '$.workspaceIndex');
  const keys = new Set(['schemaVersion', 'workspaceId', 'campaigns', 'records']);
  allowed(value, keys, '$.workspaceIndex'); required(value, new Set(['schemaVersion', 'workspaceId', 'campaigns']), '$.workspaceIndex');
  if (value.schemaVersion !== 'workspace-campaign-index-v1' || value.workspaceId !== workspaceId || !Array.isArray(value.campaigns)) throw new ValidationError('invalid_campaign_index', 'Workspace campaign index is invalid', '$.workspaceIndex');
  value.campaigns.forEach((id, index) => assertAuditId(id, 'campaign', `$.workspaceIndex.campaigns[${index}]`));
  if (new Set(value.campaigns).size !== value.campaigns.length || JSON.stringify(value.campaigns) !== JSON.stringify([...value.campaigns].sort())) throw new ValidationError('noncanonical_campaign_index', 'Campaign IDs must be unique and sorted', '$.workspaceIndex.campaigns');
  const records = value.records ?? {};
  object(records, '$.workspaceIndex.records');
  if (JSON.stringify(Object.keys(records).sort()) !== JSON.stringify(value.campaigns)) throw new ValidationError('campaign_index_mismatch', 'Campaign records must exactly match campaign IDs', '$.workspaceIndex.records');
  return frozen({ schemaVersion: value.schemaVersion, workspaceId, campaigns: value.campaigns, records });
}
function emptyWorkspaceIndex(workspaceId) { return frozen({ schemaVersion: 'workspace-campaign-index-v1', workspaceId, campaigns: [], records: {} }); }
function validateJobIndex(value, campaignId) {
  object(value, '$.jobIndex'); scanAuditForbiddenFields(value, '$.jobIndex');
  const keys = new Set(['schemaVersion', 'campaignId', 'jobs', 'records']);
  allowed(value, keys, '$.jobIndex'); required(value, new Set(['schemaVersion', 'campaignId', 'jobs']), '$.jobIndex');
  if (value.schemaVersion !== 'campaign-job-index-v1' || value.campaignId !== campaignId || !Array.isArray(value.jobs)) throw new ValidationError('invalid_job_index', 'Campaign job index is invalid', '$.jobIndex');
  value.jobs.forEach((id, index) => assertAuditId(id, 'job', `$.jobIndex.jobs[${index}]`));
  if (new Set(value.jobs).size !== value.jobs.length || JSON.stringify(value.jobs) !== JSON.stringify([...value.jobs].sort())) throw new ValidationError('noncanonical_job_index', 'Job IDs must be unique and sorted', '$.jobIndex.jobs');
  const records = value.records ?? {};
  object(records, '$.jobIndex.records');
  if (JSON.stringify(Object.keys(records).sort()) !== JSON.stringify(value.jobs)) throw new ValidationError('job_index_mismatch', 'Job records must exactly match job IDs', '$.jobIndex.records');
  return frozen({ schemaVersion: value.schemaVersion, campaignId, jobs: value.jobs, records });
}
function emptyJobIndex(campaignId) { return frozen({ schemaVersion: 'campaign-job-index-v1', campaignId, jobs: [], records: {} }); }
function validateCampaign(value, campaignId, workspaceId) {
  object(value, '$.campaign'); scanAuditForbiddenFields(value, '$.campaign');
  if (value.schemaVersion !== 'campaign-current-v1' || value.campaignId !== campaignId || value.workspaceId !== workspaceId || value.state !== 'active') throw new ValidationError('campaign_unavailable', 'Campaign is not active for the requested workspace', '$.campaignId');
  return frozen(value);
}
function validateProfile(value, profileId) {
  object(value, '$.profiles'); scanAuditForbiddenFields(value, '$.profiles');
  if (value.schemaVersion !== 'profile-index-v1' || !Array.isArray(value.profiles) || !value.profiles.includes(profileId)) throw new ValidationError('profile_not_found', 'Audit profile is not published', '$.profileId');
  if (value.records?.[profileId]?.revoked === true) throw new ValidationError('profile_revoked', 'Audit profile is revoked', '$.profileId');
}
function updatedJobIndex(index, jobId, patch) {
  if (!index.jobs.includes(jobId)) throw new ValidationError('job_index_mismatch', 'Campaign job index does not contain the job', '$.jobId');
  return validateJobIndex({
    ...index,
    records: { ...index.records, [jobId]: { ...index.records[jobId], ...patch } }
  }, index.campaignId);
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
    const current = frozen({ schemaVersion: 'campaign-current-v1', campaignId: creation.campaignId, workspaceId: creation.workspaceId, state: 'active', revision: 1, updatedAt: creation.createdAt });
    if (index.campaigns.includes(creation.campaignId)) {
      const [storedCreation, storedCurrent] = await Promise.all([
        this.store.get(campaignCreationKey(creation.campaignId)),
        this.store.get(campaignCurrentKey(creation.campaignId))
      ]);
      if (!storedCreation || !storedCurrent || !sameJson(parse(storedCreation), creation) || !sameJson(parse(storedCurrent), current)) throw new ValidationError('campaign_conflict', 'Existing campaign differs from the retry', '$.campaignId');
      return frozen({ campaignId: creation.campaignId, current, idempotent: true, recoveredPartialPublication: false });
    }
    const updatedIndex = validateWorkspaceIndex({ ...index, campaigns: [...index.campaigns, creation.campaignId].sort(), records: { ...index.records, [creation.campaignId]: { state: 'active', createdAt: creation.createdAt } } }, creation.workspaceId);
    const recoveredCreation = await putImmutableJson(this.store, campaignCreationKey(creation.campaignId), creation, 'campaign_conflict');
    const recoveredCurrent = await putImmutableJson(this.store, campaignCurrentKey(creation.campaignId), current, 'campaign_conflict');
    await this.store.put(workspaceCampaignIndexKey(creation.workspaceId), JSON.stringify(updatedIndex), indexWriteCondition(indexRecord));
    return frozen({ campaignId: creation.campaignId, current, idempotent: false, recoveredPartialPublication: recoveredCreation || recoveredCurrent });
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
    if (index.jobs.includes(request.jobId)) {
      const [storedRequest, storedStatus] = await Promise.all([this.store.get(jobRequestKey(request.jobId)), this.store.get(jobStatusKey(request.jobId))]);
      if (!storedRequest || !storedStatus || !sameJson(parse(storedRequest), request)) throw new ValidationError('job_conflict', 'Existing job differs from the retry', '$.jobId');
      const status = validateJobStatus(parse(storedStatus));
      return frozen({ campaign, status, idempotent: true, recoveredPartialPublication: false, error: { code: 'execution_plane_unavailable', message: 'Submitted Audit execution is disabled until the hardened executor is approved' } });
    }
    if (Object.values(index.records).some((entry) => entry?.idempotencyKey === request.idempotencyKey)) throw new ValidationError('idempotency_conflict', 'Idempotency key already exists in this campaign', '$.idempotencyKey');
    const at = instant(this.now);
    const status = validateJobStatus({ schemaVersion: 'audit-job-status-v1', jobId: request.jobId, campaignId: request.campaignId, state: 'awaiting_executor', revision: 5, highestLogSequence: 0, updatedAt: at, executionEnabled: false });
    const policy = frozen({ schemaVersion: 'audit-policy-decision-v1', jobId: request.jobId, campaignId: request.campaignId, decision: 'admitted_metadata_only', executionEnabled: false, decidedAt: at });
    const events = makeBatch(request.jobId, 1, at, [{ type: 'job_submitted', at }, { type: 'job_validating', at }, { type: 'job_admitted', at }, { type: 'job_queued', at }, { type: 'job_awaiting_executor', at }]);
    const updatedIndex = validateJobIndex({ ...index, jobs: [...index.jobs, request.jobId].sort(), records: { ...index.records, [request.jobId]: { state: status.state, profileId: request.profileId, submittedAt: request.submittedAt, idempotencyKey: request.idempotencyKey } } }, request.campaignId);
    if (metadataSize(request) > 64_000 || metadataSize(policy) > 32_000 || metadataSize(status) > 32_000) throw new ValidationError('job_metadata_too_large', 'Job metadata exceeds Phase 3 limits', '$');
    const recoveredRequest = await putImmutableJson(this.store, jobRequestKey(request.jobId), request, 'job_conflict');
    const recoveredPolicy = await putImmutableJson(this.store, jobPolicyKey(request.jobId), policy, 'job_conflict');
    const recoveredStatus = await putImmutableJson(this.store, jobStatusKey(request.jobId), status, 'job_conflict');
    const recoveredEvent = await putImmutableText(this.store, eventBatchKey(request.jobId, events.batchId), `${JSON.stringify(events)}\n`, 'job_conflict');
    await this.store.put(campaignJobIndexKey(request.campaignId), JSON.stringify(updatedIndex), indexWriteCondition(indexRecord));
    return frozen({ campaign, status, idempotent: false, recoveredPartialPublication: recoveredRequest || recoveredPolicy || recoveredStatus || recoveredEvent, error: { code: 'execution_plane_unavailable', message: 'Submitted Audit execution is disabled until the hardened executor is approved' } });
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
    const at = instant(this.now);
    if (current.state === 'provisioning' && current.attemptId === input.attemptId) {
      const attempt = frozen({ schemaVersion: 'audit-attempt-v1', attemptId: input.attemptId, jobId: input.jobId, campaignId: current.campaignId, state: 'provisioning', trustedFixture: true, createdAt: current.updatedAt });
      const events = makeBatch(input.jobId, current.revision, current.updatedAt, [{ type: 'trusted_fixture_attempt_claimed', at: current.updatedAt, attemptId: input.attemptId }]);
      const recoveredAttempt = await putImmutableJson(this.store, attemptKey(input.jobId, input.attemptId), attempt, 'attempt_conflict');
      const recoveredEvent = await putImmutableText(this.store, eventBatchKey(input.jobId, events.batchId), `${JSON.stringify(events)}\n`, 'attempt_conflict');
      return frozen({ attempt, status: current, idempotent: true, recoveredPartialPublication: recoveredAttempt || recoveredEvent });
    }
    assertJobTransition(current.state, 'provisioning', { trustedFixture: true });
    const next = validateJobStatus({ ...current, state: 'provisioning', revision: current.revision + 1, updatedAt: at, attemptId: input.attemptId, executionEnabled: false });
    const attempt = frozen({ schemaVersion: 'audit-attempt-v1', attemptId: input.attemptId, jobId: input.jobId, campaignId: current.campaignId, state: 'provisioning', trustedFixture: true, createdAt: at });
    const events = makeBatch(input.jobId, next.revision, at, [{ type: 'trusted_fixture_attempt_claimed', at, attemptId: input.attemptId }]);
    const recoveredAttempt = await putImmutableJson(this.store, attemptKey(input.jobId, input.attemptId), attempt, 'attempt_conflict');
    await this.store.put(jobStatusKey(input.jobId), JSON.stringify(next), match(statusRecord.etag));
    const recoveredEvent = await putImmutableText(this.store, eventBatchKey(input.jobId, events.batchId), `${JSON.stringify(events)}\n`, 'attempt_conflict');
    return frozen({ attempt, status: next, idempotent: false, recoveredPartialPublication: recoveredAttempt || recoveredEvent });
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
    const indexRecord = requireRecord(await this.store.get(campaignJobIndexKey(current.campaignId)), 'job_index_not_found', 'Campaign job index not found', '$.campaignId');
    const index = validateJobIndex(parse(indexRecord), current.campaignId);
    const updated = updatedJobIndex(index, current.jobId, { state: next.state, updatedAt: at });
    await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updated), match(indexRecord.etag));
    return next;
  }

  async appendEventBatch(batch) {
    const validated = validateEventBatch(batch);
    const recovered = await putImmutableText(this.store, eventBatchKey(validated.jobId, validated.batchId), `${JSON.stringify(validated)}\n`, 'event_conflict');
    return frozen({ batch: validated, recoveredPartialPublication: recovered });
  }

  async pollJob(jobId) {
    assertAuditId(jobId, 'job', '$.jobId');
    const record = await this.store.get(jobStatusKey(jobId));
    return validateJobStatus(parse(requireRecord(record, 'job_not_found', 'Job not found', '$.jobId')));
  }

  async completeJob(input) {
    if (!this.trustedFixture) throw new ValidationError('trusted_fixture_required', 'Job completion requires explicit trusted fixture authorization', '$');
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['jobId', 'attemptId', 'finalState', 'reason', 'statusEtag'])); required(input, new Set(['jobId', 'attemptId', 'finalState']));
    assertAuditId(input.jobId, 'job', '$.jobId'); assertAuditId(input.attemptId, 'attempt', '$.attemptId');
    if (!TERMINAL_JOB_STATES.includes(input.finalState)) throw new ValidationError('invalid_terminal_state', '$.finalState must be terminal', '$.finalState');
    const statusRecord = requireRecord(await this.store.get(jobStatusKey(input.jobId)), 'job_not_found', 'Job not found', '$.jobId');
    assertOptionalExpectedEtag(input.statusEtag, statusRecord, '$.statusEtag', 'stale_status');
    const current = validateJobStatus(parse(statusRecord));
    if (current.attemptId !== input.attemptId) throw new ValidationError('attempt_mismatch', 'Completion attempt does not match current job attempt', '$.attemptId');
    const indexRecord = requireRecord(await this.store.get(campaignJobIndexKey(current.campaignId)), 'job_index_not_found', 'Campaign job index not found', '$.campaignId');
    const index = validateJobIndex(parse(indexRecord), current.campaignId);
    if (current.state === input.finalState) {
      if ((input.reason ?? undefined) !== current.reason) throw new ValidationError('completion_conflict', 'Existing terminal reason differs from the retry', '$.reason');
      const events = makeBatch(current.jobId, current.revision, current.updatedAt, [{ type: `job_${input.finalState}`, at: current.updatedAt, ...(input.reason ? { reason: input.reason } : {}) }]);
      const recoveredEvent = await putImmutableText(this.store, eventBatchKey(current.jobId, events.batchId), `${JSON.stringify(events)}\n`, 'completion_conflict');
      const updatedIndex = updatedJobIndex(index, current.jobId, { state: input.finalState, completedAt: current.updatedAt, ...(input.reason ? { reason: input.reason } : {}) });
      let recoveredIndex = false;
      if (!sameJson(index, updatedIndex)) {
        await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
        recoveredIndex = true;
      }
      return frozen({ status: current, idempotent: true, recoveredPartialPublication: recoveredEvent || recoveredIndex });
    }
    assertJobTransition(current.state, input.finalState, { trustedFixture: true });
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state: input.finalState, revision: current.revision + 1, updatedAt: at, executionEnabled: false, ...(input.reason ? { reason: input.reason } : {}) });
    const events = makeBatch(current.jobId, next.revision, at, [{ type: `job_${input.finalState}`, at, ...(input.reason ? { reason: input.reason } : {}) }]);
    const updatedIndex = updatedJobIndex(index, current.jobId, { state: input.finalState, completedAt: at, ...(input.reason ? { reason: input.reason } : {}) });
    await this.store.put(jobStatusKey(current.jobId), JSON.stringify(next), match(statusRecord.etag));
    const recoveredEvent = await putImmutableText(this.store, eventBatchKey(current.jobId, events.batchId), `${JSON.stringify(events)}\n`, 'completion_conflict');
    await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
    return frozen({ status: next, idempotent: false, recoveredPartialPublication: recoveredEvent });
  }

  async cancelJob(jobId, reason = 'cancelled') {
    assertAuditId(jobId, 'job', '$.jobId');
    if (typeof reason !== 'string' || reason.length < 1 || reason.length > 512) throw new ValidationError('invalid_reason', 'Cancellation reason is invalid', '$.reason');
    const statusRecord = requireRecord(await this.store.get(jobStatusKey(jobId)), 'job_not_found', 'Job not found', '$.jobId');
    const current = validateJobStatus(parse(statusRecord));
    const indexRecord = requireRecord(await this.store.get(campaignJobIndexKey(current.campaignId)), 'job_index_not_found', 'Campaign job index not found', '$.campaignId');
    const index = validateJobIndex(parse(indexRecord), current.campaignId);
    if (current.state === 'cancelled') {
      if (current.reason !== reason) throw new ValidationError('cancellation_conflict', 'Existing cancellation reason differs from the retry', '$.reason');
      const events = makeBatch(jobId, current.revision, current.updatedAt, [{ type: 'job_cancelled', at: current.updatedAt, reason }]);
      const recoveredEvent = await putImmutableText(this.store, eventBatchKey(jobId, events.batchId), `${JSON.stringify(events)}\n`, 'cancellation_conflict');
      const updatedIndex = updatedJobIndex(index, jobId, { state: 'cancelled', completedAt: current.updatedAt, reason });
      let recoveredIndex = false;
      if (!sameJson(index, updatedIndex)) {
        await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
        recoveredIndex = true;
      }
      return frozen({ status: current, idempotent: true, recoveredPartialPublication: recoveredEvent || recoveredIndex });
    }
    assertJobTransition(current.state, 'cancelled');
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state: 'cancelled', revision: current.revision + 1, updatedAt: at, reason, executionEnabled: false });
    const events = makeBatch(jobId, next.revision, at, [{ type: 'job_cancelled', at, reason }]);
    const updatedIndex = updatedJobIndex(index, jobId, { state: 'cancelled', completedAt: at, reason });
    await this.store.put(jobStatusKey(jobId), JSON.stringify(next), match(statusRecord.etag));
    const recoveredEvent = await putImmutableText(this.store, eventBatchKey(jobId, events.batchId), `${JSON.stringify(events)}\n`, 'cancellation_conflict');
    await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
    return frozen({ status: next, idempotent: false, recoveredPartialPublication: recoveredEvent });
  }

  async transitionJob(jobId, state) {
    assertAuditId(jobId, 'job', '$.jobId');
    if (!ACTIVE_STATES.has(state)) throw new ValidationError('managed_transition_required', 'Terminal transitions must use completeJob or cancelJob', '$.state');
    const statusRecord = requireRecord(await this.store.get(jobStatusKey(jobId)), 'job_not_found', 'Job not found', '$.jobId');
    const current = validateJobStatus(parse(statusRecord));
    assertJobTransition(current.state, state, { trustedFixture: this.trustedFixture });
    const at = instant(this.now);
    const next = validateJobStatus({ ...current, state, revision: current.revision + 1, updatedAt: at, executionEnabled: false });
    const events = makeBatch(jobId, next.revision, at, [{ type: `job_${state}`, at }]);
    const indexRecord = requireRecord(await this.store.get(campaignJobIndexKey(current.campaignId)), 'job_index_not_found', 'Campaign job index not found', '$.campaignId');
    const index = validateJobIndex(parse(indexRecord), current.campaignId);
    const updatedIndex = updatedJobIndex(index, jobId, { state, updatedAt: at });
    await this.store.put(jobStatusKey(jobId), JSON.stringify(next), match(statusRecord.etag));
    const recoveredEvent = await putImmutableText(this.store, eventBatchKey(jobId, events.batchId), `${JSON.stringify(events)}\n`, 'transition_conflict');
    await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
    return frozen({ status: next, recoveredPartialPublication: recoveredEvent });
  }
}
