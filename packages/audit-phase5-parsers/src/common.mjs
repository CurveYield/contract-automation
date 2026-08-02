import { assertProfileId } from '../../audit-protocol/src/index.mjs';

export const MAX_PHASE5_INPUT_BYTES = 2_000_000;
export const MAX_PHASE5_RECORDS = 10_000;
export const MAX_PHASE5_STRING_LENGTH = 2_000;
export const MAX_DURATION_MS = 86_400_000;
export const MAX_COUNTEREXAMPLE_STEPS = 1_000;
export const MAX_ARGUMENTS = 64;
export const MAX_ALIASES = 64;
export const TERMINATIONS = new Set(['completed', 'timeout', 'cancelled', 'resource_exhausted']);
export const PROFILE_IDS = new Set(['hardhat-test-v1', 'echidna-v1', 'mutation-v1', 'dependency-scan-v1']);
export const INVALID_PROFILE_ID = 'invalid-profile-v1';
export const MUTATION_OPERATORS = new Set([
  'binary-op-mutation', 'unary-operator-mutation', 'require-mutation', 'assignment-mutation',
  'delete-expression-mutation', 'if-cond-mutation', 'swap-arguments-operator-mutation', 'elim-delegate-mutation'
]);
export const SEVERITIES = new Set(['critical', 'high', 'moderate', 'low', 'unknown']);

