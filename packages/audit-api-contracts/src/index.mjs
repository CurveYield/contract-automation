const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export const AUDIT_API_CONTRACT_VERSION = 'audit-api-contracts-v2';
export const AUDIT_API_BOUNDS = Object.freeze({
  encodedValueBytes: 1_000_000,
  responseBodyBytes: 1_000_000,
  stringBytes: 8_192,
  keyBytes: 160,
  collectionEntries: 1_000,
  nestingDepth: 24,
  cursorBytes: 4_096
});

const CODE = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_PATH = /^\$(?:\.(?:[A-Za-z][A-Za-z0-9_]{0,63}|\[rejected-field\])|\[[0-9]{1,6}\])*$/;
const RESERVED_RESPONSE_HEADERS = new Set([
  'access-control-allow-origin',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-max-age',
  'cache-control',
  'content-length',
  'content-type',
  'etag',
  'set-cookie',
  'vary',
  'x-content-type-options'
]);

function utf8Length(value) {
  return encoder.encode(value).byteLength;
}

function bounded(value, maximum) {
  const text = typeof value === 'string' ? value : '';
  if (utf8Length(text) <= maximum) return text;
  let end = Math.min(text.length, maximum);
  while (end > 0 && utf8Length(text.slice(0, end)) > maximum) end -= 1;
  return text.slice(0, end);
}

export class ApiContractError extends Error {
  constructor(code, message, path = '$', status = 400) {
    const safeCode = CODE.test(code) ? code : 'invalid_request';
    const safeMessage = bounded(redactText(message || 'Request rejected'), 160) || 'Request rejected';
    super(safeMessage);
    this.name = 'ApiContractError';
    this.code = safeCode;
    this.path = SAFE_PATH.test(path) && utf8Length(path) <= 120 ? path : '$.[rejected-field]';
    this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 400;
  }
}

function reflectContainer(value, path) {
  let descriptorMap;
  let isArray;
  let prototype;
  try {
    descriptorMap = Object.getOwnPropertyDescriptors(value);
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new ApiContractError('hostile_object', 'Object reflection failed', path);
  }
  const keys = Reflect.ownKeys(descriptorMap);
  for (const key of keys) {
    if (typeof key === 'symbol') {
      throw new ApiContractError('symbol_key', 'Symbol keys are not allowed', path);
    }
    const descriptor = descriptorMap[key];
    if ('get' in descriptor || 'set' in descriptor) {
      throw new ApiContractError('hostile_object', 'Accessors are not allowed', path);
    }
  }
  return { descriptorMap, keys, isArray, prototype };
}

function validateNode(value, path, seen, depth) {
  if (depth > AUDIT_API_BOUNDS.nestingDepth) {
    throw new ApiContractError('value_too_deep', 'Value nesting exceeds the limit', path);
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const bytes = utf8Length(value);
    if (bytes > AUDIT_API_BOUNDS.encodedValueBytes) {
      throw new ApiContractError('value_too_large', 'Encoded value exceeds the limit', path);
    }
    if (bytes > AUDIT_API_BOUNDS.stringBytes || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
      throw new ApiContractError('invalid_string', 'String is invalid or too long', path);
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new ApiContractError('invalid_number', 'Number must be a safe non-negative-zero integer', path);
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new ApiContractError('invalid_type', 'Unsupported value type', path);
  }
  if (seen.has(value)) throw new ApiContractError('cyclic_value', 'Cycles are not allowed', path);
  seen.add(value);
  const { descriptorMap, keys, isArray, prototype } = reflectContainer(value, path);
  let output;
  if (isArray) {
    if (prototype !== Array.prototype) throw new ApiContractError('invalid_array', 'Array prototype is invalid', path);
    const length = descriptorMap.length?.value;
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new ApiContractError('invalid_array', 'Array length is invalid', path);
    }
    if (length > AUDIT_API_BOUNDS.collectionEntries) {
      throw new ApiContractError('collection_too_large', 'Array exceeds the limit', path);
    }
    const allowedKeys = new Set([...Array.from({ length }, (_, index) => String(index)), 'length']);
    for (const key of keys) {
      if (!allowedKeys.has(key)) {
        throw new ApiContractError('unknown_array_property', 'Array properties are not allowed', path);
      }
    }
    output = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptorMap[String(index)];
      if (!descriptor || descriptor.enumerable !== true) {
        throw new ApiContractError('sparse_array', 'Sparse arrays are not allowed', path);
      }
      output.push(validateNode(descriptor.value, `${path}[${index}]`, seen, depth + 1));
    }
  } else {
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ApiContractError('invalid_plain_object', 'Plain object required', path);
    }
    if (keys.length > AUDIT_API_BOUNDS.collectionEntries) {
      throw new ApiContractError('collection_too_large', 'Object exceeds the key limit', path);
    }
    output = {};
    for (const key of [...keys].sort()) {
      if (
        key.length < 1 ||
        utf8Length(key) > AUDIT_API_BOUNDS.keyBytes ||
        /[\u0000-\u001f\u007f]/u.test(key)
      ) {
        throw new ApiContractError('invalid_key', 'Object key is invalid', '$.[rejected-field]');
      }
      const descriptor = descriptorMap[key];
      if (descriptor.enumerable !== true) {
        throw new ApiContractError('hostile_object', 'Non-enumerable properties are not allowed', path);
      }
      output[key] = validateNode(descriptor.value, `${path}.${key}`, seen, depth + 1);
    }
  }
  seen.delete(value);
  return output;
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateExternalValue(value, path = '$') {
  const output = validateNode(value, path, new Set(), 0);
  if (utf8Length(stable(output)) > AUDIT_API_BOUNDS.encodedValueBytes) {
    throw new ApiContractError('value_too_large', 'Encoded value exceeds the limit', path);
  }
  return freeze(output);
}

