import { webcrypto } from 'node:crypto';

export class ConditionalWriteError extends Error {
  constructor(message = 'Fork store write precondition failed') {
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
  throw new TypeError('Fork store values must be strings or byte arrays');
}

async function etagFor(bytes) {
  const digest = new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes));
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

  async put(key, value, options = {}) {
    if (typeof key !== 'string' || key.length < 1) throw new TypeError('Fork store key is required');
    const previous = this.#objects.get(key);
    const condition = options.onlyIf ?? {};
    if (condition.etagMatches !== undefined && previous?.etag !== condition.etagMatches) throw new ConditionalWriteError();
    if (condition.etagDoesNotMatch === '*' && previous) throw new ConditionalWriteError();
    if (condition.etagDoesNotMatch !== undefined && condition.etagDoesNotMatch !== '*' && previous?.etag === condition.etagDoesNotMatch) throw new ConditionalWriteError();
    const bytes = toBytes(value);
    const record = { bytes, text: typeof value === 'string' ? value : undefined, etag: await etagFor(bytes) };
    this.#objects.set(key, record);
    return publicObject(key, record);
  }

  async get(key) { return publicObject(key, this.#objects.get(key), true); }
  async head(key) { return publicObject(key, this.#objects.get(key)); }
  async delete(key) { this.#objects.delete(key); }
}