export const PHASE5_PARSER_VERSIONS = Object.freeze({
  'hardhat-test-v1': 'hardhat-test-parser-v1',
  'echidna-v1': 'echidna-parser-v1',
  'mutation-v1': 'mutation-parser-v1',
  'dependency-scan-v1': 'dependency-scan-parser-v1'
});

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function fault(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function plainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw fault('invalid_object', `${path} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw fault('invalid_object', `${path} must be a plain object`);
  }
  return value;
}

export function exactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw fault('unknown_field', `${path} contains an unknown field`);
  }
}

export function array(value, path, maximum = MAX_PHASE5_RECORDS) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw fault('invalid_array', `${path} must contain at most ${maximum} entries`);
  }
  return value;
}

export function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw fault('invalid_integer', `${path} contains an invalid integer`);
  }
  return value;
}

export function cleanString(value, path, maximum = MAX_PHASE5_STRING_LENGTH, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0)) {
    throw fault('invalid_string', `${path} contains an invalid string`);
  }
  if (/\u0000/.test(value)) throw fault('invalid_string', `${path} contains an invalid string`);
  return value;
}

function redactMessage(text) {
  return text
    .replace(/\bAuthorization\s*:\s*(?:Bearer\s+)?[^\s,;]+/gi, 'Authorization: [redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:PRIVATE[_-]?KEY|API[_-]?KEY|ACCESS[_-]?KEY|TOKEN|SECRET|KEY)\s*=\s*(?:\"[^\"\r\n]*\"|'[^'\r\n]*'|[^\s,;]+)/gi, '[redacted]')
    .replace(/\b(?:private\s+key|api\s+key|access\s+key|authorization\s+token)\s*:\s*(?:\"[^\"\r\n]*\"|'[^'\r\n]*'|[^\s,;]+)/gi, '[redacted]')
    .replace(/\b(?:mnemonic|seed(?:[_ -]?phrase)?)\s*[:=]\s*(?:\"[^\"\r\n]*\"|'[^'\r\n]*'|(?:[A-Za-z]+\s+){2,23}[A-Za-z]+)/gi, '[redacted]')
    .replace(/\b0x[0-9a-f]{64}\b/gi, '[redacted]')
    .replace(/[A-Za-z]:\\[^\s]+/g, '[path]')
    .replace(/\/(?:[^\s/]+\/){2,}[^\s]+/g, '[path]');
}

export function cleanMessage(value, path) {
  return redactMessage(cleanString(value, path));
}

export function safePath(value, path) {
  const result = cleanString(value, path, 512, false).replaceAll('\\', '/');
  if (
    result.startsWith('/') || /^[A-Za-z]:\//.test(result) || result.split('/').includes('..') ||
    result.includes('//') || !/^[A-Za-z0-9_.@+\/-]+$/.test(result)
  ) {
    throw fault('unsafe_path', 'Tool result contains an unsafe relative path');
  }
  return result;
}

export function stringArray(value, path, maximum = MAX_ARGUMENTS) {
  return array(value, path, maximum).map((item, index) => cleanString(item, `${path}[${index}]`, 512));
}

export function baseResult(profileId, parserVersion, input, classification = 'success') {
  return {
    schemaVersion: 'phase5-tool-result-v1',
    profileId,
    parserVersion,
    classification,
    durationMs: input.durationMs,
    exitCode: input.exitCode,
    hardhatTests: [],
    echidnaProperties: [],
    mutationResults: [],
    dependencyFindings: [],
    evidence: [],
    artifacts: [],
    parserErrors: [],
    summary: {}
  };
}

export function parserFailure(profileId, parserVersion, input, classification, error) {
  const safeDuration = Number.isSafeInteger(input?.durationMs) && input.durationMs >= 0 && input.durationMs <= MAX_DURATION_MS ? input.durationMs : 0;
  const safeExit = input?.exitCode === null || (Number.isSafeInteger(input?.exitCode) && input.exitCode >= 0 && input.exitCode <= 255) ? input.exitCode : null;
  return deepFreeze({
    ...baseResult(profileId, parserVersion, { durationMs: safeDuration, exitCode: safeExit }, classification),
    parserErrors: [{
      code: typeof error?.code === 'string' ? error.code : 'parser_error',
      message: typeof error?.message === 'string'
        ? redactMessage(error.message.slice(0, MAX_PHASE5_STRING_LENGTH))
        : 'Tool output could not be parsed'
    }]
  });
}

export function terminationResult(profileId, parserVersion, prepared) {
  const mapping = {
    timeout: 'timeout',
    cancelled: 'cancelled',
    resource_exhausted: 'resource_exhaustion'
  };
  return deepFreeze(baseResult(
    profileId,
    parserVersion,
    { ...prepared, exitCode: null },
    mapping[prepared.termination]
  ));
}

function decodeBytes(value) {
  if (typeof value === 'string') {
    const bytes = encoder.encode(value);
    if (bytes.byteLength > MAX_PHASE5_INPUT_BYTES) throw fault('input_too_large', `Tool result exceeds ${MAX_PHASE5_INPUT_BYTES} bytes`);
    return value;
  }
  if (value instanceof Uint8Array) {
    if (value.byteLength > MAX_PHASE5_INPUT_BYTES) throw fault('input_too_large', `Tool result exceeds ${MAX_PHASE5_INPUT_BYTES} bytes`);
    try { return decoder.decode(value); }
    catch { throw fault('invalid_utf8', 'Tool result is not valid UTF-8'); }
  }
  throw fault('invalid_input_bytes', 'Tool result must be supplied as inert UTF-8 bytes or text');
}

function validateParserProfileId(profileId) {
  if (
    typeof profileId !== 'string' || profileId.length < 1 || profileId.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(profileId)
  ) {
    throw fault('invalid_profile_id', '$.profileId must be a bounded versioned profile slug');
  }
  try {
    assertProfileId(profileId);
  } catch (error) {
    throw fault(typeof error?.code === 'string' ? error.code : 'invalid_profile_id', '$.profileId must be a versioned profile slug');
  }
  return profileId;
}

export function prepare(profileId, input) {
  validateParserProfileId(profileId);
  if (!PROFILE_IDS.has(profileId)) throw fault('unknown_profile_id', 'Unsupported Phase 5 profileId');
  plainObject(input, '$');
  exactKeys(input, new Set(['resultBytes', 'exitCode', 'durationMs', 'termination']), '$');
  const termination = cleanString(input.termination, '$.termination', 32, false);
  if (!TERMINATIONS.has(termination)) throw fault('invalid_termination', '$.termination is not supported');
  const durationMs = integer(input.durationMs, '$.durationMs', 0, MAX_DURATION_MS);
  let exitCode;
  if (input.exitCode === null) exitCode = null;
  else exitCode = integer(input.exitCode, '$.exitCode', 0, 255);
  if (termination === 'completed' && exitCode === null) throw fault('invalid_exit_code', '$.exitCode is required for completed results');
  return { resultText: decodeBytes(input.resultBytes), exitCode, durationMs, termination };
}

export function parseJson(text) {
  try { return JSON.parse(text); }
  catch { throw fault('invalid_json', 'Tool result JSON is malformed'); }
}

export function dedupeAndSort(items, keyOf, compare) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  result.sort(compare);
  return result;
}

export function canonicalizeByIdentity(items, identityOf, label, compare) {
  const byIdentity = new Map();
  for (const item of items) {
    const identity = identityOf(item);
    const canonical = JSON.stringify(item);
    const previous = byIdentity.get(identity);
    if (previous === undefined) {
      byIdentity.set(identity, { canonical, item });
    } else if (previous.canonical !== canonical) {
      throw fault('conflicting_duplicate', `Conflicting duplicate ${label} record`);
    }
  }
  return [...byIdentity.values()].map(({ item }) => item).sort(compare);
}

export function evidenceFor(type, count) {
  return [{ schemaVersion: 'phase5-parser-evidence-v1', type, recordCount: count }];
}
