import { ValidationError } from '../../audit-protocol/src/index.mjs';
import {
  MAX_FINDINGS,
  MAX_NESTING_DEPTH,
  MAX_NUMERIC_VALUE,
  MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES,
  MAX_TRACE_ENTRIES,
  PARSER_LIMITS,
  PARSER_VERSIONS,
  TOOL_RESULT_SCHEMA_VERSION
} from '../../audit-tool-parsers/src/index.mjs';

const MAX_STRING_LENGTH = PARSER_LIMITS.stringLength;
const MAX_OBJECT_FIELDS = PARSER_LIMITS.objectFields;
const MAX_COUNTEREXAMPLE_BYTES = PARSER_LIMITS.counterexampleBytes;
const MAX_DURATION_MS = PARSER_LIMITS.durationMs;
const MAX_PATH_LENGTH = 1_024;
const MAX_NAME_LENGTH = 512;
const MAX_CATEGORY_LENGTH = 160;
const MAX_LINE_NUMBER = 10_000_000;
const MAX_COVERAGE_VALUE = 1_000_000_000;
const MAX_SEED = 4_294_967_295;
const MAX_WARNINGS = 32;
const MAX_SUMMARY_FIELDS = 32;
const TRUNCATION_MESSAGE = 'Normalized entries were truncated at the configured bound.';

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion', 'profileId', 'parserVersion', 'exitClassification', 'terminationReason',
  'durationMs', 'exitCode', 'truncated', 'diagnostics', 'tests', 'counterexamples',
  'invariants', 'findings', 'coverage', 'parserWarnings', 'parserErrors', 'summary'
]);
const CLASSIFICATIONS = Object.freeze(['success', 'tool_failure', 'timeout', 'cancelled', 'resource_exhaustion', 'parser_error']);
const TERMINATIONS = Object.freeze(['completed', 'timeout', 'cancelled', 'resource_exhaustion']);
const encoder = new TextEncoder();

