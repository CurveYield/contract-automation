import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';

function hashEventBody(body) {
  return createHash('sha256').update(canonicalJson(body)).digest('hex');
}

function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
}

export function appendEvent(stream, input) {
  if (!Array.isArray(stream)) throw new TypeError('stream must be an array');
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) throw new TypeError('schemaVersion must be a positive integer');
  for (const name of ['campaignId', 'commandId', 'type', 'timestamp']) assertNonEmptyString(input[name], name);
  if (!input.actor || typeof input.actor !== 'object') throw new TypeError('actor is required');

  const previous = stream.at(-1) ?? null;
  const body = {
    schemaVersion: input.schemaVersion,
    campaignId: input.campaignId,
    sequence: previous ? previous.sequence + 1 : 1,
    commandId: input.commandId,
    type: input.type,
    actor: structuredClone(input.actor),
    timestamp: input.timestamp,
    previousHash: previous?.eventHash ?? null,
    payload: structuredClone(input.payload ?? {}),
  };
  return Object.freeze({ ...body, eventHash: hashEventBody(body) });
}

export function verifyEventChain(events) {
  if (!Array.isArray(events)) return { valid: false, error: 'events must be an array' };
  let previousHash = null;
  let expectedSequence = 1;
  for (const event of events) {
    if (event.sequence !== expectedSequence) return { valid: false, error: `sequence mismatch at ${expectedSequence}` };
    if (event.previousHash !== previousHash) return { valid: false, error: `previous hash mismatch at sequence ${expectedSequence}` };
    const { eventHash, ...body } = event;
    if (eventHash !== hashEventBody(body)) return { valid: false, error: `event hash mismatch at sequence ${expectedSequence}` };
    previousHash = eventHash;
    expectedSequence += 1;
  }
  return { valid: true, error: null };
}
