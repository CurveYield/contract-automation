import { ValidationError } from '../../audit-protocol/src/index.mjs';
import { PARSER_LIMITS } from '../../audit-tool-parsers/src/index.mjs';

export function fail(code, message, path = '$') {
  throw new ValidationError(code, message, path);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function plainObject(value, path) {
  if (!isPlainObject(value)) fail('invalid_type', `${path} must be a plain object`, path);
  return value;
}

export function exactKeys(value, keys, path) {
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) fail('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail('missing_field', `${path}.${key} is required`, `${path}.${key}`);
  }
}

export function stringValue(value, path, maximum) {
  if (typeof value !== 'string') fail('invalid_string', `${path} must be a string`, path);
  if (value.length > maximum) fail('string_too_long', `${path} exceeds ${maximum} characters`, path);
  return value;
}

export function enumValue(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.has(value)) fail('invalid_enum', `${path} is not allowlisted`, path);
  return value;
}

export function integer(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail('invalid_integer', `${path} must be an integer from ${minimum} to ${maximum}`, path);
  }
  return value;
}

export function numberValue(value, path, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail('invalid_number', `${path} must be a finite number from ${minimum} to ${maximum}`, path);
  }
  return value;
}

export function booleanValue(value, path) {
  if (typeof value !== 'boolean') fail('invalid_boolean', `${path} must be a boolean`, path);
  return value;
}

export function arrayValue(value, path, maximum) {
  if (!Array.isArray(value)) fail('invalid_array', `${path} must be an array`, path);
  if (Object.getPrototypeOf(value) !== Array.prototype) fail('invalid_type', `${path} must use the standard array prototype`, path);
  if (value.length > maximum) fail('collection_too_large', `${path} exceeds ${maximum} entries`, path);
  return value;
}

export function safePath(value, path) {
  const result = stringValue(value, path, 1024);
  if (/[\u0000-\u001f\u007f]/.test(result)) fail('unsafe_path', `${path} must be a safe repository-relative path`, path);
  if (result.includes('\\') || result.startsWith('/') || result.startsWith('//') || /^[A-Za-z]:[\\/]/.test(result)) {
    fail('unsafe_path', `${path} must be a safe repository-relative path`, path);
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(result) || result.includes('://')) {
    fail('unsafe_path', `${path} must be a safe repository-relative path`, path);
  }
  if (result.split('/').some((segment) => segment === '.' || segment === '..')) {
    fail('unsafe_path', `${path} must be a safe repository-relative path`, path);
  }
  return result;
}

export function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function boundedJson(value, path, depth = 0) {
  if (depth > PARSER_LIMITS.nestingDepth) fail('data_too_deep', `${path} exceeds the nesting bound`, path);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return stringValue(value, path, PARSER_LIMITS.stringLength);
  if (typeof value === 'number') return numberValue(value, path, -PARSER_LIMITS.numericValue, PARSER_LIMITS.numericValue);
  if (Array.isArray(value)) {
    arrayValue(value, path, PARSER_LIMITS.objectFields);
    return value.map((item, index) => boundedJson(item, `${path}[${index}]`, depth + 1));
  }
  plainObject(value, path);
  const entries = Object.entries(value);
  if (entries.length > PARSER_LIMITS.objectFields) fail('object_too_large', `${path} exceeds the object-field bound`, path);
  const result = {};
  for (const [key, child] of entries) {
    stringValue(key, `${path}.*`, 160);
    Object.defineProperty(result, key, {
      value: boundedJson(child, `${path}.*`, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  return result;
}

export function encodedByteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