export function canonicalJson(value) {
  return stable(validateExternalValue(value));
}

async function sha256Bytes(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
function fromBase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,5464}$/u.test(value)) {
    throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor');
  }
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  let binary;
  try { binary = atob(padded); }
  catch { throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor'); }
  if (binary.length > AUDIT_API_BOUNDS.cursorBytes) {
    throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor');
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function equalBytes(left, right) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

const READ_IDENTITIES = Object.freeze([
  ['AUDIT_CLIENT_API_KEY', 'client'],
  ['AUDIT_GPT_API_KEY', 'gpt'],
  ['AUDIT_READ_API_KEY', 'legacy-read'],
  ['AUDIT_SUBMIT_API_KEY', 'legacy-submit'],
  ['AUDIT_ADMIN_API_KEY', 'legacy-admin'],
  ['AUDIT_SERVICE_READ_API_KEY', 'service-read']
]);

function bearerToken(request) {
  const value = request.headers.get('authorization');
  if (typeof value !== 'string') return null;
  const match = /^Bearer ([^\s]{1,4096})$/u.exec(value);
  return match?.[1] ?? null;
}
async function secureEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length === 0 || right.length === 0) return false;
  const [a, b] = await Promise.all([sha256Bytes(left), sha256Bytes(right)]);
  return equalBytes(a, b);
}

function configuredIdentityValues(env) {
  const configured = [];
  for (const [environmentKey, identity] of READ_IDENTITIES) {
    let value;
    try { value = env?.[environmentKey]; }
    catch {
      throw new ApiContractError('credential_configuration_error', 'Audit credential configuration is invalid', '$', 500);
    }
    if (typeof value === 'string' && value.length > 0) configured.push({ environmentKey, identity, value });
  }
  const seen = new Set();
  for (const item of configured) {
    if (seen.has(item.value)) {
      throw new ApiContractError(
        'credential_configuration_conflict',
        'Audit credential configuration contains a duplicate identity secret',
        '$',
        500
      );
    }
    seen.add(item.value);
  }
  return configured;
}

export async function authenticateAuditRead(request, env = {}) {
  const configured = configuredIdentityValues(env);
  const token = bearerToken(request);
  if (!token) throw new ApiContractError('unauthorized', 'Invalid Audit API key', '$', 401);
  for (const { environmentKey, identity, value } of configured) {
    if (await secureEqual(token, value)) return freeze({ identity, credentialName: environmentKey });
  }
  throw new ApiContractError('unauthorized', 'Invalid Audit API key', '$', 401);
}

function canonicalCorsOrigin(value) {
  if (value === 'null') return 'null';
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    utf8Length(value) > 512 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) return 'null';
  let url;
  try { url = new URL(value); }
  catch { return 'null'; }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.origin !== value
  ) return 'null';
  return value;
}

export function corsHeaders(env = {}) {
  return {
    'access-control-allow-origin': canonicalCorsOrigin(env.CORS_ORIGIN),
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-max-age': '86400',
    'x-content-type-options': 'nosniff'
  };
}

async function cacheHeaders(cache, canonicalBody) {
  if (!cache) return { 'cache-control': 'private, no-store' };
  const scope = validateExternalValue({
    tenantId: cache.tenantId,
    workspaceId: cache.workspaceId,
    route: cache.route,
    query: cache.query ?? ''
  }, '$.cache');
  const digest = base64url(await sha256Bytes(`${canonicalJson(scope)}\n${canonicalBody}`));
  return { 'cache-control': 'private, max-age=30, must-revalidate', etag: `"sha256-${digest}"` };
}

