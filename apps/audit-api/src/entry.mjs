import worker from './phase3.mjs';
import {
  auditPhase3Capabilities,
  auditRuntimeReadiness,
  isUnsupportedRetentionPolicy,
  sanitizeAuditRuntimeEnv
} from './runtime.mjs';
import {
  auditPhase4Capabilities,
  handlePhase4CatalogRequest
} from './phase4-catalog.mjs';
import { handlePhase5CatalogRequest } from './phase5-catalog.mjs';
import { handlePhase6CatalogRequest } from './phase6-catalog.mjs';
import { handlePhase9ReportRequest } from './phase9-reports.mjs';
import {
  auditPhase9Capabilities,
  handlePhase9GptRequest
} from './phase9-gpt.mjs';
import {
  deriveUploadGrantSigningKey,
  encodeUploadGrantSigningKey
} from './upload-grants.mjs';

const encoder = new TextEncoder();
const READ_ONLY_HANDLERS = Object.freeze([
  handlePhase4CatalogRequest,
  handlePhase5CatalogRequest,
  handlePhase6CatalogRequest,
  handlePhase9ReportRequest,
  handlePhase9GptRequest
]);

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
async function hasSubmitScope(request, env) {
  const token = bearer(request);
  if (!token) return false;
  for (const key of [env?.AUDIT_SUBMIT_API_KEY, env?.AUDIT_ADMIN_API_KEY]) {
    if (await secureEqual(token, key)) return true;
  }
  return false;
}
function jsonWithHeaders(value, response, status = response.status) {
  const headers = new Headers(response.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { status, statusText: response.statusText, headers });
}
async function prepareAuditRuntimeEnv(env) {
  const sanitized = sanitizeAuditRuntimeEnv(env);
  let uploadGrantSigningKey;
  if (typeof sanitized?.AUDIT_EDGE_CONTROL_PLANE_TOKEN === 'string' && sanitized.AUDIT_EDGE_CONTROL_PLANE_TOKEN.length > 0) {
    uploadGrantSigningKey = encodeUploadGrantSigningKey(await deriveUploadGrantSigningKey(sanitized.AUDIT_EDGE_CONTROL_PLANE_TOKEN));
  }
  return new Proxy(sanitized ?? {}, {
    get(target, property, receiver) {
      if (property === 'AUDIT_UPLOAD_GRANT_SIGNING_KEY') return uploadGrantSigningKey;
      return Reflect.get(target, property, receiver);
    },
    has(target, property) {
      if (property === 'AUDIT_UPLOAD_GRANT_SIGNING_KEY') return uploadGrantSigningKey !== undefined;
      return Reflect.has(target, property);
    }
  });
}
async function unsupportedRetentionResponse(request, runtimeEnv, url) {
  if (request.method !== 'POST' || url.pathname !== '/audit/v1/campaigns') return null;
  let body;
  try { body = await request.clone().json(); }
  catch { return null; }
  if (!isUnsupportedRetentionPolicy(body?.creation?.retentionPolicy)) return null;
  if (!(await hasSubmitScope(request, runtimeEnv))) return null;
  const probe = await worker.fetch(new Request(request.url, { method: 'GET', headers: request.headers }), runtimeEnv);
  const headers = new Headers(probe.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({
    error: {
      code: 'unsupported_retention_policy',
      message: 'Only free-development retention is available until versioned retention-class storage is implemented',
      details: { path: '$.creation.retentionPolicy' }
    }
  }), { status: 400, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const runtimeEnv = await prepareAuditRuntimeEnv(env);

    for (const handler of READ_ONLY_HANDLERS) {
      const handled = await handler(request, runtimeEnv);
      if (handled) return handled;
    }

    const retentionDenied = await unsupportedRetentionResponse(request, runtimeEnv, url);
    if (retentionDenied) return retentionDenied;

    const response = await worker.fetch(request, runtimeEnv);
    if (response.status === 200 && request.method === 'GET' && url.pathname === '/audit/v1/capabilities') {
      const legacy = auditPhase4Capabilities(auditPhase3Capabilities(env));
      return jsonWithHeaders(auditPhase9Capabilities(legacy), response);
    }
    if (response.status === 200 && request.method === 'GET' && url.pathname === '/audit/v1/readiness') {
      return jsonWithHeaders(auditRuntimeReadiness(env), response);
    }
    return response;
  }
};
