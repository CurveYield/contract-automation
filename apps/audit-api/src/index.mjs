import {
  AUDIT_CAPABILITIES,
  ValidationError,
  assertAuditId,
  assertScopes,
  scanAuditForbiddenFields,
  validateAuditJobRequest
} from '../../../packages/audit-protocol/src/index.mjs';
import { ConditionalWriteError } from '../../../packages/audit-r2-store/src/index.mjs';
import { ProfileRegistry } from '../../../packages/audit-profile-registry/src/index.mjs';
import { WorkspaceService, createUploadGrant } from '../../../packages/audit-workspaces/src/index.mjs';
import { validateGitHubWorkspaceSource } from '../../../packages/audit-workspace-protocol/src/index.mjs';

const JSON_HEADERS = Object.freeze({ 'content-type': 'application/json; charset=utf-8' });
const MAX_BODY_BYTES = 1024 * 1024;
const INTERNAL_CLOCK_SKEW_SECONDS = 5 * 60;
const PHASE_2_CAPABILITIES = Object.freeze({
  ...AUDIT_CAPABILITIES,
  phase: 2,
  workspaces: true,
  generatedLayers: true,
  profileRegistry: true,
  executionEnabled: false
});

class ServiceUnavailableError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.code = code;
    this.status = 503;
  }
}

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

function strictObject(value, allowedKeys, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path);
  scanAuditForbiddenFields(value, path);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  }
}

