import baseWorker from './index.mjs';
import { ValidationError, assertAuditId, assertScopes, scanAuditForbiddenFields } from '../../../packages/audit-protocol/src/index.mjs';
import { ConditionalWriteError } from '../../../packages/audit-r2-store/src/index.mjs';
import { CampaignService } from '../../../packages/audit-campaigns/src/index.mjs';
import { EvidenceService } from '../../../packages/audit-evidence/src/index.mjs';
import { campaignCurrentKey } from '../../../packages/audit-campaign-protocol/src/index.mjs';

const JSON_HEADERS = Object.freeze({ 'content-type': 'application/json; charset=utf-8' });
const MAX_BODY_BYTES = 1024 * 1024;
const INTERNAL_CLOCK_SKEW_SECONDS = 5 * 60;
const TERMINAL_RESUMABLE = new Set(['cancelled', 'failed', 'timed_out']);
const PHASE_3_CAPABILITIES = Object.freeze({
  service: 'curveyield-audit',
  apiVersion: 'audit-v1',
  phase: 3,
  workspaces: true,
  generatedLayers: true,
  profileRegistry: true,
  campaigns: true,
  jobs: true,
  logs: true,
  evidence: true,
  reports: true,
  executionEnabled: false,
  storage: 'r2-standard',
  executionState: 'awaiting_executor'
});

class ServiceUnavailableError extends Error {
  constructor(code, message) { super(message); this.name = 'ServiceUnavailableError'; this.code = code; this.status = 503; }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS }); }
function failure(code, message, status, details) { return json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status); }
function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', env.CORS_ORIGIN || 'null');
  headers.set('access-control-allow-headers', 'authorization, content-type, x-audit-timestamp, x-audit-nonce, x-audit-signature');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  headers.set('access-control-max-age', '86400');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function bytes(value) { return encoder.encode(value); }
