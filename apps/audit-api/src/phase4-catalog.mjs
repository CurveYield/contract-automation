import {
  ValidationError
} from '../../../packages/audit-protocol/src/index.mjs';
import {
  PHASE4_PROFILE_CATALOG,
  getPhase4Profile,
  listPhase4Profiles
} from '../../../packages/audit-tool-catalog/src/index.mjs';

export const PHASE4_TOOL_PROFILE_LIST_PATH = '/audit/v1/tool-profiles';
export const PHASE4_TOOL_PROFILE_ITEM_PREFIX = '/audit/v1/tool-profiles/';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const encoder = new TextEncoder();

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function responseHeaders(env) {
  return {
    'content-type': JSON_CONTENT_TYPE,
    'access-control-allow-origin': env?.CORS_ORIGIN || 'null',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-max-age': '86400',
    'x-content-type-options': 'nosniff'
  };
}

function json(value, status, env) {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders(env) });
}

function failure(code, message, status, path, env) {
  return json({ error: { code, message, ...(path ? { details: { path } } : {}) } }, status, env);
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function secureEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const [a, b] = await Promise.all([digest(left), digest(right)]);
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

async function authenticateRead(request, env) {
  const token = bearer(request);
  if (!token) return failure('unauthorized', 'Invalid Audit API key', 401, undefined, env);
  const credentials = [env?.AUDIT_READ_API_KEY, env?.AUDIT_SUBMIT_API_KEY, env?.AUDIT_ADMIN_API_KEY];
  for (const credential of credentials) {
    if (await secureEqual(token, credential)) return null;
  }
  return failure('unauthorized', 'Invalid Audit API key', 401, undefined, env);
}

function catalogRoute(pathname) {
  return pathname === PHASE4_TOOL_PROFILE_LIST_PATH || pathname.startsWith(PHASE4_TOOL_PROFILE_ITEM_PREFIX);
}

function profileIdFromPath(pathname) {
  const encoded = pathname.slice(PHASE4_TOOL_PROFILE_ITEM_PREFIX.length);
  try { return decodeURIComponent(encoded); }
  catch { throw new ValidationError('invalid_profile_id', '$.profileId must be a lowercase versioned profile slug', '$.profileId'); }
}

export function auditPhase4Health() {
  return deepFreeze({ status: 'ok', service: 'curveyield-audit-api', version: '0.4.0', phase: 4 });
}

export function auditPhase4Capabilities(baseCapabilities) {
  const base = baseCapabilities && typeof baseCapabilities === 'object' ? structuredClone(baseCapabilities) : {};
  return deepFreeze({
    ...base,
    service: 'curveyield-audit',
    apiVersion: 'audit-v1',
    phase: 4,
    toolProfileCatalog: true,
    toolProfileContracts: true,
    adapterPlans: true,
    outputParsers: false,
    executionEnabled: false,
    executionState: 'awaiting_executor',
    executorState: 'unavailable'
  });
}

export async function handlePhase4CatalogRequest(request, env) {
  const pathname = new URL(request.url).pathname;
  if (!catalogRoute(pathname)) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(env) });
  }

  const denied = await authenticateRead(request, env);
  if (denied) return denied;
  if (request.method !== 'GET') {
    return failure('method_not_allowed', 'Phase 4 profile catalog routes are read-only', 405, undefined, env);
  }

  if (pathname === PHASE4_TOOL_PROFILE_LIST_PATH) {
    return json({
      schemaVersion: 'phase4-tool-profile-list-v1',
      profiles: listPhase4Profiles(PHASE4_PROFILE_CATALOG)
    }, 200, env);
  }

  try {
    return json(getPhase4Profile(PHASE4_PROFILE_CATALOG, profileIdFromPath(pathname)), 200, env);
  } catch (cause) {
    if (cause instanceof ValidationError) {
      const status = cause.code === 'not_found' ? 404 : 400;
      return failure(cause.code, cause.message, status, cause.path, env);
    }
    throw cause;
  }
}
