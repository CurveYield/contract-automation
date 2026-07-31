import {
  AUDIT_CAPABILITIES,
  ValidationError,
  assertScopes,
  validateAuditJobRequest
} from '../../../packages/audit-protocol/src/index.mjs';
import { ConditionalWriteError } from '../../../packages/audit-r2-store/src/index.mjs';

const JSON_HEADERS = Object.freeze({ 'content-type': 'application/json; charset=utf-8' });
const MAX_BODY_BYTES = 1024 * 1024;
const INTERNAL_CLOCK_SKEW_SECONDS = 5 * 60;

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function error(code, message, status, details) {
  return json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status);
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', env.CORS_ORIGIN || 'null');
  headers.set('access-control-allow-headers', 'authorization, content-type, x-audit-timestamp, x-audit-nonce, x-audit-signature');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  headers.set('access-control-max-age', '86400');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function bytes(value) { return new TextEncoder().encode(value); }
function hex(value) { return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
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
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % a.byteLength] ?? 0) ^ (b[index % b.byteLength] ?? 0);
  }
  return difference === 0;
}

function bearer(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function configuredCredentials(env) {
  return [
    { key: env.AUDIT_READ_API_KEY, scopes: ['audit:read'] },
    { key: env.AUDIT_SUBMIT_API_KEY, scopes: ['audit:read', 'audit:submit'] },
    { key: env.AUDIT_ADMIN_API_KEY, scopes: ['audit:read', 'audit:submit', 'audit:admin'] }
  ].filter((credential) => typeof credential.key === 'string' && credential.key.length > 0);
}

async function authenticateBearer(request, env, requiredScopes) {
  const token = bearer(request);
  if (!token) return { ok: false, response: error('unauthorized', 'Invalid Audit API key', 401) };
  for (const credential of configuredCredentials(env)) {
    if (await secureEqual(token, credential.key)) {
      try {
        assertScopes(credential.scopes, requiredScopes);
        return { ok: true, scopes: credential.scopes };
      } catch (cause) {
        if (cause instanceof ValidationError && cause.code === 'insufficient_scope') {
          return { ok: false, response: error('forbidden', 'Audit API key lacks the required scope', 403) };
        }
        throw cause;
      }
    }
  }
  return { ok: false, response: error('unauthorized', 'Invalid Audit API key', 401) };
}

async function readLimitedText(request, maxBytes = MAX_BODY_BYTES) {
  const length = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(length) && length > maxBytes) throw new ValidationError('body_too_large', `Request body exceeds ${maxBytes} bytes`, '$');
  const text = await request.text();
  if (bytes(text).byteLength > maxBytes) throw new ValidationError('body_too_large', `Request body exceeds ${maxBytes} bytes`, '$');
  return text;
}

function parseJson(text) {
  try { return JSON.parse(text || '{}'); }
  catch { throw new ValidationError('invalid_json', 'Request body is not valid JSON', '$'); }
}

async function parseJsonRequest(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) throw new ValidationError('unsupported_content_type', 'Use application/json', '$');
  return parseJson(await readLimitedText(request));
}

function internalCanonical({ timestamp, nonce, method, path, bodyDigest }) {
  return [String(timestamp), nonce, method.toUpperCase(), path, bodyDigest].join('\n');
}

export async function signInternalRequest({ key, timestamp, nonce, method, path, body = '' }) {
  const bodyDigest = await sha256Hex(body);
  const signature = await hmacHex(key, internalCanonical({ timestamp, nonce, method, path, bodyDigest }));
  return { 'x-audit-timestamp': String(timestamp), 'x-audit-nonce': nonce, 'x-audit-signature': signature };
}

function validNonce(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value); }