function fail(code, path, message = code) {
  throw new ValidationError(code, message, path);
}
function propertyPath(path, key) {
  if (typeof key !== 'string' || key.length < 1 || key.length > 80 || !/^[A-Za-z0-9_-]+$/.test(key)) return `${path}.*`;
  return `${path}.${key}`;
}
function reflectShape(value, path) {
  try {
    return {
      prototype: Object.getPrototypeOf(value),
      keys: Reflect.ownKeys(value),
      descriptors: Object.getOwnPropertyDescriptors(value)
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    fail('hostile_object', path, `${path} could not be inspected safely`);
  }
}
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}
function sanitizeExternalValue(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) fail('cyclic_value', path, `${path} must be acyclic JSON-like data`);
  seen.add(value);

  const shape = reflectShape(value, path);
  if (Array.isArray(value)) {
    if (shape.prototype !== Array.prototype) fail('invalid_array', path, `${path} must be an ordinary array`);
    const lengthDescriptor = shape.descriptors.length;
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value') || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
      fail('invalid_array', path, `${path} has an invalid length descriptor`);
    }
    const length = lengthDescriptor.value;
    for (const key of shape.keys) {
      if (typeof key === 'symbol') fail('unsupported_property', path, `${path} must not contain symbol properties`);
      if (key === 'length') continue;
      if (!/^(0|[1-9][0-9]*)$/.test(key)) fail('unsupported_property', propertyPath(path, key), 'Unsupported array property');
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index >= length) fail('unsupported_property', propertyPath(path, key), 'Array property is outside the declared length');
    }
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = shape.descriptors[String(index)];
      if (!descriptor) fail('invalid_array', path, `${path} must not contain sparse entries`);
      if (!Object.hasOwn(descriptor, 'value')) fail('accessor_property', `${path}[${index}]`, `${path}[${index}] must be a data property`);
      if (descriptor.enumerable !== true) fail('unsupported_property', `${path}[${index}]`, `${path}[${index}] must be enumerable`);
      result[index] = sanitizeExternalValue(descriptor.value, `${path}[${index}]`, seen);
    }
    seen.delete(value);
    return result;
  }

  if (shape.prototype !== Object.prototype && shape.prototype !== null) {
    fail('invalid_plain_object', path, `${path} must be a plain object`);
  }
  const stringKeys = [];
  for (const key of shape.keys) {
    if (typeof key === 'symbol') fail('unsupported_property', path, `${path} must not contain symbol properties`);
    stringKeys.push(key);
  }
  stringKeys.sort(compareText);
  const result = {};
  for (const key of stringKeys) {
    const descriptor = shape.descriptors[key];
    const childPath = propertyPath(path, key);
    if (!descriptor) fail('hostile_object', childPath, 'Property descriptor is unavailable');
    if (!Object.hasOwn(descriptor, 'value')) fail('accessor_property', childPath, 'Accessor properties are not accepted');
    if (descriptor.enumerable !== true) fail('unsupported_property', childPath, 'Non-enumerable properties are not accepted');
    Object.defineProperty(result, key, {
      value: sanitizeExternalValue(descriptor.value, childPath, seen),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  seen.delete(value);
  return result;
}
function plainObject(value, path) {
  if (!isPlainObject(value)) fail('invalid_plain_object', path, `${path} must be a plain object`);
  return value;
}
function exactKeys(value, keys, path) {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) { const childPath = propertyPath(path, key); fail('unknown_field', childPath, `${childPath} is not allowed`); }
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail('missing_field', `${path}.${key}`, `${path}.${key} is required`);
  }
}
function boundedArray(value, path, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail('invalid_array', path, `${path} must be an ordinary array`);
  if (value.length > maximum) fail('collection_too_large', path, `${path} exceeds ${maximum} entries`);
  return value;
}
function boundedString(value, path, maximum = MAX_STRING_LENGTH) {
  if (typeof value !== 'string') fail('invalid_string', path, `${path} must be a string`);
  if (value.length > maximum) fail('string_too_long', path, `${path} exceeds ${maximum} characters`);
  if (value.includes('\u0000')) fail('noncanonical_string', path, `${path} contains a noncanonical NUL character`);
  return value;
}
function enumValue(value, path, values) {
  boundedString(value, path, 160);
  if (!values.includes(value)) fail('invalid_enum', path, `${path} is not allowlisted`);
  return value;
}
function boundedInteger(value, path, minimum, maximum) {
  if (Object.is(value, -0)) fail('noncanonical_number', path, `${path} must not be negative zero`);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail('invalid_integer', path, `${path} is outside the configured range`);
  return value;
}
function boundedNumber(value, path, minimum, maximum) {
  if (Object.is(value, -0)) fail('noncanonical_number', path, `${path} must not be negative zero`);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) fail('numeric_out_of_range', path, `${path} is outside the configured range`);
  return value;
}
function booleanValue(value, path) {
  if (typeof value !== 'boolean') fail('invalid_boolean', path, `${path} must be a boolean`);
  return value;
}
function nullableInteger(value, path, minimum, maximum) {
  if (value === null) return null;
  return boundedInteger(value, path, minimum, maximum);
}
function nullableString(value, path, maximum = MAX_STRING_LENGTH) {
  if (value === null) return null;
  return boundedString(value, path, maximum);
}
function safePath(value, path) {
  boundedString(value, path, MAX_PATH_LENGTH);
  const segments = value.split('/');
  if (
    value.startsWith('/') || value.startsWith('\\') || value.includes('\\') ||
    /^[A-Za-z]:/.test(value) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ||
    segments.includes('..') || segments.includes('.') || /[\u0000-\u001f\u007f]/.test(value)
  ) fail('unsafe_path', path, `${path} must be a safe repository-relative path`);
  return value;
}
function cloneValue(value) {
  return sanitizeExternalValue(value);
}
function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function compareNumber(left, right) { return left - right; }
function compareTuple(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    const comparison = typeof a === 'number' && typeof b === 'number' ? compareNumber(a, b) : compareText(String(a), String(b));
    if (comparison !== 0) return comparison;
  }
  return 0;
}
function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  const keys = Object.keys(value).sort(compareText);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
}
function assertCanonicalArray(values, path, compare) {
  const seen = new Set();
  let previous = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const serialized = canonicalStringify(value);
    if (seen.has(serialized)) fail('duplicate_entry', `${path}[${index}]`);
    seen.add(serialized);
    if (previous !== null && compare(previous, value) > 0) fail('noncanonical_order', `${path}[${index}]`);
    previous = value;
  }
}
function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function ensureEmpty(value, path) {
  if (value.length !== 0) fail('unexpected_evidence', path, `${path} must be empty for this profile or lifecycle`);
}
function boundedJson(value, path, depth = 0) {
  if (depth > MAX_NESTING_DEPTH) fail('data_too_deep', path, `${path} exceeds the nesting bound`);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { boundedString(value, path); return; }
  if (typeof value === 'number') { boundedNumber(value, path, -MAX_NUMERIC_VALUE, MAX_NUMERIC_VALUE); return; }
  if (Array.isArray(value)) {
    boundedArray(value, path, MAX_OBJECT_FIELDS);
    value.forEach((item, index) => boundedJson(item, `${path}[${index}]`, depth + 1));
    return;
  }
  plainObject(value, path);
  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_FIELDS) fail('object_too_large', path, `${path} exceeds the object field bound`);
  for (const [key, child] of entries) {
    boundedString(key, `${path}.*`, MAX_CATEGORY_LENGTH);
    boundedJson(child, `${path}.*`, depth + 1);
  }
}
function counterexampleValue(value, path) {
  boundedJson(value, path);
  if (encoder.encode(canonicalStringify(value)).byteLength > MAX_COUNTEREXAMPLE_BYTES) fail('data_too_large', path, `${path} exceeds the encoded byte bound`);
}

export {
  MAX_FINDINGS,
  MAX_NESTING_DEPTH,
  MAX_NUMERIC_VALUE,
  MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES,
  MAX_TRACE_ENTRIES,
  PARSER_VERSIONS,
  TOOL_RESULT_SCHEMA_VERSION,
  MAX_STRING_LENGTH,
  MAX_OBJECT_FIELDS,
  MAX_COUNTEREXAMPLE_BYTES,
  MAX_DURATION_MS,
  MAX_PATH_LENGTH,
  MAX_NAME_LENGTH,
  MAX_CATEGORY_LENGTH,
  MAX_LINE_NUMBER,
  MAX_COVERAGE_VALUE,
  MAX_SEED,
  MAX_WARNINGS,
  MAX_SUMMARY_FIELDS,
  TRUNCATION_MESSAGE,
  TOP_LEVEL_KEYS,
  CLASSIFICATIONS,
  TERMINATIONS,
  fail,
  propertyPath,
  isPlainObject,
  sanitizeExternalValue,
  plainObject,
  exactKeys,
  boundedArray,
  boundedString,
  enumValue,
  boundedInteger,
  boundedNumber,
  booleanValue,
  nullableInteger,
  nullableString,
  safePath,
  cloneValue,
  compareText,
  compareNumber,
  compareTuple,
  canonicalStringify,
  assertCanonicalArray,
  deepFreeze,
  ensureEmpty,
  boundedJson,
  counterexampleValue
};
