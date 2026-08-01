import { ValidationError, assertAuditId, assertProfileId, createOperationBudget, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';

export const JOB_STATES = Object.freeze(['submitted','validating','admitted','queued','awaiting_executor','provisioning','running','collecting_evidence','completed','failed','cancelled','timed_out','policy_rejected']);
export const TERMINAL_JOB_STATES = Object.freeze(['completed','failed','cancelled','timed_out','policy_rejected']);
export const MAX_EVENT_BATCH_EVENTS = 32;
export const MAX_LOG_CHUNK_BYTES = 1_000_000;
export const MAX_LOG_CHUNKS_PER_ATTEMPT = 64;

export const CAMPAIGN_OPERATION_BUDGETS = Object.freeze({
  createCampaign: Object.freeze(createOperationBudget({ classA: 3, classB: 2, storageBytes: 64_000 })),
  submitJob: Object.freeze(createOperationBudget({ classA: 5, classB: 3, storageBytes: 128_000 })),
  claimAttempt: Object.freeze(createOperationBudget({ classA: 3, classB: 3, storageBytes: 64_000 })),
  heartbeat: Object.freeze(createOperationBudget({ classA: 1, classB: 1, storageBytes: 0 })),
  eventBatch: Object.freeze(createOperationBudget({ classA: 1, classB: 0, storageBytes: 256_000 })),
  logChunk: Object.freeze(createOperationBudget({ classA: 2, classB: 1, storageBytes: 1_000_000 })),
  readTypicalLogs: Object.freeze(createOperationBudget({ classA: 0, classB: 9, storageBytes: 0 })),
  rawArtifacts: Object.freeze(createOperationBudget({ classA: 2, classB: 2, storageBytes: 15_000_000 })),
  acceptEvidence: Object.freeze(createOperationBudget({ classA: 4, classB: 2, storageBytes: 10_000_000 })),
  publishReport: Object.freeze(createOperationBudget({ classA: 3, classB: 3, storageBytes: 1_000_000 })),
  completeJob: Object.freeze(createOperationBudget({ classA: 3, classB: 2, storageBytes: 32_000 })),
  pollJob: Object.freeze(createOperationBudget({ classA: 0, classB: 1, storageBytes: 0 }))
});

const TRANSITIONS = Object.freeze({
  submitted: ['validating','cancelled','policy_rejected'], validating: ['admitted','failed','cancelled','policy_rejected'], admitted: ['queued','cancelled'], queued: ['awaiting_executor','cancelled'], awaiting_executor: ['provisioning','cancelled'], provisioning: ['running','failed','cancelled','timed_out'], running: ['collecting_evidence','failed','cancelled','timed_out'], collecting_evidence: ['completed','failed','cancelled','timed_out'], completed: [], failed: [], cancelled: [], timed_out: [], policy_rejected: []
});

function object(value, path = '$') { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path); }
function allowed(value, keys, path = '$') { for (const key of Object.keys(value)) if (!keys.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`); }
function required(value, keys, path = '$') { for (const key of keys) if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`); }
function string(value, path, max = 256) { if (typeof value !== 'string' || value.length < 1 || value.length > max) throw new ValidationError('invalid_string', `${path} is invalid`, path); return value; }
function instant(value, path) { string(value, path, 40); const date = new Date(value); if (Number.isNaN(date.getTime()) || date.toISOString() !== value) throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO instant`, path); return value; }
function count(value, path, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new ValidationError('invalid_integer', `${path} is invalid`, path); return value; }
function batchId(value, path = '$.batchId') { if (typeof value !== 'string' || !/^[0-9]{8}$/.test(value)) throw new ValidationError('invalid_batch_id', `${path} must be eight digits`, path); return value; }
function sequence(value, path = '$.sequence') { count(value, path, 99_999_999); return String(value).padStart(8, '0'); }

export function assertJobState(value, path = '$.state') { if (!JOB_STATES.includes(value)) throw new ValidationError('invalid_job_state', `${path} is invalid`, path); return value; }
export function assertJobTransition(from, to, options = {}) {
  assertJobState(from, '$.from'); assertJobState(to, '$.to');
  if (TERMINAL_JOB_STATES.includes(from)) throw new ValidationError('terminal_state', `Cannot leave terminal state ${from}`, '$.from');
  if (!TRANSITIONS[from].includes(to)) throw new ValidationError('invalid_transition', `Transition ${from} -> ${to} is not allowed`, '$.to');
  if (from === 'awaiting_executor' && to === 'provisioning' && options.trustedFixture !== true) throw new ValidationError('trusted_fixture_required', 'Provisioning requires trusted fixture authorization until the executor is approved', '$.to');
  return true;
}

export function validateCampaignCreation(value) {
  object(value); scanAuditForbiddenFields(value); const keys = new Set(['schemaVersion','campaignId','workspaceId','name','createdAt','retentionPolicy']); allowed(value, keys); required(value, keys);
  if (value.schemaVersion !== 'campaign-creation-v1') throw new ValidationError('invalid_schema_version', '$.schemaVersion must be campaign-creation-v1', '$.schemaVersion');
  assertAuditId(value.campaignId, 'campaign', '$.campaignId'); assertAuditId(value.workspaceId, 'workspace', '$.workspaceId'); string(value.name, '$.name', 160); instant(value.createdAt, '$.createdAt');
  if (!['free-development','extended-90d','archive-365d'].includes(value.retentionPolicy)) throw new ValidationError('invalid_retention', '$.retentionPolicy is invalid', '$.retentionPolicy');
  return structuredClone(value);
}

export function validateJobRequest(value) {
  object(value); scanAuditForbiddenFields(value); const keys = new Set(['schemaVersion','jobId','campaignId','workspaceId','profileId','tool','configuration','resourceClass','timeoutSeconds','expectedEvidence','idempotencyKey','submittedAt']); allowed(value, keys); required(value, keys);
  if (value.schemaVersion !== 'audit-job-request-v1') throw new ValidationError('invalid_schema_version', '$.schemaVersion must be audit-job-request-v1', '$.schemaVersion');
  assertAuditId(value.jobId, 'job', '$.jobId'); assertAuditId(value.campaignId, 'campaign', '$.campaignId'); assertAuditId(value.workspaceId, 'workspace', '$.workspaceId'); assertProfileId(value.profileId, '$.profileId'); string(value.tool, '$.tool', 80); object(value.configuration, '$.configuration'); string(value.resourceClass, '$.resourceClass', 80); count(value.timeoutSeconds, '$.timeoutSeconds', 86_400); if (value.timeoutSeconds < 1) throw new ValidationError('invalid_timeout', '$.timeoutSeconds is invalid', '$.timeoutSeconds');
  if (!Array.isArray(value.expectedEvidence) || value.expectedEvidence.length > 64 || value.expectedEvidence.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 160)) throw new ValidationError('invalid_evidence', '$.expectedEvidence is invalid', '$.expectedEvidence');
  string(value.idempotencyKey, '$.idempotencyKey', 160); instant(value.submittedAt, '$.submittedAt'); return structuredClone(value);
}

export function validateJobStatus(value) {
  object(value); scanAuditForbiddenFields(value); const keys = new Set(['schemaVersion','jobId','campaignId','state','revision','highestLogSequence','updatedAt','executionEnabled','attemptId','reason']); allowed(value, keys); required(value, new Set(['schemaVersion','jobId','campaignId','state','revision','highestLogSequence','updatedAt','executionEnabled']));
  if (value.schemaVersion !== 'audit-job-status-v1') throw new ValidationError('invalid_schema_version', '$.schemaVersion must be audit-job-status-v1', '$.schemaVersion');
  assertAuditId(value.jobId, 'job', '$.jobId'); assertAuditId(value.campaignId, 'campaign', '$.campaignId'); assertJobState(value.state); count(value.revision, '$.revision'); count(value.highestLogSequence, '$.highestLogSequence', MAX_LOG_CHUNKS_PER_ATTEMPT); instant(value.updatedAt, '$.updatedAt');
  if (value.executionEnabled !== false) throw new ValidationError('execution_disabled', '$.executionEnabled must remain false', '$.executionEnabled');
  if (value.attemptId !== undefined) assertAuditId(value.attemptId, 'attempt', '$.attemptId'); if (value.reason !== undefined) string(value.reason, '$.reason', 512); return structuredClone(value);
}

export function validateEventBatch(value) {
  object(value); scanAuditForbiddenFields(value); const keys = new Set(['schemaVersion','jobId','batchId','createdAt','events']); allowed(value, keys); required(value, keys);
  if (value.schemaVersion !== 'audit-event-batch-v1') throw new ValidationError('invalid_schema_version', '$.schemaVersion must be audit-event-batch-v1', '$.schemaVersion');
  assertAuditId(value.jobId, 'job', '$.jobId'); batchId(value.batchId); instant(value.createdAt, '$.createdAt');
  if (!Array.isArray(value.events) || value.events.length < 1 || value.events.length > MAX_EVENT_BATCH_EVENTS) throw new ValidationError('invalid_event_batch', `$.events must contain 1 to ${MAX_EVENT_BATCH_EVENTS} events`, '$.events');
  value.events.forEach((event, index) => { object(event, `$.events[${index}]`); scanAuditForbiddenFields(event, `$.events[${index}]`); string(event.type, `$.events[${index}].type`, 80); instant(event.at, `$.events[${index}].at`); }); return structuredClone(value);
}

const id = (value, kind, path) => assertAuditId(value, kind, path);
export const campaignCreationKey = (campaignId) => `campaigns/${id(campaignId,'campaign','$.campaignId')}/creation-v1.json`;
export const campaignCurrentKey = (campaignId) => `campaigns/${id(campaignId,'campaign','$.campaignId')}/current-v1.json`;
export const workspaceCampaignIndexKey = (workspaceId) => `indexes/workspace/${id(workspaceId,'workspace','$.workspaceId')}/campaigns-v1.json`;
export const jobRequestKey = (jobId) => `jobs/${id(jobId,'job','$.jobId')}/request-v1.json`;
export const jobStatusKey = (jobId) => `jobs/${id(jobId,'job','$.jobId')}/status-v1.json`;
export const jobPolicyKey = (jobId) => `jobs/${id(jobId,'job','$.jobId')}/policy-v1.json`;
export const campaignJobIndexKey = (campaignId) => `indexes/campaign/${id(campaignId,'campaign','$.campaignId')}/jobs-v1.json`;
export const attemptKey = (jobId, attemptId) => `jobs/${id(jobId,'job','$.jobId')}/attempts/${id(attemptId,'attempt','$.attemptId')}-v1.json`;
export const eventBatchKey = (jobId, value) => `jobs/${id(jobId,'job','$.jobId')}/events/${batchId(value)}.jsonl`;
export const logChunkKey = (jobId, attemptId, value) => `job-logs/${id(jobId,'job','$.jobId')}/attempts/${id(attemptId,'attempt','$.attemptId')}/${sequence(value)}.log`;
export const logIndexKey = (jobId, attemptId) => `job-logs/${id(jobId,'job','$.jobId')}/attempts/${id(attemptId,'attempt','$.attemptId')}/index-v1.json`;
export const rawArtifactIngressKey = (jobId, attemptId, artifactId) => `ingress/jobs/${id(jobId,'job','$.jobId')}/attempts/${id(attemptId,'attempt','$.attemptId')}/artifacts/${id(artifactId,'artifact','$.artifactId')}.tar.zst`;
export const evidenceIngressKey = (jobId, attemptId, artifactId) => `ingress/jobs/${id(jobId,'job','$.jobId')}/attempts/${id(attemptId,'attempt','$.attemptId')}/evidence/${id(artifactId,'artifact','$.artifactId')}.tar.zst`;
export const reportIngressKey = (jobId, attemptId, artifactId) => `ingress/jobs/${id(jobId,'job','$.jobId')}/attempts/${id(attemptId,'attempt','$.attemptId')}/reports/${id(artifactId,'artifact','$.artifactId')}.zip`;
export const rawArtifactBundleKey = (jobId, artifactId) => `job-artifacts/${id(jobId,'job','$.jobId')}/${id(artifactId,'artifact','$.artifactId')}.tar.zst`;
export const rawArtifactManifestKey = (jobId, artifactId) => `job-artifacts/${id(jobId,'job','$.jobId')}/${id(artifactId,'artifact','$.artifactId')}-manifest-v1.json`;
export const evidenceQuarantineKey = (jobId, artifactId) => `jobs/${id(jobId,'job','$.jobId')}/evidence/quarantine/${id(artifactId,'artifact','$.artifactId')}.tar.zst`;
export const evidenceAcceptedKey = (jobId, artifactId) => `jobs/${id(jobId,'job','$.jobId')}/evidence/accepted/${id(artifactId,'artifact','$.artifactId')}.tar.zst`;
export const evidenceManifestKey = (jobId, artifactId) => `jobs/${id(jobId,'job','$.jobId')}/evidence/${id(artifactId,'artifact','$.artifactId')}-manifest-v1.json`;
export const evidenceAttestationKey = (jobId, artifactId) => `jobs/${id(jobId,'job','$.jobId')}/evidence/${id(artifactId,'artifact','$.artifactId')}-attestation-v1.json`;
export const reportBundleKey = (jobId, artifactId) => `jobs/${id(jobId,'job','$.jobId')}/reports/${id(artifactId,'artifact','$.artifactId')}.zip`;
export const reportManifestKey = (jobId, artifactId) => `jobs/${id(jobId,'job','$.jobId')}/reports/${id(artifactId,'artifact','$.artifactId')}-manifest-v1.json`;
export const reportIndexKey = (jobId) => `indexes/job/${id(jobId,'job','$.jobId')}/reports-v1.json`;
