import { assertProfileId } from '../../audit-protocol/src/index.mjs';
import * as base from './common.mjs';

export const PROFILE_IDS = base.PROFILE_IDS;
export const INVALID_PROFILE_ID = base.INVALID_PROFILE_ID;
export const PHASE5_PARSER_VERSIONS = base.PHASE5_PARSER_VERSIONS;
export const parseJson = base.parseJson;
export const fault = base.fault;

const INPUT_KEYS = new Set(['resultBytes', 'exitCode', 'durationMs', 'termination']);
const TERMINATIONS = new Set(['completed', 'timeout', 'cancelled', 'resource_exhausted']);

function safeOwnDataValue(value, key) {
  if (value === null || typeof value !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function inputDescriptors(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw base.fault('invalid_object', '$ must be an object');
  }
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    throw error;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw base.fault('invalid_object', '$ must be a plain object');
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !INPUT_KEYS.has(key)) {
      throw base.fault('unknown_field', '$ contains an unknown field');
    }
    if (!Object.hasOwn(descriptors[key], 'value')) {
      throw base.fault('invalid_object', '$ must contain data properties only');
    }
  }
  for (const key of INPUT_KEYS) {
    if (!Object.hasOwn(descriptors, key)) throw base.fault('invalid_object', `$ must contain ${key}`);
  }
  return descriptors;
}

function validateProfileId(profileId) {
  if (
    typeof profileId !== 'string' || profileId.length < 1 || profileId.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(profileId)
  ) {
    throw base.fault('invalid_profile_id', '$.profileId must be a bounded versioned profile slug');
  }
  try {
    assertProfileId(profileId);
  } catch (error) {
    throw base.fault(typeof error?.code === 'string' ? error.code : 'invalid_profile_id', '$.profileId must be a versioned profile slug');
  }
  if (!PROFILE_IDS.has(profileId)) throw base.fault('unknown_profile_id', 'Unsupported Phase 5 profileId');
}

function integer(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) {
    throw base.fault('invalid_integer', `${path} contains an invalid integer`);
  }
  return value;
}

function cleanTermination(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 32 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw base.fault('invalid_string', '$.termination contains an invalid string');
  }
  if (!TERMINATIONS.has(value)) throw base.fault('invalid_termination', '$.termination is not supported');
  return value;
}

export function prepare(profileId, input) {
  validateProfileId(profileId);
  const descriptors = inputDescriptors(input);
  const resultBytes = descriptors.resultBytes.value;
  if (typeof resultBytes !== 'string' && !(resultBytes instanceof Uint8Array)) {
    throw base.fault('invalid_input_bytes', 'Tool result must be supplied as inert UTF-8 bytes or text');
  }
  const termination = cleanTermination(descriptors.termination.value);
  const durationMs = integer(descriptors.durationMs.value, '$.durationMs', 0, base.MAX_DURATION_MS);
  const rawExitCode = descriptors.exitCode.value;
  const exitCode = rawExitCode === null ? null : integer(rawExitCode, '$.exitCode', 0, 255);
  if (termination === 'completed' && exitCode === null) {
    throw base.fault('invalid_exit_code', '$.exitCode is required for completed results');
  }
  return base.prepare(profileId, { resultBytes, exitCode, durationMs, termination });
}

function redactMessage(text) {
  return text
    .replace(/\bAuthorization\s*:\s*(?:Bearer\s+)?[^\s,;]+/gi, 'Authorization: [redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:PRIVATE[_-]?KEY|API[_-]?KEY|ACCESS[_-]?KEY|TOKEN|SECRET|KEY)\s*=\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '[redacted]')
    .replace(/\b(?:private\s+key|api\s+key|access\s+key|authorization\s+token)\s*:\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '[redacted]')
    .replace(/\b(?:mnemonic|seed(?:[_ -]?phrase)?)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|(?:[A-Za-z]+\s+){2,23}[A-Za-z]+)/gi, '[redacted]')
    .replace(/\b0x[0-9a-f]{64}\b/gi, '[redacted]')
    .replace(/[A-Za-z]:\\[^\s]+/g, '[path]')
    .replace(/\/(?:[^\s/]+\/){2,}[^\s]+/g, '[path]');
}

export function parserFailure(profileId, parserVersion, input, classification, error) {
  const rawDuration = safeOwnDataValue(input, 'durationMs');
  const rawExit = safeOwnDataValue(input, 'exitCode');
  const durationMs = Number.isSafeInteger(rawDuration) && !Object.is(rawDuration, -0) && rawDuration >= 0 && rawDuration <= base.MAX_DURATION_MS
    ? rawDuration
    : 0;
  const exitCode = rawExit === null || (Number.isSafeInteger(rawExit) && !Object.is(rawExit, -0) && rawExit >= 0 && rawExit <= 255)
    ? rawExit
    : null;
  const rawCode = safeOwnDataValue(error, 'code');
  const rawMessage = safeOwnDataValue(error, 'message');
  const safeError = {
    code: typeof rawCode === 'string' ? rawCode : 'parser_error',
    message: typeof rawMessage === 'string'
      ? redactMessage(rawMessage.slice(0, base.MAX_PHASE5_STRING_LENGTH))
      : 'Tool output could not be parsed'
  };
  return base.parserFailure(profileId, parserVersion, { durationMs, exitCode }, classification, safeError);
}

export function terminationResult(profileId, parserVersion, prepared) {
  const mapping = {
    timeout: 'timeout',
    cancelled: 'cancelled',
    resource_exhausted: 'resource_exhaustion'
  };
  return base.deepFreeze(base.baseResult(
    profileId,
    parserVersion,
    { durationMs: prepared.durationMs, exitCode: null },
    mapping[prepared.termination]
  ));
}
