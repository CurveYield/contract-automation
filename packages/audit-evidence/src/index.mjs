import { ValidationError, assertAuditId, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';
import { ConditionalWriteError } from '../../audit-r2-store/src/index.mjs';
import {
  MAX_LOG_CHUNK_BYTES,
  MAX_LOG_CHUNKS_PER_ATTEMPT,
  evidenceAcceptedKey,
  evidenceAttestationKey,
  evidenceManifestKey,
  evidenceQuarantineKey,
  jobStatusKey,
  logChunkKey,
  rawArtifactBundleKey,
  rawArtifactManifestKey,
  reportBundleKey,
  reportIndexKey,
  reportManifestKey,
  validateJobStatus
} from '../../audit-campaign-protocol/src/index.mjs';

export const MAX_RAW_ARTIFACT_BYTES = 64_000_000;
export const MAX_EVIDENCE_BUNDLE_BYTES = 50_000_000;
export const MAX_REPORT_BUNDLE_BYTES = 10_000_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LOGGABLE_STATES = new Set(['provisioning', 'running', 'collecting_evidence']);

function object(value, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path);
}
function allowed(value, keys, path = '$') {
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
}
function required(value, keys, path = '$') {
  for (const key of keys) if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
}
function string(value, path, max = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) throw new ValidationError('invalid_string', `${path} is invalid`, path);
  return value;
}
function instant(value, path) {
  string(value, path, 40);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO instant`, path);
  return value;
}
function currentInstant(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('now must produce a valid date');
  return date.toISOString();
}
function sha256(value, path) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new ValidationError('invalid_sha256', `${path} must be a lowercase SHA-256 digest`, path);
  return value;
}
function positiveBytes(value, path, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new ValidationError('invalid_size', `${path} must be from 1 to ${maximum}`, path);
  return value;
}
function toBytes(value) {
  if (typeof value === 'string') return encoder.encode(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  throw new TypeError('Evidence values must be strings or byte arrays');
}
function bytesEqual(left, right) {
  const a = toBytes(left);
  const b = toBytes(right);
  if (a.byteLength !== b.byteLength) return false;
  for (let index = 0; index < a.byteLength; index += 1) if (a[index] !== b[index]) return false;
  return true;
}
async function digestHex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function parse(recordValue) {
  if (!recordValue) return null;
  return JSON.parse(typeof recordValue.value === 'string' ? recordValue.value : decoder.decode(recordValue.value));
}
function createOnly() { return { onlyIf: { etagDoesNotMatch: '*' } }; }
function match(etag) {
  if (typeof etag !== 'string' || etag.length < 1) throw new ValidationError('missing_etag', 'An ETag precondition is required', '$.etag');
  return { onlyIf: { etagMatches: etag } };
}
function record(value, code, message, path) {
  if (!value) throw new ValidationError(code, message, path);
  return value;
}
function validateIdentity(value, jobId, artifactId, schemaVersion, path = '$.manifest') {
  object(value, path);
  scanAuditForbiddenFields(value, path);
  if (value.schemaVersion !== schemaVersion) throw new ValidationError('invalid_schema_version', `${path}.schemaVersion must be ${schemaVersion}`, `${path}.schemaVersion`);
  if (value.jobId !== jobId || value.artifactId !== artifactId) throw new ValidationError('identity_mismatch', `${path} identity does not match`, path);
  return value;
}
function validateRawManifest(value, jobId, artifactId) {
  validateIdentity(value, jobId, artifactId, 'raw-artifact-manifest-v1');
  const keys = new Set(['schemaVersion', 'jobId', 'artifactId', 'sha256', 'bytes', 'contentType', 'createdAt']);
  allowed(value, keys, '$.manifest');
  required(value, keys, '$.manifest');
  sha256(value.sha256, '$.manifest.sha256');
  positiveBytes(value.bytes, '$.manifest.bytes', MAX_RAW_ARTIFACT_BYTES);
  if (value.contentType !== 'application/zstd') throw new ValidationError('invalid_content_type', '$.manifest.contentType must be application/zstd', '$.manifest.contentType');
  instant(value.createdAt, '$.manifest.createdAt');
  return structuredClone(value);
}
function validateEvidenceManifest(value, jobId, artifactId) {
  validateIdentity(value, jobId, artifactId, 'evidence-manifest-v1');
  const keys = new Set(['schemaVersion', 'jobId', 'artifactId', 'sha256', 'bytes', 'evidenceContract', 'acceptedAt']);
  allowed(value, keys, '$.manifest');
  required(value, keys, '$.manifest');
  sha256(value.sha256, '$.manifest.sha256');
  positiveBytes(value.bytes, '$.manifest.bytes', MAX_EVIDENCE_BUNDLE_BYTES);
  string(value.evidenceContract, '$.manifest.evidenceContract', 80);
  instant(value.acceptedAt, '$.manifest.acceptedAt');
  return structuredClone(value);
}
function validateAttestation(value, jobId, artifactId) {
  validateIdentity(value, jobId, artifactId, 'evidence-attestation-v1', '$.attestation');
  const keys = new Set(['schemaVersion', 'jobId', 'artifactId', 'sha256', 'validator', 'attestedAt']);
  allowed(value, keys, '$.attestation');
  required(value, keys, '$.attestation');
  sha256(value.sha256, '$.attestation.sha256');
  string(value.validator, '$.attestation.validator', 160);
  instant(value.attestedAt, '$.attestation.attestedAt');
  return structuredClone(value);
}
function validateReportManifest(value, jobId, artifactId) {
  validateIdentity(value, jobId, artifactId, 'report-manifest-v1');
  const keys = new Set(['schemaVersion', 'jobId', 'artifactId', 'sha256', 'bytes', 'formats', 'createdAt']);
  allowed(value, keys, '$.manifest');
  required(value, keys, '$.manifest');
  sha256(value.sha256, '$.manifest.sha256');
  positiveBytes(value.bytes, '$.manifest.bytes', MAX_REPORT_BUNDLE_BYTES);
  if (!Array.isArray(value.formats) || value.formats.length < 1 || value.formats.length > 8 || value.formats.some((item) => !['html', 'pdf', 'json'].includes(item))) throw new ValidationError('invalid_formats', '$.manifest.formats is invalid', '$.manifest.formats');
  instant(value.createdAt, '$.manifest.createdAt');
  return structuredClone(value);
}
function validateReportIndex(value, jobId, artifactId) {
  object(value, '$.index');
  scanAuditForbiddenFields(value, '$.index');
  const keys = new Set(['schemaVersion', 'jobId', 'reports', 'records']);
  allowed(value, keys, '$.index');
  required(value, new Set(['schemaVersion', 'jobId', 'reports']), '$.index');
  if (value.schemaVersion !== 'job-report-index-v1' || value.jobId !== jobId) throw new ValidationError('invalid_report_index', '$.index identity is invalid', '$.index');
  if (!Array.isArray(value.reports)) throw new ValidationError('invalid_report_index', '$.index.reports must be an array', '$.index.reports');
  value.reports.forEach((id, index) => assertAuditId(id, 'artifact', `$.index.reports[${index}]`));
  if (value.records !== undefined) object(value.records, '$.index.records');
  if (artifactId !== undefined && !value.reports.includes(artifactId)) throw new ValidationError('invalid_report_index', '$.index.reports must include the report artifact', '$.index.reports');
  return { ...structuredClone(value), records: structuredClone(value.records ?? {}) };
}
function emptyReportIndex(jobId) {
  return { schemaVersion: 'job-report-index-v1', jobId, reports: [], records: {} };
}
async function putImmutableBytes(store, key, bytes) {
  try {
    await store.put(key, bytes, createOnly());
    return false;
  } catch (error) {
    if (!(error instanceof ConditionalWriteError)) throw error;
    const existing = await store.get(key);
    if (!existing || !bytesEqual(existing.value, bytes)) throw new ValidationError('report_conflict', 'Existing report bundle differs from the retry', '$.reportBytes');
    return true;
  }
}
async function putImmutableJson(store, key, value) {
  try {
    await store.put(key, JSON.stringify(value), createOnly());
    return false;
  } catch (error) {
    if (!(error instanceof ConditionalWriteError)) throw error;
    const existing = await store.get(key);
    if (!existing || JSON.stringify(parse(existing)) !== JSON.stringify(value)) throw new ValidationError('report_conflict', 'Existing report manifest differs from the retry', '$.manifest');
    return true;
  }
}

export class EvidenceService {
  constructor(store, options = {}) {
    if (!store || typeof store.put !== 'function' || typeof store.get !== 'function') throw new TypeError('EvidenceService requires an Audit store');
    this.store = store;
    this.now = options.now ?? (() => new Date());
    this.validateEvidence = options.validateEvidence ?? (async () => { throw new ValidationError('validator_unavailable', 'Evidence validator is unavailable', '$'); });
  }

  async appendLogChunk(input) {
    object(input);
    scanAuditForbiddenFields(input);
    allowed(input, new Set(['jobId', 'attemptId', 'sequence', 'bytes', 'statusEtag']));
    required(input, new Set(['jobId', 'attemptId', 'sequence', 'bytes']));
    assertAuditId(input.jobId, 'job', '$.jobId');
    assertAuditId(input.attemptId, 'attempt', '$.attemptId');
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 1 || input.sequence > MAX_LOG_CHUNKS_PER_ATTEMPT) throw new ValidationError('invalid_log_sequence', `$.sequence must be from 1 to ${MAX_LOG_CHUNKS_PER_ATTEMPT}`, '$.sequence');
    const bytes = toBytes(input.bytes);
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_LOG_CHUNK_BYTES) throw new ValidationError('invalid_log_size', `Log chunks must contain 1 to ${MAX_LOG_CHUNK_BYTES} bytes`, '$.bytes');
    const statusRecord = record(await this.store.get(jobStatusKey(input.jobId)), 'job_not_found', 'Job status not found', '$.jobId');
    if (input.statusEtag !== undefined && input.statusEtag !== statusRecord.etag) throw new ValidationError('stale_status', '$.statusEtag is stale', '$.statusEtag');
    const status = validateJobStatus(parse(statusRecord));
    if (status.attemptId !== input.attemptId) throw new ValidationError('attempt_mismatch', 'Log attempt does not match current job attempt', '$.attemptId');
    if (!LOGGABLE_STATES.has(status.state)) throw new ValidationError('invalid_log_state', 'Logs may only be appended while the job is active', '$.jobId');
    const chunkKey = logChunkKey(input.jobId, input.attemptId, input.sequence);
    if (status.highestLogSequence === input.sequence) {
      const existing = record(await this.store.get(chunkKey), 'log_chunk_missing', 'Committed log chunk is missing', '$.sequence');
      if (!bytesEqual(existing.value, bytes)) throw new ValidationError('log_chunk_conflict', 'Existing log chunk bytes do not match the retry', '$.bytes');
      return Object.freeze({ jobId: input.jobId, attemptId: input.attemptId, sequence: input.sequence, bytes: bytes.byteLength, highestLogSequence: input.sequence, recoveredPartialWrite: true });
    }
    if (input.sequence !== status.highestLogSequence + 1) throw new ValidationError('invalid_log_sequence', `$.sequence must equal ${status.highestLogSequence + 1}`, '$.sequence');
    let recoveredPartialWrite = false;
    try {
      await this.store.put(chunkKey, bytes, createOnly());
    } catch (cause) {
      if (!(cause instanceof ConditionalWriteError)) throw cause;
      const existing = await this.store.get(chunkKey);
      if (!existing || !bytesEqual(existing.value, bytes)) throw cause;
      recoveredPartialWrite = true;
    }
    const next = validateJobStatus({ ...status, revision: status.revision + 1, highestLogSequence: input.sequence, updatedAt: currentInstant(this.now), executionEnabled: false });
    await this.store.put(jobStatusKey(input.jobId), JSON.stringify(next), match(statusRecord.etag));
    return Object.freeze({ jobId: input.jobId, attemptId: input.attemptId, sequence: input.sequence, bytes: bytes.byteLength, highestLogSequence: input.sequence, recoveredPartialWrite });
  }

  async readLogs(input) {
    object(input);
    allowed(input, new Set(['jobId', 'attemptId']));
    required(input, new Set(['jobId', 'attemptId']));
    assertAuditId(input.jobId, 'job', '$.jobId');
    assertAuditId(input.attemptId, 'attempt', '$.attemptId');
    const statusRecord = await this.store.get(jobStatusKey(input.jobId));
    const status = validateJobStatus(parse(record(statusRecord, 'job_not_found', 'Job status not found', '$.jobId')));
    if (status.attemptId !== input.attemptId) throw new ValidationError('attempt_mismatch', 'Requested attempt is not current for the job', '$.attemptId');
    const chunks = [];
    for (let sequence = 1; sequence <= status.highestLogSequence; sequence += 1) {
      const chunk = await this.store.get(logChunkKey(input.jobId, input.attemptId, sequence));
      chunks.push(record(chunk, 'log_chunk_missing', `Log chunk ${sequence} is missing`, '$.sequence').value);
    }
    return Object.freeze({ jobId: input.jobId, attemptId: input.attemptId, highestSequence: status.highestLogSequence, chunks: Object.freeze(chunks) });
  }

  async publishRawArtifacts(input) {
    object(input);
    scanAuditForbiddenFields(input);
    allowed(input, new Set(['jobId', 'artifactId', 'bundleBytes', 'manifest']));
    required(input, new Set(['jobId', 'artifactId', 'bundleBytes', 'manifest']));
    assertAuditId(input.jobId, 'job', '$.jobId');
    assertAuditId(input.artifactId, 'artifact', '$.artifactId');
    const bytes = toBytes(input.bundleBytes);
    positiveBytes(bytes.byteLength, '$.bundleBytes', MAX_RAW_ARTIFACT_BYTES);
    const manifest = validateRawManifest(input.manifest, input.jobId, input.artifactId);
    if (manifest.bytes !== bytes.byteLength || manifest.sha256 !== await digestHex(bytes)) throw new ValidationError('digest_mismatch', 'Raw artifact bundle does not match its manifest', '$.manifest');
    await this.store.put(rawArtifactBundleKey(input.jobId, input.artifactId), bytes, createOnly());
    await this.store.put(rawArtifactManifestKey(input.jobId, input.artifactId), JSON.stringify(manifest), createOnly());
    return Object.freeze({ jobId: input.jobId, artifactId: input.artifactId });
  }

  async acceptEvidence(input) {
    object(input);
    scanAuditForbiddenFields(input);
    allowed(input, new Set(['jobId', 'artifactId', 'bundleBytes', 'manifest', 'attestation']));
    required(input, new Set(['jobId', 'artifactId', 'bundleBytes', 'manifest', 'attestation']));
    assertAuditId(input.jobId, 'job', '$.jobId');
    assertAuditId(input.artifactId, 'artifact', '$.artifactId');
    const bytes = toBytes(input.bundleBytes);
    positiveBytes(bytes.byteLength, '$.bundleBytes', MAX_EVIDENCE_BUNDLE_BYTES);
    const manifest = validateEvidenceManifest(input.manifest, input.jobId, input.artifactId);
    const attestation = validateAttestation(input.attestation, input.jobId, input.artifactId);
    const digest = await digestHex(bytes);
    if (manifest.bytes !== bytes.byteLength || manifest.sha256 !== digest || attestation.sha256 !== digest) throw new ValidationError('digest_mismatch', 'Evidence bundle does not match its metadata', '$');
    const quarantineKey = evidenceQuarantineKey(input.jobId, input.artifactId);
    await this.store.put(quarantineKey, bytes, createOnly());
    const quarantined = record(await this.store.get(quarantineKey), 'quarantine_missing', 'Quarantined evidence is missing', '$.artifactId');
    const verdict = await this.validateEvidence({ jobId: input.jobId, artifactId: input.artifactId, bytes: quarantined.value, sha256: digest, manifest });
    if (!verdict || verdict.accepted !== true) throw new ValidationError('evidence_rejected', verdict?.reason ?? 'Evidence validation failed', '$.artifactId');
    if (verdict.validator && verdict.validator !== attestation.validator) throw new ValidationError('validator_mismatch', 'Attestation validator does not match validation result', '$.attestation.validator');
    await this.store.put(evidenceAcceptedKey(input.jobId, input.artifactId), quarantined.value, createOnly());
    await this.store.put(evidenceManifestKey(input.jobId, input.artifactId), JSON.stringify(manifest), createOnly());
    await this.store.put(evidenceAttestationKey(input.jobId, input.artifactId), JSON.stringify(attestation), createOnly());
    return Object.freeze({ jobId: input.jobId, artifactId: input.artifactId, accepted: true });
  }

  async publishReport(input) {
    object(input);
    scanAuditForbiddenFields(input);
    allowed(input, new Set(['jobId', 'artifactId', 'reportBytes', 'manifest', 'index', 'indexEtag']));
    required(input, new Set(['jobId', 'artifactId', 'reportBytes', 'manifest']));
    assertAuditId(input.jobId, 'job', '$.jobId');
    assertAuditId(input.artifactId, 'artifact', '$.artifactId');
    const bytes = toBytes(input.reportBytes);
    positiveBytes(bytes.byteLength, '$.reportBytes', MAX_REPORT_BUNDLE_BYTES);
    const manifest = validateReportManifest(input.manifest, input.jobId, input.artifactId);
    if (input.index !== undefined) validateReportIndex(input.index, input.jobId, input.artifactId);
    if (manifest.bytes !== bytes.byteLength || manifest.sha256 !== await digestHex(bytes)) throw new ValidationError('digest_mismatch', 'Report bundle does not match its manifest', '$.manifest');

    const indexRecord = await this.store.get(reportIndexKey(input.jobId));
    if (input.indexEtag !== undefined && (!indexRecord || input.indexEtag !== indexRecord.etag)) throw new ValidationError('stale_index', '$.indexEtag is stale', '$.indexEtag');
    const index = indexRecord ? validateReportIndex(parse(indexRecord), input.jobId) : emptyReportIndex(input.jobId);
    if (index.reports.includes(input.artifactId) || index.records[input.artifactId]) throw new ValidationError('report_exists', 'Report already exists', '$.artifactId');

    const recoveredBundle = await putImmutableBytes(this.store, reportBundleKey(input.jobId, input.artifactId), bytes);
    const recoveredManifest = await putImmutableJson(this.store, reportManifestKey(input.jobId, input.artifactId), manifest);
    const updatedIndex = {
      schemaVersion: 'job-report-index-v1',
      jobId: input.jobId,
      reports: [...index.reports, input.artifactId].sort(),
      records: {
        ...index.records,
        [input.artifactId]: {
          sha256: manifest.sha256,
          bytes: manifest.bytes,
          formats: [...manifest.formats],
          createdAt: manifest.createdAt
        }
      }
    };
    await this.store.put(reportIndexKey(input.jobId), JSON.stringify(updatedIndex), indexRecord ? match(indexRecord.etag) : createOnly());
    return Object.freeze({ jobId: input.jobId, artifactId: input.artifactId, recoveredPartialPublication: recoveredBundle || recoveredManifest });
  }

  async readReports(jobId) {
    assertAuditId(jobId, 'job', '$.jobId');
    const report = await this.store.get(reportIndexKey(jobId));
    return Object.freeze(parse(record(report, 'report_index_not_found', 'Report index not found', '$.jobId')));
  }
}
