import { ValidationError, assertAuditId, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';
import {
  assertJobTransition,
  campaignCreationKey,
  campaignCurrentKey,
  campaignJobIndexKey,
  eventBatchKey,
  jobPolicyKey,
  jobRequestKey,
  jobStatusKey,
  attemptKey,
  validateCampaignCreation,
  validateEventBatch,
  validateJobRequest,
  validateJobStatus,
  workspaceCampaignIndexKey
} from '../../audit-campaign-protocol/src/index.mjs';
import { workspaceSourceManifestKey } from '../../audit-workspace-protocol/src/index.mjs';
import { profileIndexKey } from '../../audit-profile-registry/src/index.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
function jsonBytes(value) { return encoder.encode(JSON.stringify(value)).byteLength; }
function nowDate(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('now must produce a valid date');
  return date;
}
function batchId(revision) { return String(revision).padStart(8, '0'); }
function createOnly() { return { onlyIf: { etagDoesNotMatch: '*' } }; }
function match(etag) {
  if (typeof etag !== 'string' || etag.length < 1) throw new ValidationError('missing_etag', 'An ETag precondition is required', '$.etag');
  return { onlyIf: { etagMatches: etag } };
}
function assertRecord(record, code, message, path) {
  if (!record) throw new ValidationError(code, message, path);
  return record;
}
function validateWorkspaceCampaignIndex(value, workspaceId) {
  object(value, '$.workspaceIndex'); scanAuditForbiddenFields(value, '$.workspaceIndex');
  const keys = new Set(['schemaVersion', 'workspaceId', 'campaigns', 'records']);
  allowed(value, keys, '$.workspaceIndex'); required(value, new Set(['schemaVersion', 'workspaceId', 'campaigns']), '$.workspaceIndex');
  if (value.schemaVersion !== 'workspace-campaign-index-v1' || value.workspaceId !== workspaceId) throw new ValidationError('invalid_campaign_index', 'Workspace campaign index identity is invalid', '$.workspaceIndex');
  if (!Array.isArray(value.campaigns)) throw new ValidationError('invalid_campaign_index', '$.workspaceIndex.campaigns must be an array', '$.workspaceIndex.campaigns');
  value.campaigns.forEach((id, index) => assertAuditId(id, 'campaign', `$.workspaceIndex.campaigns[${index}]`));
  return structuredClone(value);
}
function validateCampaignJobIndex(value, campaignId) {
  object(value, '$.jobIndex'); scanAuditForbiddenFields(value, '$.jobIndex');
  const keys = new Set(['schemaVersion', 'campaignId', 'jobs', 'records']);
  allowed(value, keys, '$.jobIndex'); required(value, new Set(['schemaVersion', 'campaignId', 'jobs']), '$.jobIndex');
  if (value.schemaVersion !== 'campaign-job-index-v1' || value.campaignId !== campaignId) throw new ValidationError('invalid_job_index', 'Campaign job index identity is invalid', '$.jobIndex');
  if (!Array.isArray(value.jobs)) throw new ValidationError('invalid_job_index', '$.jobIndex.jobs must be an array', '$.jobIndex.jobs');
  value.jobs.forEach((id, index) => assertAuditId(id, 'job', `$.jobIndex.jobs[${index}]`));
  return structuredClone(value);
}
function validateCampaignCurrent(value, campaignId, workspaceId) {
  object(value, '$.campaign');
  if (value.schemaVersion !== 'campaign-current-v1' || value.campaignId !== campaignId || value.workspaceId !== workspaceId || value.state !== 'active') {
    throw new ValidationError('campaign_unavailable', 'Campaign is not active for the requested workspace', '$.campaignId');
  }
  return value;
}
function validateProfileIndex(value, profileId) {
  object(value, '$.profiles');
  if (value.schemaVersion !== 'profile-index-v1' || !Array.isArray(value.profiles) || !value.profiles.includes(profileId)) {
    throw new ValidationError('profile_not_found', 'Audit profile is not published', '$.profileId');
  }
  if (value.records?.[profileId]?.revoked === true) throw new ValidationError('profile_revoked', 'Audit profile is revoked', '$.profileId');
  return value;
}
function eventBatch(jobId, revision, at, events) {
  return validateEventBatch({ schemaVersion: 'audit-event-batch-v1', jobId, batchId: batchId(revision), createdAt: at, events });
}
function publicAwaitingStatus(request, at) {
  return validateJobStatus({
    schemaVersion: 'audit-job-status-v1', jobId: request.jobId, campaignId: request.campaignId,
    state: 'awaiting_executor', revision: 5, highestLogSequence: 0, updatedAt: at, executionEnabled: false
  });
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
    allowed(input, new Set(['creation', 'workspaceIndexEtag'])); required(input, new Set(['creation', 'workspaceIndexEtag']));
    const creation = validateCampaignCreation(input.creation);
    const [workspaceRecord, indexRecord] = await Promise.all([
      this.store.get(workspaceSourceManifestKey(creation.workspaceId)),
      this.store.get(workspaceCampaignIndexKey(creation.workspaceId))
    ]);
    assertRecord(workspaceRecord, 'workspace_not_found', 'Workspace is not sealed', '$.workspaceId');
    assertRecord(indexRecord, 'campaign_index_not_found', 'Workspace campaign index is missing', '$.workspaceId');
    if (indexRecord.etag !== input.workspaceIndexEtag) throw new ValidationError('stale_index', 'Workspace campaign index ETag is stale', '$.workspaceIndexEtag');
    const workspaceIndex = validateWorkspaceCampaignIndex(parse(indexRecord), creation.workspaceId);
    if (workspaceIndex.campaigns.includes(creation.campaignId)) throw new ValidationError('campaign_exists', 'Campaign already exists', '$.campaignId');
    const current = {
      schemaVersion: 'campaign-current-v1', campaignId: creation.campaignId, workspaceId: creation.workspaceId,
      state: 'active', revision: 1, updatedAt: creation.createdAt
    };
    const updatedIndex = {
      ...workspaceIndex,
      campaigns: [...workspaceIndex.campaigns, creation.campaignId].sort(),
      records: { ...(workspaceIndex.records ?? {}), [creation.campaignId]: { state: 'active', createdAt: creation.createdAt } }
    };
    await this.store.put(campaignCreationKey(creation.campaignId), JSON.stringify(creation), createOnly());
    await this.store.put(campaignCurrentKey(creation.campaignId), JSON.stringify(current), createOnly());
    await this.store.put(workspaceCampaignIndexKey(creation.workspaceId), JSON.stringify(updatedIndex), match(indexRecord.etag));
    return Object.freeze({ campaignId: creation.campaignId, current: Object.freeze(current) });
  }

  async submitJob(input) {
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['request', 'jobIndexEtag'])); required(input, new Set(['request', 'jobIndexEtag']));
    const request = validateJobRequest(input.request);
    const [campaignRecord, profileRecord, indexRecord] = await Promise.all([
      this.store.get(campaignCurrentKey(request.campaignId)),
      this.store.get(profileIndexKey()),
      this.store.get(campaignJobIndexKey(request.campaignId))
    ]);
    const campaign = validateCampaignCurrent(parse(assertRecord(campaignRecord, 'campaign_not_found', 'Campaign not found', '$.campaignId')), request.campaignId, request.workspaceId);
    validateProfileIndex(parse(assertRecord(profileRecord, 'profile_index_not_found', 'Profile index not found', '$.profileId')), request.profileId);
    assertRecord(indexRecord, 'job_index_not_found', 'Campaign job index is missing', '$.campaignId');
    if (indexRecord.etag !== input.jobIndexEtag) throw new ValidationError('stale_index', 'Campaign job index ETag is stale', '$.jobIndexEtag');
    const index = validateCampaignJobIndex(parse(indexRecord), request.campaignId);
    if (index.jobs.includes(request.jobId)) throw new ValidationError('job_exists', 'Job already exists', '$.jobId');
    const at = nowDate(this.now).toISOString();
    const status = publicAwaitingStatus(request, at);
    const policy = {
      schemaVersion: 'audit-policy-decision-v1', jobId: request.jobId, campaignId: request.campaignId,
      decision: 'admitted_metadata_only', executionEnabled: false, decidedAt: at
    };
    const events = eventBatch(request.jobId, 1, at, [
      { type: 'job_submitted', at }, { type: 'job_validating', at }, { type: 'job_admitted', at },
      { type: 'job_queued', at }, { type: 'job_awaiting_executor', at }
    ]);
    const updatedIndex = {
      ...index,
      jobs: [...index.jobs, request.jobId].sort(),
      records: { ...(index.records ?? {}), [request.jobId]: { state: status.state, profileId: request.profileId, submittedAt: request.submittedAt } }
    };
    if (jsonBytes(request) > 64_000 || jsonBytes(policy) > 32_000 || jsonBytes(status) > 32_000) throw new ValidationError('job_metadata_too_large', 'Job metadata exceeds Phase 3 limits', '$');
    await this.store.put(jobRequestKey(request.jobId), JSON.stringify(request), createOnly());
    await this.store.put(jobPolicyKey(request.jobId), JSON.stringify(policy), createOnly());
    await this.store.put(jobStatusKey(request.jobId), JSON.stringify(status), createOnly());
    await this.store.put(campaignJobIndexKey(request.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
    await this.store.put(eventBatchKey(request.jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    return Object.freeze({
      campaign,
      status: Object.freeze(status),
      error: Object.freeze({ code: 'execution_plane_unavailable', message: 'Submitted Audit execution is disabled until the hardened executor is approved' })
    });
  }

  async claimAttempt(input) {
    if (!this.trustedFixture) throw new ValidationError('trusted_fixture_required', 'Attempt claims require explicit trusted fixture authorization', '$');
    object(input); scanAuditForbiddenFields(input); allowed(input, new Set(['jobId', 'attemptId'])); required(input, new Set(['jobId', 'attemptId']));
    assertAuditId(input.jobId, 'job', '$.jobId'); assertAuditId(input.attemptId, 'attempt', '$.attemptId');
    const [statusRecord, requestRecord, campaignRecord] = await Promise.all([
      this.store.get(jobStatusKey(input.jobId)),
      this.store.get(jobRequestKey(input.jobId)),
      this.store.get(campaignCurrentKey(parseIdCampaignFromStatusPlaceholder(input.jobId)))
    ]).catch(async (cause) => { throw cause; });
    const current = validateJobStatus(parse(assertRecord(statusRecord, 'job_not_found', 'Job not found', '$.jobId')));
    const request = validateJobRequest(parse(assertRecord(requestRecord, 'job_request_not_found', 'Job request not found', '$.jobId')));
    let effectiveCampaignRecord = campaignRecord;
    if (!effectiveCampaignRecord) effectiveCampaignRecord = await this.store.get(campaignCurrentKey(request.campaignId));
    validateCampaignCurrent(parse(assertRecord(effectiveCampaignRecord, 'campaign_not_found', 'Campaign not found', '$.campaignId')), request.campaignId, request.workspaceId);
    assertJobTransition(current.state, 'provisioning', { trustedFixture: true });
    const at = nowDate(this.now).toISOString();
    const next = validateJobStatus({ ...current, state: 'provisioning', revision: current.revision + 1, updatedAt: at, attemptId: input.attemptId, executionEnabled: false });
    const attempt = { schemaVersion: 'audit-attempt-v1', attemptId: input.attemptId, jobId: input.jobId, campaignId: current.campaignId, state: 'provisioning', trustedFixture: true, createdAt: at };
    const events = eventBatch(input.jobId, next.revision, at, [{ type: 'trusted_fixture_attempt_claimed', at, attemptId: input.attemptId }]);
    await this.store.put(attemptKey(input.jobId, input.attemptId), JSON.stringify(attempt), createOnly());
    await this.store.put(jobStatusKey(input.jobId), JSON.stringify(next), match(statusRecord.etag));
    await this.store.put(eventBatchKey(input.jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    return Object.freeze({ attempt: Object.freeze(attempt), status: Object.freeze(next) });
  }

  async heartbeat(input) {
    object(input); scanAuditForbiddenFields(input); allowed(input, new Set(['status', 'statusEtag'])); required(input, new Set(['status', 'statusEtag']));
    const status = validateJobStatus(input.status);
    if (!['provisioning', 'running', 'collecting_evidence'].includes(status.state)) throw new ValidationError('invalid_heartbeat_state', 'Heartbeat state is not active', '$.status.state');
    await this.store.put(jobStatusKey(status.jobId), JSON.stringify(status), match(input.statusEtag));
    return Object.freeze(status);
  }

  async appendEventBatch(batch) {
    const validated = validateEventBatch(batch);
    await this.store.put(eventBatchKey(validated.jobId, validated.batchId), `${JSON.stringify(validated)}\n`, createOnly());
    return Object.freeze(validated);
  }

  async pollJob(jobId) {
    assertAuditId(jobId, 'job', '$.jobId');
    const record = await this.store.get(jobStatusKey(jobId));
    return Object.freeze(validateJobStatus(parse(assertRecord(record, 'job_not_found', 'Job not found', '$.jobId'))));
  }

  async completeJob(input) {
    if (!this.trustedFixture) throw new ValidationError('trusted_fixture_required', 'Job completion requires explicit trusted fixture authorization', '$');
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['currentStatus', 'statusEtag', 'finalState', 'reason']));
    required(input, new Set(['currentStatus', 'statusEtag', 'finalState']));
    const current = validateJobStatus(input.currentStatus);
    assertJobTransition(current.state, input.finalState, { trustedFixture: true });
    const indexRecord = await this.store.get(campaignJobIndexKey(current.campaignId));
    const index = validateCampaignJobIndex(parse(assertRecord(indexRecord, 'job_index_not_found', 'Campaign job index not found', '$.campaignId')), current.campaignId);
    if (!index.jobs.includes(current.jobId)) throw new ValidationError('job_index_mismatch', 'Campaign job index does not contain the job', '$.jobId');
    const at = nowDate(this.now).toISOString();
    const next = validateJobStatus({ ...current, state: input.finalState, revision: current.revision + 1, updatedAt: at, executionEnabled: false, ...(input.reason ? { reason: input.reason } : {}) });
    const events = eventBatch(current.jobId, next.revision, at, [{ type: `job_${input.finalState}`, at, ...(input.reason ? { reason: input.reason } : {}) }]);
    const updatedIndex = { ...index, records: { ...(index.records ?? {}), [current.jobId]: { ...(index.records?.[current.jobId] ?? {}), state: input.finalState, completedAt: at } } };
    await this.store.put(jobStatusKey(current.jobId), JSON.stringify(next), match(input.statusEtag));
    await this.store.put(eventBatchKey(current.jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    await this.store.put(campaignJobIndexKey(current.campaignId), JSON.stringify(updatedIndex), match(indexRecord.etag));
    return Object.freeze({ status: Object.freeze(next) });
  }

  async cancelJob(jobId, reason = 'cancelled') {
    assertAuditId(jobId, 'job', '$.jobId');
    const statusRecord = await this.store.get(jobStatusKey(jobId));
    const current = validateJobStatus(parse(assertRecord(statusRecord, 'job_not_found', 'Job not found', '$.jobId')));
    assertJobTransition(current.state, 'cancelled');
    const at = nowDate(this.now).toISOString();
    const next = validateJobStatus({ ...current, state: 'cancelled', revision: current.revision + 1, updatedAt: at, reason, executionEnabled: false });
    const events = eventBatch(jobId, next.revision, at, [{ type: 'job_cancelled', at, reason }]);
    await this.store.put(jobStatusKey(jobId), JSON.stringify(next), match(statusRecord.etag));
    await this.store.put(eventBatchKey(jobId, events.batchId), `${JSON.stringify(events)}\n`, createOnly());
    return Object.freeze(next);
  }

  async transitionJob(jobId, state) {
    assertAuditId(jobId, 'job', '$.jobId');
    const statusRecord = await this.store.get(jobStatusKey(jobId));
    const current = validateJobStatus(parse(assertRecord(statusRecord, 'job_not_found', 'Job not found', '$.jobId')));
    assertJobTransition(current.state, state, { trustedFixture: this.trustedFixture });
    const at = nowDate(this.now).toISOString();
    const next = validateJobStatus({ ...current, state, revision: current.revision + 1, updatedAt: at, executionEnabled: false });
    await this.store.put(jobStatusKey(jobId), JSON.stringify(next), match(statusRecord.etag));
    return Object.freeze(next);
  }
}

function parseIdCampaignFromStatusPlaceholder() {
  // Deliberately returns a syntactically valid impossible campaign key so the third
  // parallel read remains budgeted; the real campaign ID is verified from the job request.
  return `cmp_${'0'.repeat(32)}`;
}
