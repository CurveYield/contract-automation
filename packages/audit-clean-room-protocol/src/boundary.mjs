import { createHash } from 'node:crypto';

export const LIMITS = Object.freeze({
  string: 512,
  id: 96,
  array: 10_000,
  depth: 32,
  bytes: 20_000_000
});

export function fail(code, path, message = code) {
  const error = new Error(message);
  error.code = code;
  error.path = path;
  throw error;
}

function descriptors(value, path) {
  let result;
  try { result = Object.getOwnPropertyDescriptors(value); }
  catch { fail('hostile_reflection', path, 'Object boundary could not be inspected'); }
  let symbols;
  try { symbols = Object.getOwnPropertySymbols(value); }
  catch { fail('hostile_reflection', path, 'Object boundary could not be inspected'); }
  if (symbols.length) fail('symbol_field', path, 'Symbol fields are forbidden');
  return result;
}

function guardedIsArray(value, path) {
  try { return Array.isArray(value); }
  catch { fail('hostile_reflection', path, 'Object boundary could not be inspected'); }
}

export function plainObject(value, path = '$') {
  if (value === null || typeof value !== 'object' || guardedIsArray(value, path)) fail('invalid_object', path, 'Expected object');
  let prototype;
  try { prototype = Object.getPrototypeOf(value); }
  catch { fail('hostile_reflection', path, 'Object boundary could not be inspected'); }
  if (prototype !== Object.prototype && prototype !== null) fail('invalid_prototype', path, 'Custom prototypes are forbidden');
  const desc = descriptors(value, path);
  for (const [key, item] of Object.entries(desc)) {
    if (!Object.hasOwn(item, 'value')) fail('accessor_field', `${path}.${key}`, 'Accessors are forbidden');
  }
  return { value, desc };
}

export function denseArray(value, path = '$', maximum = LIMITS.array) {
  if (!guardedIsArray(value, path)) fail('invalid_array', path, 'Expected ordinary array');
  let prototype;
  try { prototype = Object.getPrototypeOf(value); }
  catch { fail('hostile_reflection', path, 'Array boundary could not be inspected'); }
  if (prototype !== Array.prototype) fail('invalid_array', path, 'Expected ordinary array');
  if (value.length > maximum) fail('collection_too_large', path, 'Collection exceeds limit');
  for (let i = 0; i < value.length; i += 1) if (!Object.hasOwn(value, i)) fail('sparse_array', `${path}[${i}]`, 'Sparse arrays are forbidden');
  if (Object.keys(value).some((key) => !/^\d+$/.test(key))) fail('array_property', path, 'Array properties are forbidden');
  return value;
}

export function exactKeys(value, keys, path = '$') {
  const { desc } = plainObject(value, path);
  const actual = Object.keys(desc).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const extra = actual.find((key) => !expected.includes(key));
    const missing = expected.find((key) => !actual.includes(key));
    fail(extra ? 'unknown_field' : 'missing_field', extra ? `${path}.${extra}` : `${path}.${missing}`, 'Object fields do not match schema');
  }
  return Object.fromEntries(Object.entries(desc).map(([key, item]) => [key, item.value]));
}

export function boundedString(value, path, maximum = LIMITS.string, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0)) fail('invalid_string', path, 'Invalid bounded string');
  if (/[\u0000-\u001f\u007f]/.test(value)) fail('control_character', path, 'Control characters are forbidden');
  return value;
}

export function identifier(value, path) {
  const result = boundedString(value, path, LIMITS.id);
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(result) || result.includes('..') || result === 'latest') fail('invalid_identifier', path, 'Invalid identifier');
  return result;
}

export function safePath(value, path) {
  const result = boundedString(value, path, 512).replaceAll('\\', '/');
  if (result.startsWith('/') || /^[A-Za-z]:\//.test(result) || result.includes('//') || result.split('/').includes('..') || !/^[A-Za-z0-9_.@+\/-]+$/.test(result)) fail('unsafe_path', path, 'Unsafe path');
  return result;
}

export function digest(value, path) {
  const result = boundedString(value, path, 71);
  if (!/^sha256:[0-9a-f]{64}$/.test(result)) fail('invalid_digest', path, 'Invalid digest');
  return result;
}

export function timestamp(value, path) {
  const result = boundedString(value, path, 32);
  const date = new Date(result);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== result) fail('invalid_timestamp', path, 'Timestamp must be canonical ISO');
  return result;
}

export function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) fail('invalid_integer', path, 'Invalid safe integer');
  return value;
}

export function boolean(value, path) {
  if (typeof value !== 'boolean') fail('invalid_boolean', path, 'Expected boolean');
  return value;
}

export function enumValue(value, allowed, path) {
  const result = boundedString(value, path, 64);
  if (!allowed.includes(result)) fail('invalid_enum', path, 'Unsupported enum value');
  return result;
}

export function nullable(value, validator, path) {
  return value === null ? null : validator(value, path);
}

export function stringArray(value, path, options = {}) {
  const max = options.maximum ?? 256;
  const item = options.item ?? identifier;
  const sorted = options.sorted ?? true;
  const result = denseArray(value, path, max).map((entry, index) => item(entry, `${path}[${index}]`));
  if (new Set(result).size !== result.length) fail('duplicate_identity', path, 'Duplicate values are forbidden');
  if (sorted) result.sort();
  return result;
}

function canonical(value, path, seen, depth) {
  if (depth > LIMITS.depth) fail('nesting_too_deep', path, 'Object nesting exceeds limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('invalid_number', path, 'Only safe integers are canonical');
    return value;
  }
  if (typeof value !== 'object') fail('invalid_value', path, 'Unsupported value');
  if (seen.has(value)) fail('cycle', path, 'Cycles are forbidden');
  seen.add(value);
  let output;
  if (guardedIsArray(value, path)) {
    denseArray(value, path);
    output = value.map((entry, index) => canonical(entry, `${path}[${index}]`, seen, depth + 1));
  } else {
    const { desc } = plainObject(value, path);
    output = {};
    for (const key of Object.keys(desc).sort()) output[key] = canonical(desc[key].value, `${path}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
  return output;
}

export function canonicalClone(value) {
  return canonical(value, '$', new WeakSet(), 0);
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalClone(value));
}

export function sha256(value) {
  return `sha256:${createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex')}`;
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function frozenClone(value) {
  return deepFreeze(canonicalClone(value));
}

export function withIdentity(prefix, body) {
  const bodyDigest = sha256(body);
  return deepFreeze({ ...canonicalClone(body), id: `${prefix}-${bodyDigest.slice(7, 31)}`, digest: bodyDigest });
}
