import { deepFreeze, redactDiagnosticText } from '../../../packages/audit-report-view-model/src/index.mjs';

const SECRET_KEYS = /^(?:__proto__|prototype|constructor|api[_-]?key|authorization|cookie|credential|key|password|secret|signature|token)$/i;
const SECRET_QUERY_KEYS = new Set(['api_key', 'apikey', 'authorization', 'key', 'password', 'secret', 'signature', 'token']);
const MAX_DEPTH = 12;
const MAX_ITEMS = 100;
const MAX_CACHE_ENTRIES = 32;
const MAX_ETAG = 200;

export class AuditClientError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AuditClientError';
    this.code = code;
  }
}

function safeDescriptors(value) {
  try { return Object.getOwnPropertyDescriptors(value); } catch { return null; }
}

function safeArrayIsArray(value) {
  try { return Array.isArray(value); } catch { return false; }
}

function ownData(descriptors, key) {
  const descriptor = descriptors?.[key];
  return descriptor?.enumerable && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function normalizePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || value.includes('\\')) {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is not allowed.');
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is not allowed.');
  }
  let parsed;
  try { parsed = new URL(value, 'https://audit.invalid'); }
  catch (error) { throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is not allowed.', error); }
  if (!parsed.pathname.startsWith('/api/audit/') && parsed.pathname !== '/api/audit') {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is outside the audit namespace.');
  }
  if (parsed.hash) throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'Fragments are not allowed in audit resource paths.');
  for (const key of parsed.searchParams.keys()) {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'Credential-shaped query fields are not allowed.');
  }
  return `${parsed.pathname}${parsed.search}`;
}

function normalizeLabel(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  return value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 120) || fallback;
}

function normalizeCacheScope(value) {
  const scope = normalizeLabel(value, 'public');
  if (!/^[A-Za-z0-9._:-]+$/.test(scope) || /(?:api[_-]?key|authorization|password|secret|signature|token)/i.test(scope)) {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The audit cache scope is not allowed.');
  }
  return scope;
}

function normalizeEtag(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ETAG || /[\r\n]/.test(value)) return null;
  return value;
}

function copySafe(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactDiagnosticText(value, 2000);
  if (typeof value === 'bigint') return String(value);
  if (typeof value !== 'object' || depth >= MAX_DEPTH) return null;
  try { if (seen.has(value)) return null; seen.add(value); } catch { return null; }
  const descriptors = safeDescriptors(value);
  if (!descriptors) return null;
  if (safeArrayIsArray(value)) {
    const output = [];
    const keys = Object.keys(descriptors).filter((key) => /^(?:0|[1-9]\d*)$/.test(key)).map(Number).sort((a, b) => a - b);
    for (const index of keys) {
      const descriptor = descriptors[String(index)];
      if (descriptor?.enumerable && Object.hasOwn(descriptor, 'value')) output.push(copySafe(descriptor.value, depth + 1, seen));
      if (output.length >= MAX_ITEMS) break;
    }
    return output;
  }
  const output = {};
  let count = 0;
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || SECRET_KEYS.test(key)) continue;
    Object.defineProperty(output, key.slice(0, 160), {
      value: copySafe(descriptor.value, depth + 1, seen), enumerable: true, writable: true, configurable: true
    });
    count += 1;
    if (count >= MAX_ITEMS) break;
  }
  return output;
}

function responseEnvelope(value) {
  const descriptors = safeDescriptors(value);
  if (!descriptors) return null;
  const status = ownData(descriptors, 'status');
  const hasBody = Object.hasOwn(descriptors, 'body') && descriptors.body?.enumerable && Object.hasOwn(descriptors.body, 'value');
  if (!Number.isInteger(status) || status < 100 || status > 599 || (!hasBody && status !== 304)) return null;
  return { status, etag: normalizeEtag(ownData(descriptors, 'etag')), body: hasBody ? ownData(descriptors, 'body') : undefined };
}