async function authenticateInternal(request, env, bodyText, path) {
  const timestampText = request.headers.get('x-audit-timestamp') || '';
  const nonce = request.headers.get('x-audit-nonce') || '';
  const suppliedSignature = request.headers.get('x-audit-signature') || '';
  const timestamp = Number(timestampText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > INTERNAL_CLOCK_SKEW_SECONDS || !validNonce(nonce)) {
    return { ok: false, response: error('unauthorized', 'Invalid or expired internal request', 401) };
  }
  if (typeof env.AUDIT_INTERNAL_SERVICE_KEY !== 'string' || env.AUDIT_INTERNAL_SERVICE_KEY.length === 0) {
    return { ok: false, response: error('unauthorized', 'Invalid or expired internal request', 401) };
  }
  const bodyDigest = await sha256Hex(bodyText);
  const expected = await hmacHex(env.AUDIT_INTERNAL_SERVICE_KEY, internalCanonical({ timestamp, nonce, method: request.method, path, bodyDigest }));
  if (!(await secureEqual(suppliedSignature, expected))) {
    return { ok: false, response: error('unauthorized', 'Invalid or expired internal request', 401) };
  }
  if (!env.AUDIT_NONCE_STORE || typeof env.AUDIT_NONCE_STORE.put !== 'function') {
    return { ok: false, response: error('service_unavailable', 'Internal replay protection is unavailable', 503) };
  }
  try {
    await env.AUDIT_NONCE_STORE.put(`internal-nonces/${timestamp}/${nonce}.json`, JSON.stringify({ timestamp, nonce }), { onlyIf: { etagDoesNotMatch: '*' } });
  } catch (cause) {
    if (cause instanceof ConditionalWriteError || cause?.code === 'precondition_failed') {
      return { ok: false, response: error('replay_detected', 'Internal request nonce has already been used', 409) };
    }
    throw cause;
  }
  return { ok: true };
}

function readiness(env) {
  const configuration = {
    readKey: typeof env.AUDIT_READ_API_KEY === 'string' && env.AUDIT_READ_API_KEY.length > 0,
    submitKey: typeof env.AUDIT_SUBMIT_API_KEY === 'string' && env.AUDIT_SUBMIT_API_KEY.length > 0,
    adminKey: typeof env.AUDIT_ADMIN_API_KEY === 'string' && env.AUDIT_ADMIN_API_KEY.length > 0,
    internalKey: typeof env.AUDIT_INTERNAL_SERVICE_KEY === 'string' && env.AUDIT_INTERNAL_SERVICE_KEY.length > 0,
    nonceStore: Boolean(env.AUDIT_NONCE_STORE && typeof env.AUDIT_NONCE_STORE.put === 'function'),
    executionEnabled: false
  };
  return { ready: Object.values(configuration).slice(0, 5).every(Boolean), configuration };
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method === 'GET' && path === '/audit/v1/health') return json({ status: 'ok', service: 'curveyield-audit-api', version: '0.1.0', phase: 1 });
  if (path.startsWith('/audit-internal/v1/')) {
    const bodyText = await readLimitedText(request);
    const auth = await authenticateInternal(request, env, bodyText, path);
    if (!auth.ok) return auth.response;
    if (request.method === 'POST' && path === '/audit-internal/v1/ping') {
      parseJson(bodyText);
      return json({ status: 'ok', service: 'curveyield-audit-api', internal: true });
    }
    return error('not_found', 'Route not found', 404);
  }
  if (request.method === 'GET' && path === '/audit/v1/capabilities') {
    const auth = await authenticateBearer(request, env, ['audit:read']);
    return auth.ok ? json(AUDIT_CAPABILITIES) : auth.response;
  }
  if (request.method === 'GET' && path === '/audit/v1/readiness') {
    const auth = await authenticateBearer(request, env, ['audit:admin']);
    return auth.ok ? json(readiness(env)) : auth.response;
  }
  if (request.method === 'POST' && path === '/audit/v1/jobs') {
    const auth = await authenticateBearer(request, env, ['audit:submit']);
    if (!auth.ok) return auth.response;
    validateAuditJobRequest(await parseJsonRequest(request));
    return json({
      error: { code: 'execution_plane_unavailable', message: 'Submitted Audit execution is disabled until the hardened executor is approved' },
      capabilities: { executionEnabled: false, executionState: AUDIT_CAPABILITIES.executionState }
    }, 503);
  }
  return error('not_found', 'Route not found', 404);
}

export default {
  async fetch(request, env) {
    try { return withCors(await route(request, env), env); }
    catch (cause) {
      if (cause instanceof ValidationError) return withCors(error(cause.code, cause.message, 400, { path: cause.path }), env);
      console.error(cause);
      return withCors(error('internal_error', 'Internal server error', 500), env);
    }
  }
};
