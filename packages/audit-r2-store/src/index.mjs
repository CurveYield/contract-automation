import { isProxy } from 'node:util/types';

export const R2_BILLING_CLASS = Object.freeze({
  CLASS_A: 'class-a',
  CLASS_B: 'class-b',
  FREE: 'free'
});

const CLASS_A = new Set([
  'put', 'copy', 'list', 'createMultipartUpload', 'uploadPart',
  'uploadPartCopy', 'completeMultipartUpload', 'listMultipartUploads', 'listParts'
]);
const CLASS_B = new Set(['get', 'head', 'usageSummary']);
const FREE = new Set(['delete', 'abortMultipartUpload']);
const CONTROL = /[\u0000-\u001f\u007f]/;
const ETAG = /^[0-9a-f]{64}$/;

export function classifyR2Operation(method) {
  if (CLASS_A.has(method)) return R2_BILLING_CLASS.CLASS_A;
  if (CLASS_B.has(method)) return R2_BILLING_CLASS.CLASS_B;
  if (FREE.has(method)) return R2_BILLING_CLASS.FREE;
  throw new TypeError(`Unsupported R2 operation: ${method}`);
}

export class ConditionalWriteError extends Error {
  constructor(message = 'R2 write precondition failed') {
    super(String(message).slice(0, 240));
    this.name = 'ConditionalWriteError';
    this.code = 'precondition_failed';
  }
}

export class AuditStoreValidationError extends TypeError {
  constructor(code, message) {
    super(String(message).slice(0, 240));
    this.name = 'AuditStoreValidationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new AuditStoreValidationError(code, message);
}

function ordinaryObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) {
    fail('invalid_options', `${path} must be a plain object`);
  }
  let prototype;
  let keys;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail('hostile_reflection', `${path} could not be inspected`);
  }
  if (prototype !== Object.prototype && prototype !== null) fail('invalid_options', `${path} must be a plain object`);
  for (const key of keys) {
    if (typeof key === 'symbol') fail('symbol_property', `${path} cannot contain symbol properties`);
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('accessor_property', `${path}.${key} must be a data property`);
    if (!descriptor.enumerable) fail('hidden_property', `${path}.${key} must be enumerable`);
  }
  return { keys, descriptors };
}

function safeKey(value) {
  if (
    typeof value !== 'string' || value.length < 1 || value.length > 1024 || CONTROL.test(value) ||
    value.startsWith('/') || value.includes('\\') || value.includes('//') || value.split('/').includes('..')
  ) fail('invalid_key', 'R2 key must be a safe bounded relative key');
  return value;
}

function validateEtag(value, field, allowStar = false) {
  if (allowStar && value === '*') return value;
  if (typeof value !== 'string' || !ETAG.test(value)) fail('invalid_precondition', `${field} must be a lowercase SHA-256 ETag${allowStar ? ' or *' : ''}`);
  return value;
}

function validateOptions(value) {
  if (value === undefined) return {};
  const inspected = ordinaryObject(value, '$.options');
  for (const key of inspected.keys) if (key !== 'onlyIf') fail('unknown_option', `$.options.${key} is not allowed`);
  if (!inspected.descriptors.onlyIf) return {};
  const onlyIf = inspected.descriptors.onlyIf.value;
  const conditionInspection = ordinaryObject(onlyIf, '$.options.onlyIf');
  const condition = {};
  for (const key of conditionInspection.keys) {
    if (!['etagMatches', 'etagDoesNotMatch'].includes(key)) fail('unknown_option', `$.options.onlyIf.${key} is not allowed`);
    condition[key] = conditionInspection.descriptors[key].value;
  }
  if (condition.etagMatches !== undefined && condition.etagDoesNotMatch !== undefined) {
    fail('invalid_precondition', 'etagMatches and etagDoesNotMatch are mutually exclusive');
  }
  if (condition.etagMatches !== undefined) validateEtag(condition.etagMatches, 'etagMatches');
  if (condition.etagDoesNotMatch !== undefined) validateEtag(condition.etagDoesNotMatch, 'etagDoesNotMatch', true);
  return Object.freeze({ onlyIf: Object.freeze(condition) });
}

function toBytes(value) {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  throw new TypeError('Audit store values must be strings or byte arrays');
}

async function etagFor(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicObject(key, record, includeValue = false) {
  if (!record) return null;
  return Object.freeze({
    key,
    etag: record.etag,
    size: record.bytes.byteLength,
    ...(includeValue ? { value: record.text ?? new Uint8Array(record.bytes) } : {})
  });
}

export class InMemoryAuditStore {
  #objects = new Map();
  #usage = { classA: 0, classB: 0, free: 0 };

  async put(key, value, options = undefined) {
    this.#usage.classA += 1;
    const checkedKey = safeKey(key);
    const checkedOptions = validateOptions(options);
    const previous = this.#objects.get(checkedKey);
    const condition = checkedOptions.onlyIf ?? {};
    if (condition.etagMatches !== undefined && previous?.etag !== condition.etagMatches) {
      throw new ConditionalWriteError();
    }
    if (condition.etagDoesNotMatch === '*' && previous) {
      throw new ConditionalWriteError();
    }
    if (condition.etagDoesNotMatch !== undefined && condition.etagDoesNotMatch !== '*' && previous?.etag === condition.etagDoesNotMatch) {
      throw new ConditionalWriteError();
    }
    const bytes = toBytes(value);
    const record = {
      bytes,
      text: typeof value === 'string' ? value : undefined,
      etag: await etagFor(bytes)
    };
    this.#objects.set(checkedKey, record);
    return publicObject(checkedKey, record);
  }

  async get(key) {
    this.#usage.classB += 1;
    const checkedKey = safeKey(key);
    return publicObject(checkedKey, this.#objects.get(checkedKey), true);
  }

  async head(key) {
    this.#usage.classB += 1;
    const checkedKey = safeKey(key);
    return publicObject(checkedKey, this.#objects.get(checkedKey));
  }

  async delete(key) {
    this.#usage.free += 1;
    this.#objects.delete(safeKey(key));
  }

  usage() {
    let storedBytes = 0;
    for (const record of this.#objects.values()) storedBytes += record.bytes.byteLength;
    return Object.freeze({ ...this.#usage, storedBytes });
  }
}
