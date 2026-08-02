export class ReleaseIntegrationError extends Error {
  constructor(code, path, message = code) {
    super(String(message).slice(0, 320));
    this.name = 'ReleaseIntegrationError';
    this.code = code;
    this.path = path;
  }
}

export const fail = (code, path, message) => {
  throw new ReleaseIntegrationError(code, path, message);
};

const CONTROL = /[\u0000-\u001f\u007f]/;
const SHA40 = /^[0-9a-f]{40}$/;
const VERSION = /^(?:v[1-9][0-9]*|[0-9]+\.[0-9]+\.[0-9]+|[a-z0-9]+(?:[._-][a-z0-9]+)*-v[1-9][0-9]*)$/;
const IDENTIFIER = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const EXPORT_NAME = /^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/;
const UNION_FIELD = /^[A-Za-z_$][A-Za-z0-9_$]*(?:(?:\.[A-Za-z_$][A-Za-z0-9_$]*)|(?:\[[A-Za-z0-9_$-]+\]))*$/;

function inspect(value, path) {
  try {
    return {
      prototype: Object.getPrototypeOf(value),
      keys: Reflect.ownKeys(value),
      descriptors: new Map(Object.entries(Object.getOwnPropertyDescriptors(value)))
    };
  } catch {
    fail('hostile_reflection', path);
  }
}

function childPath(path, key) {
  return typeof key === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(key)
    ? `${path}.${key}`
    : `${path}.[field]`;
}

export function canonical(value, path = '$', seen = new WeakSet(), depth = 0) {
  if (depth > 32) fail('graph_too_deep', path);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > 2_000_000 || CONTROL.test(value)) fail('invalid_string', path);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('invalid_number', path);
    return value;
  }
  if (typeof value !== 'object') fail('invalid_type', path);
  if (seen.has(value)) fail('cyclic_value', path);
  seen.add(value);
  const { prototype, keys, descriptors } = inspect(value, path);
  for (const key of keys) if (typeof key === 'symbol') fail('symbol_field', path);
  let result;
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail('invalid_array', path);
    const lengthDescriptor = descriptors.get('length');
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 100_000) fail('invalid_array', path);
    result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors.get(String(index));
      if (!descriptor) fail('sparse_array', `${path}[${index}]`);
      if (!Object.hasOwn(descriptor, 'value')) fail('accessor_field', `${path}[${index}]`);
      if (descriptor.enumerable !== true) fail('hidden_field', `${path}[${index}]`);
      result[index] = canonical(descriptor.value, `${path}[${index}]`, seen, depth + 1);
    }
    for (const key of keys) {
      if (key !== 'length' && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) {
        fail('array_property', path);
      }
    }
  } else {
    if (prototype !== Object.prototype && prototype !== null) fail('invalid_object', path);
    result = {};
    for (const key of keys.map(String).sort()) {
      const descriptor = descriptors.get(key);
      const nextPath = childPath(path, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('accessor_field', nextPath);
      if (descriptor.enumerable !== true) fail('hidden_field', nextPath);
      Object.defineProperty(result, key, {
        value: canonical(descriptor.value, nextPath, seen, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
  }
  seen.delete(value);
  return result;
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function frozen(value) { return deepFreeze(canonical(value)); }

export function exact(value, expected, path = '$') {
  const safe = canonical(value, path);
  if (safe === null || typeof safe !== 'object' || Array.isArray(safe)) fail('invalid_object', path);
  const actual = Object.keys(safe).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    const extra = actual.find((key) => !wanted.includes(key));
    const missing = wanted.find((key) => !actual.includes(key));
    fail(extra ? 'unknown_field' : 'missing_field', childPath(path, extra ?? missing));
  }
  return safe;
}

export function text(value, path, maximum = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || CONTROL.test(value)) fail('invalid_string', path);
  return value;
}

export function identifier(value, path) {
  const checked = text(value, path, 96);
  if (!IDENTIFIER.test(checked) || checked.includes('..') || checked === 'latest') fail('invalid_identifier', path);
  return checked;
}

export function exportName(value, path) {
  const checked = text(value, path, 128);
  if (!EXPORT_NAME.test(checked)) fail('invalid_export_name', path);
  return checked;
}

export function unionField(value, path) {
  const checked = text(value, path, 240);
  if (!UNION_FIELD.test(checked) || checked.includes('..')) fail('invalid_union_field', path);
  return checked;
}

export function pathValue(value, path) {
  const checked = text(value, path, 512).replaceAll('\\', '/');
  const segments = checked.split('/');
  if (
    checked.startsWith('/') || checked.includes('//') || segments.includes('..') || segments.includes('.') ||
    !/^[A-Za-z0-9_.@+\/-]+$/.test(checked)
  ) fail('unsafe_path', path);
  return checked;
}

export function sha40(value, path) {
  if (typeof value !== 'string' || !SHA40.test(value)) fail('invalid_sha', path);
  return value;
}
export function optionalSha40(value, path) { return value === null ? null : sha40(value, path); }
export function version(value, path) {
  const checked = text(value, path, 120);
  if (!VERSION.test(checked)) fail('invalid_version', path);
  return checked;
}
export function positiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) fail('invalid_integer', path);
  return value;
}
export function ordinaryArray(value, path, maximum = 10_000) {
  const safe = canonical(value, path);
  if (!Array.isArray(safe) || safe.length > maximum) fail('invalid_array', path);
  return safe;
}
export function sortedUnique(value, path, maximum, validator) {
  const result = ordinaryArray(value, path, maximum).map((entry, index) => validator(entry, `${path}[${index}]`)).sort();
  if (new Set(result).size !== result.length) fail('duplicate_value', path);
  return result;
}
export function canonicalJson(value) { return JSON.stringify(canonical(value)); }