function hex(value) { return [...value].map((item) => item.toString(16).padStart(2, '0')).join(''); }
async function sha256(value) { return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value))); }
async function sha256Hex(value) { return hex(await sha256(value)); }
async function hmacHex(key, value) {
  const imported = await crypto.subtle.importKey('raw', bytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', imported, bytes(value))));
}
async function secureEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  let difference = a.byteLength ^ b.byteLength;
  const length = Math.max(a.byteLength, b.byteLength);
  for (let index = 0; index < length; index += 1) difference |= (a[index % a.byteLength] ?? 0) ^ (b[index % b.byteLength] ?? 0);
  return difference === 0;
}
function canonicalInternal({ timestamp, nonce, method, path, bodyDigest }) { return [String(timestamp), nonce, method.toUpperCase(), path, bodyDigest].join('\n'); }
function bearer(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}
function credentials(env) {
  return [
    { key: env.AUDIT_READ_API_KEY, scopes: ['audit:read'] },
    { key: env.AUDIT_SUBMIT_API_KEY, scopes: ['audit:read', 'audit:submit'] },
    { key: env.AUDIT_ADMIN_API_KEY, scopes: ['audit:read', 'audit:submit', 'audit:admin'] }
  ].filter((item) => typeof item.key === 'string' && item.key.length > 0);
}
async function authenticate(request, env, requiredScopes) {
  const token = bearer(request);
  if (!token) return failure('unauthorized', 'Invalid Audit API key', 401);
  for (const credential of credentials(env)) {
    if (await secureEqual(token, credential.key)) {
      try { assertScopes(credential.scopes, requiredScopes); return null; }
      catch (cause) {
        if (cause instanceof ValidationError && cause.code === 'insufficient_scope') return failure('forbidden', 'Audit API key lacks the required scope', 403);
        throw cause;
      }
    }
  }
  return failure('unauthorized', 'Invalid Audit API key', 401);
}
async function readLimitedText(request) {
  const length = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new ValidationError('body_too_large', `Request body exceeds ${MAX_BODY_BYTES} bytes`, '$');
  const text = await request.text();
  if (bytes(text).byteLength > MAX_BODY_BYTES) throw new ValidationError('body_too_large', `Request body exceeds ${MAX_BODY_BYTES} bytes`, '$');
  return text;
}
async function parseJsonRequest(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new ValidationError('unsupported_content_type', 'Use application/json', '$');
  const text = await readLimitedText(request);
  try { const value = JSON.parse(text || '{}'); scanAuditForbiddenFields(value); return value; }
  catch (cause) { if (cause instanceof ValidationError) throw cause; throw new ValidationError('invalid_json', 'Request body is not valid JSON', '$'); }
}
function strict(value, keys, requiredKeys = keys, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path);
  scanAuditForbiddenFields(value, path);
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  for (const key of requiredKeys) if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
}
function decodeBase64(value, path) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 90_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new ValidationError('invalid_base64', `${path} is invalid`, path);
  try { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
  catch { throw new ValidationError('invalid_base64', `${path} is invalid`, path); }
}
function parseRecord(record) {
  if (!record) return null;
  return JSON.parse(typeof record.value === 'string' ? record.value : decoder.decode(record.value));
}
function r2Store(binding) {
  if (!binding) return null;
  return Object.freeze({
    async put(key, value, options) { const result = await binding.put(key, value, options); if (result === null) throw new ConditionalWriteError(); return result; },
    async get(key) { const result = await binding.get(key); if (!result) return null; if ('value' in result) return result; const value = new Uint8Array(await result.arrayBuffer()); return { key: result.key ?? key, etag: result.etag, size: result.size ?? value.byteLength, value }; },
    async head(key) { return binding.head(key); },
    async delete(key) { return binding.delete(key); }
  });
}
function campaignService(env, trustedFixture = false) {
  if (env.AUDIT_CAMPAIGN_SERVICE) return env.AUDIT_CAMPAIGN_SERVICE;
  const store = r2Store(env.AUDIT_CONTROL_STORE);
  if (!store) throw new ServiceUnavailableError('campaign_store_unavailable', 'Campaign storage is unavailable');
  return new CampaignService(store, { trustedFixture, now: typeof env.AUDIT_NOW === 'function' ? env.AUDIT_NOW : undefined });
}
function evidenceService(env) {
  if (env.AUDIT_EVIDENCE_SERVICE) return env.AUDIT_EVIDENCE_SERVICE;
  const store = r2Store(env.AUDIT_CONTROL_STORE);
  if (!store) throw new ServiceUnavailableError('evidence_store_unavailable', 'Evidence storage is unavailable');
  return new EvidenceService(store, { validateEvidence: env.AUDIT_EVIDENCE_VALIDATOR });
}
async function authenticateInternal(request, env, bodyText, path) {
  const timestamp = Number(request.headers.get('x-audit-timestamp') || '');
  const nonce = request.headers.get('x-audit-nonce') || '';
  const signature = request.headers.get('x-audit-signature') || '';
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > INTERNAL_CLOCK_SKEW_SECONDS || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return failure('unauthorized', 'Invalid or expired internal request', 401);
  if (typeof env.AUDIT_INTERNAL_SERVICE_KEY !== 'string' || env.AUDIT_INTERNAL_SERVICE_KEY.length === 0) return failure('unauthorized', 'Invalid or expired internal request', 401);
  const expected = await hmacHex(env.AUDIT_INTERNAL_SERVICE_KEY, canonicalInternal({ timestamp, nonce, method: request.method, path, bodyDigest: await sha256Hex(bodyText) }));
  if (!(await secureEqual(signature, expected))) return failure('unauthorized', 'Invalid or expired internal request', 401);
  if (!env.AUDIT_NONCE_STORE || typeof env.AUDIT_NONCE_STORE.put !== 'function') return failure('service_unavailable', 'Internal replay protection is unavailable', 503);
  try {
    const stored = await env.AUDIT_NONCE_STORE.put(`internal-nonces/${timestamp}/${nonce}.json`, JSON.stringify({ timestamp, nonce }), { onlyIf: { etagDoesNotMatch: '*' } });
    if (stored === null) return failure('replay_detected', 'Internal request nonce has already been used', 409);
  } catch (cause) {
    if (cause instanceof ConditionalWriteError || cause?.code === 'precondition_failed') return failure('replay_detected', 'Internal request nonce has already been used', 409);
    throw cause;
  }
  return null;
}
async function readCampaign(env, campaignId) {
  const service = campaignService(env);
  if (typeof service.readCampaign === 'function') return service.readCampaign(campaignId);
  const store = r2Store(env.AUDIT_CONTROL_STORE);
  if (!store) throw new ServiceUnavailableError('campaign_store_unavailable', 'Campaign storage is unavailable');
  const record = await store.get(campaignCurrentKey(campaignId));
  if (!record) throw new ValidationError('not_found', 'Campaign not found', '$.campaignId');
  return parseRecord(record);
}