function isOfflineError(error) {
  return error?.code === 'OFFLINE' || error?.code === 'UI_CLIENT_OFFLINE' || error?.name === 'OfflineError';
}

export function createAuditClient({ transport } = {}) {
  if (typeof transport !== 'function') throw new TypeError('An injected transport function is required.');
  const active = new Map();
  const counters = new Map();
  const cache = new Map();

  function cacheKey(scope, path) { return `${scope}\u0000${path}`; }
  function putCache(key, entry) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, entry);
    while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  }

  function request(path, { slot = 'default', cacheScope = 'public', allowStaleOnError = false } = {}) {
    const safePath = normalizePath(path);
    const safeSlot = normalizeLabel(slot, 'default');
    const safeScope = normalizeCacheScope(cacheScope);
    const key = cacheKey(safeScope, safePath);
    const requestKey = `${safeSlot}\u0000${key}`;
    const prior = active.get(safeSlot);
    if (prior?.requestKey === requestKey) return prior.promise;
    if (prior) prior.controller.abort();

    const sequence = (counters.get(safeSlot) || 0) + 1;
    counters.set(safeSlot, sequence);
    const controller = new AbortController();
    const cached = cache.get(key);
    const headers = Object.create(null);
    headers.accept = 'application/json';
    if (cached?.etag) headers['if-none-match'] = cached.etag;
    const requestPlan = Object.freeze({ path: safePath, method: 'GET', signal: controller.signal, headers: Object.freeze(headers) });

    const promise = (async () => {
      let raw;
      try { raw = await transport(requestPlan); }
      catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') throw new AuditClientError('UI_CLIENT_ABORTED', 'The prior audit request was cancelled.', error);
        if (isOfflineError(error)) {
          if (allowStaleOnError && cached) return deepFreeze({ __auditCacheState: 'offline-stale', value: cached.body });
          throw new AuditClientError('UI_CLIENT_OFFLINE', 'The audit transport is offline.', error);
        }
        if (error instanceof TypeError && /proxy.*revoked|revoked.*proxy/i.test(String(error.message))) raw = null;
        else throw new AuditClientError('UI_CLIENT_TRANSPORT', 'The injected audit transport failed.', error);
      }

      const current = active.get(safeSlot);
      if (!current || current.sequence !== sequence) throw new AuditClientError('UI_CLIENT_STALE_RESPONSE', 'A stale audit response was rejected.');

      const envelope = responseEnvelope(raw);
      let output;
      if (envelope) {
        if (envelope.status === 304) {
          if (!cached || (envelope.etag && cached.etag && envelope.etag !== cached.etag)) {
            throw new AuditClientError('UI_CLIENT_CACHE_MISS', 'A conditional audit response had no matching scoped cache entry.');
          }
          output = cached.body;
        } else if (envelope.status === 401 || envelope.status === 403) {
          throw new AuditClientError('UI_CLIENT_UNAUTHORIZED', 'The audit resource is unavailable to the current identity.');
        } else if (envelope.status >= 200 && envelope.status < 300) {
          output = deepFreeze(copySafe(envelope.body));
          if (envelope.etag) putCache(key, Object.freeze({ etag: envelope.etag, body: output }));
        } else {
          throw new AuditClientError('UI_CLIENT_TRANSPORT', `The audit transport returned status ${envelope.status}.`);
        }
      } else {
        output = deepFreeze(copySafe(raw));
      }
      return output;
    })().finally(() => {
      const current = active.get(safeSlot);
      if (current?.sequence === sequence) active.delete(safeSlot);
    });

    active.set(safeSlot, { controller, sequence, requestKey, promise });
    return promise;
  }

  function cancel(slot = 'default') {
    const safeSlot = normalizeLabel(slot, 'default');
    const current = active.get(safeSlot);
    if (!current) return false;
    current.controller.abort();
    active.delete(safeSlot);
    return true;
  }

  function dispose() {
    for (const current of active.values()) current.controller.abort();
    active.clear();
    cache.clear();
  }

  return Object.freeze({ request, cancel, dispose });
}