function extensionHeaders(headers) {
  let candidate;
  try { candidate = new Headers(headers); }
  catch { return {}; }
  const output = {};
  for (const [name, value] of candidate.entries()) {
    const normalized = name.toLowerCase();
    if (RESERVED_RESPONSE_HEADERS.has(normalized)) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(normalized)) continue;
    if (utf8Length(value) > 512 || /[\u0000-\u001f\u007f]/u.test(value)) continue;
    output[normalized] = value;
  }
  return output;
}

export async function createJsonResponse(value, { status = 200, env = {}, headers = {}, cache = null } = {}) {
  const body = canonicalJson(value);
  if (utf8Length(body) > AUDIT_API_BOUNDS.responseBodyBytes) {
    throw new ApiContractError('response_too_large', 'Response exceeds the encoded byte limit', '$', 500);
  }
  const cacheMetadata = await cacheHeaders(cache, body);
  return new Response(body, {
    status,
    headers: {
      ...extensionHeaders(headers),
      ...corsHeaders(env),
      'content-type': 'application/json; charset=utf-8',
      ...cacheMetadata
    }
  });
}

function redactText(value) {
  let text = typeof value === 'string' ? value : '';
  text = text.replace(/\b(?:authorization|proxy-authorization)\s*:\s*[^\r\n]+/giu, '[redacted-header]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{3,}/giu, 'Bearer [redacted]');
  text = text.replace(/\b(?:api[_-]?key|access[_-]?key|token|secret|private[_-]?key|mnemonic|seed)\s*[=:]\s*[^\s,;]+/giu, '[redacted]');
  text = text.replace(/https?:\/\/[^\s)\]}>,]+/giu, '[url]');
  text = text.replace(/\b[A-Za-z]:\\(?:[^\s\\]+\\)*[^\s\\]*/gu, '[path]');
  text = text.replace(/(?:^|\s)\/(?:home|Users|etc|var|tmp|private|root)(?:\/[^\s/]+)+/gu, ' [path]');
  return bounded(text.replace(/[\u0000-\u001f\u007f]/gu, ' '), 160);
}

export function normalizeApiError(cause, { fallbackCode = 'internal_error', fallbackStatus = 500 } = {}) {
  const known = cause instanceof ApiContractError;
  const code = known ? cause.code : fallbackCode;
  const status = known ? cause.status : fallbackStatus;
  const message = known ? redactText(cause.message) : 'The request could not be completed';
  const path = known ? cause.path : undefined;
  return freeze({
    status,
    body: {
      error: {
        code,
        message,
        ...(path && path !== '$' ? { details: { path } } : {})
      }
    },
    error: {
      code,
      message,
      ...(path && path !== '$' ? { details: { path } } : {})
    }
  });
}

export async function errorResponse(cause, env = {}) {
  const normalized = normalizeApiError(cause);
  return createJsonResponse(normalized.body, { status: normalized.status, env });
}

export async function encodePageCursor({ scope, kind, after }) {
  const payload = validateExternalValue({ v: 1, scope, kind, after }, '$.cursor');
  if (![scope, kind, after].every((value) => typeof value === 'string' && value.length > 0 && utf8Length(value) <= 512)) {
    throw new ApiContractError('invalid_cursor', 'Cursor fields are invalid', '$.cursor');
  }
  const json = canonicalJson(payload);
  const digest = await sha256Bytes(`audit-page-cursor-v1\n${json}`);
  const envelope = canonicalJson({ payload, checksum: base64url(digest) });
  if (utf8Length(envelope) > AUDIT_API_BOUNDS.cursorBytes) {
    throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor');
  }
  return base64url(encoder.encode(envelope));
}

export async function decodePageCursor(cursor, { scope, kind }) {
  let envelope;
  try { envelope = JSON.parse(decoder.decode(fromBase64url(cursor))); }
  catch { throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor'); }
  let safe;
  try { safe = validateExternalValue(envelope, '$.cursor'); }
  catch { throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor'); }
  if (Object.keys(safe).join('\0') !== 'checksum\0payload') {
    throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor');
  }
  const payload = safe.payload;
  if (!payload || payload.v !== 1 || payload.scope !== scope || payload.kind !== kind || typeof payload.after !== 'string') {
    throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor');
  }
  const expected = await sha256Bytes(`audit-page-cursor-v1\n${canonicalJson(payload)}`);
  const actual = fromBase64url(safe.checksum);
  if (!(await equalBytes(expected, actual))) {
    throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor');
  }
  return freeze({ scope: payload.scope, kind: payload.kind, after: payload.after });
}

export function parsePageLimit(value, { defaultValue = 25, maximum = 100 } = {}) {
  if (value === null || value === undefined || value === '') return defaultValue;
  if (!/^[1-9][0-9]{0,2}$/u.test(value)) {
    throw new ApiContractError('invalid_limit', 'Limit is invalid', '$.limit');
  }
  const limit = Number(value);
  if (limit > maximum) throw new ApiContractError('invalid_limit', 'Limit exceeds the maximum', '$.limit');
  return limit;
}