function requiredKeys(value, keys, path = '$') {
  for (const key of keys) {
    if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
  }
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
    const stored = await env.AUDIT_NONCE_STORE.put(
      `internal-nonces/${timestamp}/${nonce}.json`,
      JSON.stringify({ timestamp, nonce }),
      { onlyIf: { etagDoesNotMatch: '*' } }
    );
    if (stored === null) {
      return { ok: false, response: error('replay_detected', 'Internal request nonce has already been used', 409) };
    }
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

function createR2Store(binding) {
  if (!binding) return null;
  return Object.freeze({
    async put(key, value, options) {
      const result = await binding.put(key, value, options);
      if (result === null) throw new ConditionalWriteError();
      return result;
    },
    async get(key) {
      const result = await binding.get(key);
      if (!result) return null;
      if ('value' in result) return result;
      const value = new Uint8Array(await result.arrayBuffer());
      return { key: result.key ?? key, etag: result.etag, size: result.size ?? value.byteLength, value };
    },
    async head(key) { return binding.head(key); },
    async delete(key) { return binding.delete(key); }
  });
}

function nowFromEnv(env) {
  return typeof env.AUDIT_NOW === 'function' ? env.AUDIT_NOW : () => new Date();
}

function grantKey(env) {
  if (typeof env.AUDIT_UPLOAD_GRANT_SIGNING_KEY !== 'string' || env.AUDIT_UPLOAD_GRANT_SIGNING_KEY.length < 16) {
    throw new ServiceUnavailableError('upload_grant_signer_unavailable', 'Upload grant signer is unavailable');
  }
  return env.AUDIT_UPLOAD_GRANT_SIGNING_KEY;
}

function workspaceService(env) {
  if (env.AUDIT_WORKSPACE_SERVICE) return env.AUDIT_WORKSPACE_SERVICE;
  const store = createR2Store(env.AUDIT_CONTROL_STORE);
  if (!store) throw new ServiceUnavailableError('workspace_store_unavailable', 'Workspace storage is unavailable');
  return new WorkspaceService(store, {
    now: nowFromEnv(env),
    verifyGrant: async (payload, signature) => secureEqual(signature, await hmacHex(grantKey(env), payload))
  });
}

function profileRegistry(env) {
  if (env.AUDIT_PROFILE_REGISTRY) return env.AUDIT_PROFILE_REGISTRY;
  const store = createR2Store(env.AUDIT_CONTROL_STORE);
  if (!store) throw new ServiceUnavailableError('profile_store_unavailable', 'Profile registry storage is unavailable');
  return new ProfileRegistry(store);
}

function requireIntegration(env, name, code, message) {
  if (typeof env[name] !== 'function') throw new ServiceUnavailableError(code, message);
  return env[name];
}

async function authenticateRoute(request, env, scopes) {
  const auth = await authenticateBearer(request, env, scopes);
  return auth.ok ? null : auth.response;
}

async function routePhase2(request, env, path) {
  if (request.method === 'POST' && path === '/audit/v1/workspace-upload-grants') {
    const denied = await authenticateRoute(request, env, ['audit:submit']);
    if (denied) return denied;
    const body = await parseJsonRequest(request);
    const key = grantKey(env);
    const grant = await createUploadGrant(body, { now: nowFromEnv(env), sign: (payload) => hmacHex(key, payload) });
    const signer = requireIntegration(env, 'AUDIT_UPLOAD_URL_SIGNER', 'upload_url_signer_unavailable', 'Upload URL signer is unavailable');
    const upload = await signer({ objectKey: grant.destinationKey, contentType: grant.contentType, bytes: grant.bytes, expiresAt: grant.expiresAt });
    return json({ grant, upload }, 201);
  }

  if (request.method === 'POST' && path === '/audit/v1/workspaces/seal') {
    const denied = await authenticateRoute(request, env, ['audit:submit']);
    if (denied) return denied;
    return json(await workspaceService(env).sealUploadedWorkspace(await parseJsonRequest(request)), 201);
  }

  if (request.method === 'POST' && path === '/audit/v1/workspaces/import-github') {
    const denied = await authenticateRoute(request, env, ['audit:submit']);
    if (denied) return denied;
    const body = await parseJsonRequest(request);
    const keys = new Set(['tenantId', 'workspaceId', 'repository', 'commitSha', 'refName', 'indexEtag']);
    strictObject(body, keys);
    requiredKeys(body, new Set(['tenantId', 'workspaceId', 'repository', 'commitSha', 'refName']));
    assertAuditId(body.tenantId, 'tenant', '$.tenantId');
    assertAuditId(body.workspaceId, 'workspace', '$.workspaceId');
    if (typeof body.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(body.repository)) {
      throw new ValidationError('invalid_repository', '$.repository must be owner/name', '$.repository');
    }
    if (typeof body.commitSha !== 'string' || !/^[0-9a-f]{40}$/.test(body.commitSha)) {
      throw new ValidationError('unresolved_git_ref', '$.commitSha must be an exact lowercase 40-hex commit SHA', '$.commitSha');
    }
    if (typeof body.refName !== 'string' || body.refName.length < 1 || body.refName.length > 255) {
      throw new ValidationError('invalid_ref_name', '$.refName is invalid', '$.refName');
    }
    const resolver = requireIntegration(env, 'AUDIT_GITHUB_ARCHIVE_RESOLVER', 'github_resolver_unavailable', 'GitHub archive resolver is unavailable');
    const resolved = await resolver({ repository: body.repository, commitSha: body.commitSha });
    const source = validateGitHubWorkspaceSource({
      tenantId: body.tenantId,
      repository: body.repository,
      commitSha: body.commitSha,
      refName: body.refName,
      archiveSha256: resolved.archiveSha256,
      bytes: resolved.bytes
    });
    return json(await workspaceService(env).importGitHubWorkspace({
      workspaceId: body.workspaceId,
      source,
      archiveBytes: resolved.archiveBytes,
      ...(body.indexEtag ? { indexEtag: body.indexEtag } : {})
    }), 201);
  }

  const layersMatch = path.match(/^\/audit\/v1\/workspaces\/(ws_[0-9a-f]{32})\/layers$/);
  if (layersMatch && request.method === 'GET') {
    const denied = await authenticateRoute(request, env, ['audit:read']);
    if (denied) return denied;
    return json(await workspaceService(env).readLayerIndex(layersMatch[1]));
  }
  if (layersMatch && request.method === 'POST') {
    const denied = await authenticateRoute(request, env, ['audit:admin']);
    if (denied) return denied;
    const body = await parseJsonRequest(request);
    const keys = new Set(['layerBundleId', 'manifest', 'indexEtag', 'eventBatch']);
    strictObject(body, keys);
    requiredKeys(body, new Set(['layerBundleId', 'manifest', 'eventBatch']));
    if (typeof body.layerBundleId !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(body.layerBundleId)) {
      throw new ValidationError('invalid_bundle_id', '$.layerBundleId is invalid', '$.layerBundleId');
    }
    if (body.manifest?.workspaceId !== layersMatch[1]) {
      throw new ValidationError('workspace_mismatch', '$.manifest.workspaceId must match the route', '$.manifest.workspaceId');
    }
    const resolver = requireIntegration(env, 'AUDIT_LAYER_BUNDLE_RESOLVER', 'layer_resolver_unavailable', 'Generated layer bundle resolver is unavailable');
    const resolved = await resolver({ layerBundleId: body.layerBundleId, workspaceId: layersMatch[1], layerId: body.manifest?.layerId });
    return json(await workspaceService(env).attachLayer({
      archiveBytes: resolved.archiveBytes,
      manifest: body.manifest,
      eventBatch: body.eventBatch,
      ...(body.indexEtag ? { indexEtag: body.indexEtag } : {})
    }), 201);
  }

  const workspaceMatch = path.match(/^\/audit\/v1\/workspaces\/(ws_[0-9a-f]{32})$/);
  if (workspaceMatch && request.method === 'GET') {
    const denied = await authenticateRoute(request, env, ['audit:read']);
    if (denied) return denied;
    return json(await workspaceService(env).readWorkspace(workspaceMatch[1]));
  }

  if (request.method === 'GET' && path === '/audit/v1/profiles') {
    const denied = await authenticateRoute(request, env, ['audit:read']);
    if (denied) return denied;
    return json(await profileRegistry(env).readIndex());
  }

  const profileMatch = path.match(/^\/audit\/v1\/profiles\/([a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*)$/);
  if (profileMatch && request.method === 'GET') {
    const denied = await authenticateRoute(request, env, ['audit:read']);
    if (denied) return denied;
    return json(await profileRegistry(env).read(profileMatch[1]));
  }

  return null;
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method === 'GET' && path === '/audit/v1/health') {
    return json({ status: 'ok', service: 'curveyield-audit-api', version: '0.2.0', phase: 2 });
  }
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
    return auth.ok ? json(PHASE_2_CAPABILITIES) : auth.response;
  }
  if (request.method === 'GET' && path === '/audit/v1/readiness') {
    const auth = await authenticateBearer(request, env, ['audit:admin']);
    return auth.ok ? json(readiness(env)) : auth.response;
  }
  const phase2 = await routePhase2(request, env, path);
  if (phase2) return phase2;
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
    try {
      return withCors(await route(request, env), env);
    } catch (cause) {
      if (cause instanceof ValidationError) {
        const status = cause.code === 'not_found' ? 404 : 400;
        return withCors(error(cause.code, cause.message, status, { path: cause.path }), env);
      }
      if (cause instanceof ConditionalWriteError || cause?.code === 'precondition_failed') {
        return withCors(error('conflict', 'Concurrent state update conflict', 409), env);
      }
      if (cause instanceof ServiceUnavailableError) {
        return withCors(error(cause.code, cause.message, cause.status), env);
      }
      console.error(cause);
      return withCors(error('internal_error', 'Internal server error', 500), env);
    }
  }
};
