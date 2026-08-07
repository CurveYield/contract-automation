import { canonicalJson } from '../../protocol/src/canonical-json.mjs';
import { ValidationError } from '../../controller-core/src/errors.mjs';

export const BEGIN_MARKER = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_BEGIN -->';
export const END_MARKER = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_END -->';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function assertSafe(value, path = '$') {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafe(entry, `${path}[${index}]`));
    return;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new ValidationError(`forbidden key ${key} at ${path}`);
    assertSafe(value[key], `${path}.${key}`);
  }
}

function assertCommandShape(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) throw new ValidationError('command envelope must contain an object');
  if (command.schemaVersion !== 1) throw new ValidationError('command envelope requires schemaVersion 1');
  for (const field of ['commandId', 'type']) {
    if (typeof command[field] !== 'string' || command[field].length === 0) throw new ValidationError(`${field} is required`);
  }
  if (!command.actor || typeof command.actor !== 'object') throw new ValidationError('actor is required');
  for (const field of ['type', 'id']) {
    if (typeof command.actor[field] !== 'string' || command.actor[field].length === 0) throw new ValidationError(`actor.${field} is required`);
  }
  if (!command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) throw new ValidationError('payload must be an object');
}

function countOccurrences(text, marker) {
  let count = 0;
  let from = 0;
  while (true) {
    const index = text.indexOf(marker, from);
    if (index === -1) return count;
    count += 1;
    from = index + marker.length;
  }
}

export function renderEnvelope(command) {
  assertSafe(command);
  assertCommandShape(command);
  return `${BEGIN_MARKER}\n${canonicalJson(command)}\n${END_MARKER}`;
}

export function parseEnvelope(markdown) {
  if (typeof markdown !== 'string') throw new ValidationError('markdown must be a string');
  const beginCount = countOccurrences(markdown, BEGIN_MARKER);
  const endCount = countOccurrences(markdown, END_MARKER);
  if (beginCount !== 1 || endCount !== 1) throw new ValidationError('exactly one command envelope is required');

  const begin = markdown.indexOf(BEGIN_MARKER);
  const end = markdown.indexOf(END_MARKER);
  if (end <= begin) throw new ValidationError('exactly one correctly ordered command envelope is required');
  const raw = markdown.slice(begin + BEGIN_MARKER.length, end).trim();
  let command;
  try {
    command = JSON.parse(raw);
  } catch {
    throw new ValidationError('command envelope must contain valid JSON');
  }
  assertSafe(command);
  assertCommandShape(command);
  return command;
}
