export const MAX_TEXT = 240;
export const MAX_LONG_TEXT = 2000;
export const MAX_COLLECTION = 100;
export const MAX_REPORT_COLLECTION = 1000;
const SECRET_QUERY_KEYS = new Set(['token', 'key', 'api_key', 'apikey', 'auth', 'authorization', 'signature', 'secret', 'password']);

function primitiveString(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean' ? String(value) : '';
}

export function safeDescriptors(value) {
  try { return Object.getOwnPropertyDescriptors(value); } catch { return null; }
}

export function safeArrayIsArray(value) {
  try { return Array.isArray(value); } catch { return false; }
}

export function toSafeText(value, max = MAX_TEXT) {
  const normalized = primitiveString(value).normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[<>]/g, '').trim();
  return normalized.slice(0, Math.max(0, Math.min(Number(max) || 0, MAX_LONG_TEXT)));
}

export function redactDiagnosticText(value, max = MAX_LONG_TEXT) {
  return toSafeText(value, max)
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[redacted-secret]')
    .replace(/\bhttps?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replace(/\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]+/g, '[redacted-path]')
    .replace(/\/(?:root|home|Users|var|tmp|opt|srv|workspace|mnt)\/[^\s)]+/g, '[redacted-path]')
    .replace(/\bat\s+[A-Za-z_$][\w$.-]*(?:\s*\([^)]*\)|\s+[^\s]+)?/g, '[redacted-stack]')
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi, '[redacted-secret]')
    .replace(/\b(?:api[_-]?key|x[-_]?access[-_]?token|token|secret|password|authorization|cookie|signature)\s*[:=]\s*[^\s,;]+/gi, '[redacted-secret]');
}

export function toSafeIdentifier(value) { return toSafeText(value, 160).replace(/\s+/g, '-'); }

export function toBoundedInteger(value, { min = 0, max = 1_000_000_000, fallback = 0 } = {}) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback;
}

export function toSafeUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  const candidate = value.trim();
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) {
    try {
      const url = new URL(candidate, 'https://audit.invalid');
      if (url.hash) return null;
      for (const key of url.searchParams.keys()) if (SECRET_QUERY_KEYS.has(key.toLowerCase())) return null;
      return `${url.pathname}${url.search}`;
    } catch { return null; }
  }
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.hash || url.username || url.password) return null;
    for (const key of url.searchParams.keys()) if (SECRET_QUERY_KEYS.has(key.toLowerCase())) return null;
    return url.href;
  } catch { return null; }
}

export function denseDataValues(value, limit = MAX_COLLECTION) {
  if (!safeArrayIsArray(value)) return [];
  const descriptors = safeDescriptors(value);
  if (!descriptors) return [];
  const values = [];
  const keys = Object.keys(descriptors).filter((key) => /^(?:0|[1-9]\d*)$/.test(key)).map(Number).sort((a, b) => a - b);
  for (const index of keys) {
    const descriptor = descriptors[String(index)];
    if (descriptor?.enumerable && Object.hasOwn(descriptor, 'value')) values.push(descriptor.value);
    if (values.length >= limit) break;
  }
  return values;
}

export function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  try { if (seen.has(value)) return value; seen.add(value); } catch { return value; }
  const descriptors = safeDescriptors(value);
  if (!descriptors) return value;
  for (const descriptor of Object.values(descriptors)) if (Object.hasOwn(descriptor, 'value')) deepFreeze(descriptor.value, seen);
  try { return Object.freeze(value); } catch { return value; }
}

export function dateText(value) {
  const text = toSafeText(value, 80);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text : null;
}

export function statusText(value, fallback = 'unknown') {
  const text = toSafeText(value, 64).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return text || fallback;
}
