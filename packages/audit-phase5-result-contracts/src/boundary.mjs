import { isProxy } from 'node:util/types';
import { fail } from './errors.mjs';
import { MAX_RECORDS, MAX_STRING } from './contracts.mjs';

function safeOwnKeys(value, path, invalidCode) {
  try {
    return Reflect.ownKeys(value);
  } catch {
    fail(invalidCode, path, `${path} cannot be inspected`);
  }
}

function safePrototype(value, path, invalidCode) {
  try {
    return Object.getPrototypeOf(value);
  } catch {
    fail(invalidCode, path, `${path} has an invalid prototype`);
  }
}

function descriptor(value, key, path) {
  let result;
  try {
    result = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    fail('invalid_object', path, `${path} cannot be inspected`);
  }
  if (!result || !Object.hasOwn(result, 'value')) {
    fail('accessor_not_allowed', path, `${path} must be a data property`);
  }
  return result;
}

export function plainObject(value, path = '$') {
  if (value !== null && typeof value === 'object' && isProxy(value)) fail('invalid_object', path, `${path} cannot be a proxy`);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid_object', path, `${path} must be a plain object`);
  }
  const prototype = safePrototype(value, path, 'invalid_object');
  if (prototype !== Object.prototype && prototype !== null) {
    fail('invalid_object', path, `${path} must be a plain object`);
  }
  for (const key of safeOwnKeys(value, path, 'invalid_object')) {
    if (typeof key !== 'string') fail('invalid_keys', path, `${path} cannot contain symbol keys`);
    descriptor(value, key, `${path}.${key}`);
  }
  return value;
}

export function ordinaryArray(value, path, maximum = MAX_RECORDS) {
  if (value !== null && typeof value === 'object' && isProxy(value)) fail('invalid_array', path, `${path} cannot be a proxy`);
  if (!Array.isArray(value)) fail('invalid_array', path, `${path} must be an array`);
  const prototype = safePrototype(value, path, 'invalid_array');
  if (prototype !== Array.prototype) fail('invalid_array', path, `${path} must use Array.prototype`);
  if (!Number.isSafeInteger(value.length) || value.length < 0 || value.length > maximum) {
    fail('invalid_array', path, `${path} has an invalid length`);
  }
  const keys = safeOwnKeys(value, path, 'invalid_array');
  for (const key of keys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(key)) {
      fail('invalid_array', path, `${path} has an invalid property`);
    }
    descriptor(value, key, `${path}[${key}]`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) fail('invalid_array', `${path}[${index}]`, `${path} cannot contain holes`);
  }
  return value;
}

export function ownValue(value, key, path) {
  return descriptor(value, key, path).value;
}

export function exactKeys(value, expected, path = '$') {
  const keys = safeOwnKeys(value, path, 'invalid_object');
  if (keys.some((key) => typeof key !== 'string')) fail('invalid_keys', path, `${path} has invalid keys`);
  const actual = keys.map(String).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length) fail('invalid_keys', path, `${path} has invalid keys`);
  for (let index = 0; index < wanted.length; index += 1) {
    if (actual[index] !== wanted[index]) fail('invalid_keys', path, `${path} has invalid keys`);
  }
  for (const key of wanted) descriptor(value, key, `${path}.${key}`);
  return value;
}

export function boundedString(value, path, maximum = MAX_STRING, allowEmpty = true) {
  if (
    typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0) ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) fail('invalid_string', path, `${path} is invalid`);
  return value;
}

export function nullableString(value, path, maximum = MAX_STRING, allowEmpty = true) {
  if (value === null) return null;
  return boundedString(value, path, maximum, allowEmpty);
}

export function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) {
    fail('invalid_integer', path, `${path} is invalid`);
  }
  return value;
}

export function finiteNumber(value, path, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) || value < minimum || value > maximum) {
    fail('invalid_number', path, `${path} is invalid`);
  }
  return value;
}

export function safeRelativePath(value, path) {
  boundedString(value, path, 512, false);
  if (
    value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.includes('\\') ||
    value.split('/').includes('..') || value.includes('//') ||
    !/^[A-Za-z0-9_.@+\/-]+$/.test(value)
  ) fail('unsafe_path', path, `${path} is unsafe`);
  return value;
}

export function emptyObject(value, path) {
  plainObject(value, path);
  exactKeys(value, [], path);
  return value;
}

export function deepFrozenClone(value, path = '$') {
  if (Array.isArray(value)) {
    ordinaryArray(value, path);
    const cloned = value.map((item, index) => deepFrozenClone(item, `${path}[${index}]`));
    return Object.freeze(cloned);
  }
  if (value !== null && typeof value === 'object') {
    plainObject(value, path);
    const cloned = {};
    for (const key of Reflect.ownKeys(value)) {
      cloned[key] = deepFrozenClone(ownValue(value, key, `${path}.${key}`), `${path}.${key}`);
    }
    return Object.freeze(cloned);
  }
  return value;
}

export function assertOrdinaryTree(value, path = '$') {
  if (Array.isArray(value)) {
    ordinaryArray(value, path);
    value.forEach((item, index) => assertOrdinaryTree(item, `${path}[${index}]`));
    return value;
  }
  if (value !== null && typeof value === 'object') {
    plainObject(value, path);
    for (const key of Reflect.ownKeys(value)) {
      assertOrdinaryTree(ownValue(value, key, `${path}.${key}`), `${path}.${key}`);
    }
  }
  return value;
}
