import { canonicalJson, sha256Hex } from '../../audit-fork-protocol/src/index.mjs';

const DECODER = new TextDecoder();

function classifyR2Operation(method) {
  if (method === 'put') return 'class-a';
  if (method === 'get' || method === 'head') return 'class-b';
  if (method === 'delete') return 'free';
  throw new TypeError(`Unsupported R2 operation: ${method}`);
}

export class ForkStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForkStateError';
    this.code = code;
  }
}

export function parseRecord(record) {
  if (!record) return null;
  return JSON.parse(typeof record.value === 'string' ? record.value : DECODER.decode(record.value));
}

export function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  throw new ForkStateError('invalid_checkpoint_bytes', 'Checkpoint bytes must be a byte array');
}

export function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function eventId(version, transitionId) {
  return `evt_${String(version).padStart(12, '0')}_${transitionId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function traceEntry(method, key) {
  return Object.freeze({ method, key, billingClass: classifyR2Operation(method) });
}

export class ForkStorage {
  #store;
  #trace = [];

  constructor(store) {
    if (!store || typeof store.put !== 'function' || typeof store.get !== 'function' || typeof store.head !== 'function' || typeof store.delete !== 'function') {
      throw new TypeError('ForkService requires the accepted audit store interface');
    }
    this.#store = store;
  }

  operationTrace() {
    return Object.freeze(this.#trace.map((entry) => ({ ...entry })));
  }

  clearOperationTrace() {
    this.#trace = [];
  }

  #record(method, key) {
    this.#trace.push(traceEntry(method, key));
  }

  async get(key) {
    this.#record('get', key);
    return this.#store.get(key);
  }

  async head(key) {
    this.#record('head', key);
    return this.#store.head(key);
  }

  async put(key, value, options) {
    this.#record('put', key);
    return this.#store.put(key, value, options);
  }

  async delete(key) {
    this.#record('delete', key);
    return this.#store.delete(key);
  }

  async putImmutable(key, value) {
    const serialized = value instanceof Uint8Array ? value : canonicalJson(value);
    try {
      return await this.put(key, serialized, { onlyIf: { etagDoesNotMatch: '*' } });
    } catch (cause) {
      if (cause?.code !== 'precondition_failed') throw cause;
      const existing = await this.get(key);
      if (!existing) throw new ForkStateError('immutable_conflict', `Missing existing object at ${key}`);
      if (value instanceof Uint8Array) {
        const existingBytes = existing.value instanceof Uint8Array ? existing.value : new TextEncoder().encode(existing.value);
        if (existingBytes.byteLength !== value.byteLength || await sha256Hex(existingBytes) !== await sha256Hex(value)) {
          throw new ForkStateError('immutable_conflict', `Conflicting immutable object at ${key}`);
        }
      } else if (!sameJson(parseRecord(existing), value)) {
        throw new ForkStateError('immutable_conflict', `Conflicting immutable object at ${key}`);
      }
      return this.head(key);
    }
  }

  async mergeIndex(key, initial, identity, entry, sorter) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const record = await this.get(key);
      const index = record ? parseRecord(record) : structuredClone(initial);
      const current = index.entries.find((item) => identity(item) === identity(entry));
      if (current) {
        if (!sameJson(current, entry)) throw new ForkStateError('index_conflict', `Conflicting index entry at ${key}`);
        return index;
      }
      index.entries.push(structuredClone(entry));
      index.entries.sort(sorter);
      index.updatedAt = entry.updatedAt ?? entry.createdAt;
      try {
        await this.put(
          key,
          canonicalJson(index),
          record ? { onlyIf: { etagMatches: record.etag } } : { onlyIf: { etagDoesNotMatch: '*' } }
        );
        return index;
      } catch (cause) {
        if (cause?.code !== 'precondition_failed') throw cause;
      }
    }
    throw new ForkStateError('index_conflict', `Unable to update index ${key}`);
  }

  async readIndex(key, initial) {
    const record = await this.get(key);
    return record ? { record, index: parseRecord(record) } : { record: null, index: structuredClone(initial) };
  }
}
