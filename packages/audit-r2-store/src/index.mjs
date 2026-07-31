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

export function classifyR2Operation(method) {
  if (CLASS_A.has(method)) return R2_BILLING_CLASS.CLASS_A;
  if (CLASS_B.has(method)) return R2_BILLING_CLASS.CLASS_B;
  if (FREE.has(method)) return R2_BILLING_CLASS.FREE;
  throw new TypeError(`Unsupported R2 operation: ${method}`);
}

export class ConditionalWriteError extends Error {
  constructor(message = 'R2 write precondition failed') {
    super(message);
    this.name = 'ConditionalWriteError';
    this.code = 'precondition_failed';
  }
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

  async put(key, value, options = {}) {
    this.#usage.classA += 1;
    if (typeof key !== 'string' || key.length < 1) throw new TypeError('R2 key is required');
    const previous = this.#objects.get(key);
    const condition = options.onlyIf ?? {};
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
    this.#objects.set(key, record);
    return publicObject(key, record);
  }

  async get(key) {
    this.#usage.classB += 1;
    return publicObject(key, this.#objects.get(key), true);
  }

  async head(key) {
    this.#usage.classB += 1;
    return publicObject(key, this.#objects.get(key));
  }

  async delete(key) {
    this.#usage.free += 1;
    this.#objects.delete(key);
  }

  usage() {
    let storedBytes = 0;
    for (const record of this.#objects.values()) storedBytes += record.bytes.byteLength;
    return Object.freeze({ ...this.#usage, storedBytes });
  }
}