async function publicRoute(request, env, path, url) {
  if (request.method === 'GET' && path === '/audit/v1/health') return json({ status: 'ok', service: 'curveyield-audit-api', version: '0.3.0', phase: 3 });
  if (request.method === 'GET' && path === '/audit/v1/capabilities') {
    const denied = await authenticate(request, env, ['audit:read']);
    return denied ?? json(PHASE_3_CAPABILITIES);
  }
  if (request.method === 'POST' && path === '/audit/v1/campaigns') {
    const denied = await authenticate(request, env, ['audit:submit']); if (denied) return denied;
    return json(await campaignService(env).createCampaign(await parseJsonRequest(request)), 201);
  }
  const campaignMatch = path.match(/^\/audit\/v1\/campaigns\/(cmp_[0-9a-f]{32})$/);
  if (campaignMatch && request.method === 'GET') {
    const denied = await authenticate(request, env, ['audit:read']); if (denied) return denied;
    return json(await readCampaign(env, campaignMatch[1]));
  }
  const campaignJobs = path.match(/^\/audit\/v1\/campaigns\/(cmp_[0-9a-f]{32})\/jobs$/);
  if (campaignJobs && request.method === 'POST') {
    const denied = await authenticate(request, env, ['audit:submit']); if (denied) return denied;
    const body = await parseJsonRequest(request);
    strict(body, new Set(['request', 'jobIndexEtag']));
    if (body.request?.campaignId !== campaignJobs[1]) throw new ValidationError('campaign_mismatch', '$.request.campaignId must match the route', '$.request.campaignId');
    return json(await campaignService(env).submitJob(body), 202);
  }
  const jobMatch = path.match(/^\/audit\/v1\/jobs\/(ajob_[0-9a-f]{32})$/);
  if (jobMatch && request.method === 'GET') {
    const denied = await authenticate(request, env, ['audit:read']); if (denied) return denied;
    return json(await campaignService(env).pollJob(jobMatch[1]));
  }
  const cancelMatch = path.match(/^\/audit\/v1\/jobs\/(ajob_[0-9a-f]{32})\/cancel$/);
  if (cancelMatch && request.method === 'POST') {
    const denied = await authenticate(request, env, ['audit:submit']); if (denied) return denied;
    const body = await parseJsonRequest(request); strict(body, new Set(['reason']));
    return json(await campaignService(env).cancelJob(cancelMatch[1], body.reason));
  }
  const resumeMatch = path.match(/^\/audit\/v1\/jobs\/(ajob_[0-9a-f]{32})\/resume$/);
  if (resumeMatch && request.method === 'POST') {
    const denied = await authenticate(request, env, ['audit:submit']); if (denied) return denied;
    const previous = await campaignService(env).pollJob(resumeMatch[1]);
    if (!TERMINAL_RESUMABLE.has(previous.state)) throw new ValidationError('job_not_resumable', 'Only cancelled, failed, or timed-out jobs may be resumed', '$.jobId');
    const body = await parseJsonRequest(request); strict(body, new Set(['request', 'jobIndexEtag']));
    if (body.request?.configuration?.resumeOf !== resumeMatch[1]) throw new ValidationError('resume_mismatch', '$.request.configuration.resumeOf must match the route job', '$.request.configuration.resumeOf');
    if (body.request?.jobId === resumeMatch[1]) throw new ValidationError('new_job_required', 'Resume must create a new job ID', '$.request.jobId');
    return json(await campaignService(env).submitJob(body), 202);
  }
  const logsMatch = path.match(/^\/audit\/v1\/jobs\/(ajob_[0-9a-f]{32})\/logs$/);
  if (logsMatch && request.method === 'GET') {
    const denied = await authenticate(request, env, ['audit:read']); if (denied) return denied;
    const attemptId = url.searchParams.get('attemptId'); assertAuditId(attemptId, 'attempt', '$.attemptId');
    return json(await evidenceService(env).readLogs({ jobId: logsMatch[1], attemptId }));
  }
  const reportsMatch = path.match(/^\/audit\/v1\/jobs\/(ajob_[0-9a-f]{32})\/reports$/);
  if (reportsMatch && request.method === 'GET') {
    const denied = await authenticate(request, env, ['audit:read']); if (denied) return denied;
    return json(await evidenceService(env).readReports(reportsMatch[1]));
  }
  return null;
}

