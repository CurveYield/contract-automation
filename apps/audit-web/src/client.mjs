import { deepFreeze, redactDiagnosticText } from '../../../packages/audit-report-view-model/src/index.mjs';

const SECRET_KEYS = /^(?:api[_-]?key|authorization|cookie|credential|key|password|secret|signature|token)$/i;
const SECRET_QUERY_KEYS = new Set(['api_key', 'apikey', 'authorization', 'key', 'password', 'secret', 'signature', 'token']);
const MAX_DEPTH = 12;
const MAX_ITEMS = 100;

export class AuditClientError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AuditClientError';
    this.code = code;
  }
}

function normalizePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || value.includes('\\')) {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is not allowed.');
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is not allowed.');
  }
  let parsed;
  try {
    parsed = new URL(value, 'https://audit.invalid');
  } catch (error) {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is not allowed.', error);
  }
  if (!parsed.pathname.startsWith('/api/audit/') && parsed.pathname !== '/api/audit') {
    throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'The requested audit resource path is outside the audit namespace.');
  }
  if (parsed.hash) throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'Fragments are not allowed in audit resource paths.');
  for (const key of parsed.searchParams.keys()) {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
      throw new AuditClientError('UI_CLIENT_UNSAFE_PATH', 'Credential-shaped query fields are not allowed.');
    }
  }
  return `${parsed.pathname}${parsed.search}`;
}

function copySafe(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactDiagnosticText(value, 2000);
  if (typeof value === 'bigint') return String(value);
  if (typeof value !== 'object' || depth >= MAX_DEPTH || seen.has(value)) return null;
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
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
    output[key.slice(0, 160)] = copySafe(descriptor.value, depth + 1, seen);
    count += 1;
    if (count >= MAX_ITEMS) break;
  }
  return output;
}

export function createAuditClient({ transport } = {}) {
  if (typeof transport !== 'function') throw new TypeError('An injected transport function is required.');
  const active = new Map();
  const counters = new Map();

  async function request(path, { slot = 'default' } = {}) {
    const safePath = normalizePath(path);
    const safeSlot = typeof slot === 'string' && slot.length > 0 ? slot.slice(0, 120) : 'default';
    const previous = active.get(safeSlot);
    if (previous) previous.controller.abort();
    const sequence = (counters.get(safeSlot) || 0) + 1;
    counters.set(safeSlot, sequence);
    const controller = new AbortController();
    active.set(safeSlot, { controller, sequence });
    let result;
    try {
      result = await transport(Object.freeze({
        path: safePath,
        method: 'GET',
        signal: controller.signal,
        headers: Object.freeze({ accept: 'application/json' })
      }));
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw new AuditClientError('UI_CLIENT_ABORTED', 'The prior audit request was cancelled.', error);
      }
      throw new AuditClientError('UI_CLIENT_TRANSPORT', 'The injected audit transport failed.', error);
    }
    const current = active.get(safeSlot);
    if (!current || current.sequence !== sequence) {
      throw new AuditClientError('UI_CLIENT_STALE_RESPONSE', 'A stale audit response was rejected.');
    }
    active.delete(safeSlot);
    return deepFreeze(copySafe(result));
  }

  function cancel(slot = 'default') {
    const safeSlot = typeof slot === 'string' && slot.length > 0 ? slot.slice(0, 120) : 'default';
    const current = active.get(safeSlot);
    if (!current) return false;
    current.controller.abort();
    active.delete(safeSlot);
    return true;
  }

  function dispose() {
    for (const current of active.values()) current.controller.abort();
    active.clear();
  }

  return Object.freeze({ request, cancel, dispose });
}