async function internalRoute(request, env, path) {
  if (!path.startsWith('/audit-internal/v1/jobs/')) return null;
  if (env.AUDIT_TRUSTED_FIXTURE_ENABLED !== 'true') return failure('trusted_fixture_disabled', 'Trusted fixture continuation is disabled', 503);
  const bodyText = await readLimitedText(request);
  const denied = await authenticateInternal(request, env, bodyText, path); if (denied) return denied;
  let body;
  try { body = JSON.parse(bodyText || '{}'); scanAuditForbiddenFields(body); }
  catch (cause) { if (cause instanceof ValidationError) throw cause; throw new ValidationError('invalid_json', 'Request body is not valid JSON', '$'); }
  const attempt = path.match(/^\/audit-internal\/v1\/jobs\/(ajob_[0-9a-f]{32})\/attempts$/);
  if (attempt && request.method === 'POST') {
    strict(body, new Set(['attemptId']));
    return json(await campaignService(env, true).claimAttempt({ jobId: attempt[1], attemptId: body.attemptId }), 201);
  }
  const heartbeat = path.match(/^\/audit-internal\/v1\/jobs\/(ajob_[0-9a-f]{32})\/heartbeat$/);
  if (heartbeat && request.method === 'POST') {
    strict(body, new Set(['status', 'statusEtag']));
    if (body.status?.jobId !== heartbeat[1]) throw new ValidationError('job_mismatch', '$.status.jobId must match the route', '$.status.jobId');
    return json(await campaignService(env, true).heartbeat(body));
  }
  const logs = path.match(/^\/audit-internal\/v1\/jobs\/(ajob_[0-9a-f]{32})\/logs$/);
  if (logs && request.method === 'POST') {
    strict(body, new Set(['attemptId', 'sequence', 'chunkBase64']));
    return json(await evidenceService(env).appendLogChunk({ jobId: logs[1], attemptId: body.attemptId, sequence: body.sequence, bytes: decodeBase64(body.chunkBase64, '$.chunkBase64') }), 201);
  }
  const artifacts = path.match(/^\/audit-internal\/v1\/jobs\/(ajob_[0-9a-f]{32})\/artifacts$/);
  if (artifacts && request.method === 'POST') {
    strict(body, new Set(['artifactId', 'bundleBase64', 'manifest']));
    return json(await evidenceService(env).publishRawArtifacts({ jobId: artifacts[1], artifactId: body.artifactId, bundleBytes: decodeBase64(body.bundleBase64, '$.bundleBase64'), manifest: body.manifest }), 201);
  }
  const evidence = path.match(/^\/audit-internal\/v1\/jobs\/(ajob_[0-9a-f]{32})\/evidence$/);
  if (evidence && request.method === 'POST') {
    strict(body, new Set(['artifactId', 'bundleBase64', 'manifest', 'attestation']));
    return json(await evidenceService(env).acceptEvidence({ jobId: evidence[1], artifactId: body.artifactId, bundleBytes: decodeBase64(body.bundleBase64, '$.bundleBase64'), manifest: body.manifest, attestation: body.attestation }), 201);
  }
  const reports = path.match(/^\/audit-internal\/v1\/jobs\/(ajob_[0-9a-f]{32})\/reports$/);
  if (reports && request.method === 'POST') {
    strict(body, new Set(['artifactId', 'reportBase64', 'manifest', 'index', 'indexEtag']), new Set(['artifactId', 'reportBase64', 'manifest', 'index']));
    return json(await evidenceService(env).publishReport({ jobId: reports[1], artifactId: body.artifactId, reportBytes: decodeBase64(body.reportBase64, '$.reportBase64'), manifest: body.manifest, index: body.index, ...(body.indexEtag ? { indexEtag: body.indexEtag } : {}) }), 201);
  }
  const complete = path.match(/^\/audit-internal\/v1\/jobs\/(ajob_[0-9a-f]{32})\/complete$/);
  if (complete && request.method === 'POST') {
    strict(body, new Set(['currentStatus', 'statusEtag', 'finalState', 'reason']), new Set(['currentStatus', 'statusEtag', 'finalState']));
    if (body.currentStatus?.jobId !== complete[1]) throw new ValidationError('job_mismatch', '$.currentStatus.jobId must match the route', '$.currentStatus.jobId');
    return json(await campaignService(env, true).completeJob(body));
  }
  return failure('not_found', 'Route not found', 404);
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), env);
      const url = new URL(request.url);
      const internal = await internalRoute(request, env, url.pathname);
      if (internal) return withCors(internal, env);
      const publicResponse = await publicRoute(request, env, url.pathname, url);
      if (publicResponse) return withCors(publicResponse, env);
      return baseWorker.fetch(request, env);
    } catch (cause) {
      if (cause instanceof ValidationError) return withCors(failure(cause.code, cause.message, cause.code === 'not_found' ? 404 : 400, { path: cause.path }), env);
      if (cause instanceof ConditionalWriteError || cause?.code === 'precondition_failed') return withCors(failure('conflict', 'Concurrent state update conflict', 409), env);
      if (cause instanceof ServiceUnavailableError) return withCors(failure(cause.code, cause.message, cause.status), env);
      console.error(cause);
      return withCors(failure('internal_error', 'Internal server error', 500), env);
    }
  }
};
