import { ValidationError, assertProfileId } from '../../audit-protocol/src/index.mjs';

export const TOOL_RESULT_SCHEMA_VERSION = 'tool-result-v1';
export const MAX_INPUT_BYTES = 5_000_000;
export const MAX_LINES = 10_000;
export const MAX_FINDINGS = 1_000;
export const MAX_TEST_CASES = 2_000;
export const MAX_TRACE_ENTRIES = 64;
export const MAX_SOURCE_REFERENCES = 1_000;
export const MAX_NESTING_DEPTH = 12;
export const MAX_NUMERIC_VALUE = 1_000_000_000_000;

const MAX_STRING_LENGTH = 4_000;
const MAX_RAW_COLLECTION_ENTRIES = 10_000;
const MAX_OBJECT_FIELDS = 1_000;
const MAX_COUNTEREXAMPLE_BYTES = 256_000;
const MAX_DURATION_MS = 86_400_000;
const MAX_PATH_LENGTH = 1_024;
const MAX_NAME_LENGTH = 512;
const MAX_CATEGORY_LENGTH = 160;
const MAX_LINE_NUMBER = 10_000_000;
const MAX_COVERAGE_VALUE = 1_000_000_000;
const MAX_SEED = 4_294_967_295;

export const PARSER_LIMITS = Object.freeze({
  inputBytes: MAX_INPUT_BYTES,
  lines: MAX_LINES,
  findings: MAX_FINDINGS,
  testCases: MAX_TEST_CASES,
  traceEntries: MAX_TRACE_ENTRIES,
  sourceReferences: MAX_SOURCE_REFERENCES,
  stringLength: MAX_STRING_LENGTH,
  numericValue: MAX_NUMERIC_VALUE,
  nestingDepth: MAX_NESTING_DEPTH,
  rawCollectionEntries: MAX_RAW_COLLECTION_ENTRIES,
  objectFields: MAX_OBJECT_FIELDS,
  counterexampleBytes: MAX_COUNTEREXAMPLE_BYTES,
  durationMs: MAX_DURATION_MS
});

export const PARSER_VERSIONS = Object.freeze({
  'solidity-compile-v1': 'solidity-compile-parser-v1',
  'foundry-test-v1': 'foundry-test-parser-v1',
  'foundry-fuzz-v1': 'foundry-fuzz-parser-v1',
  'foundry-invariant-v1': 'foundry-invariant-parser-v1',
  'slither-v1': 'slither-parser-v1',
  'coverage-forge-v1': 'coverage-forge-parser-v1'
});

const TERMINATION_REASONS = Object.freeze([
  'completed',
  'timeout',
  'cancelled',
  'resource_exhaustion'
]);

const INPUT_FIELDS = new Set([
  'resultJson',
  'stdout',
  'stderr',
  'exitCode',
  'durationMs',
  'terminationReason'
]);

const ERROR_MESSAGES = Object.freeze({
  invalid_input: 'Parser input must be a plain object.',
  unknown_field: 'Parser input contains an unsupported field.',
  missing_field: 'Parser input is missing a required field.',
  invalid_text: 'Parser text input must be a string or UTF-8 byte array.',
  invalid_utf8: 'Parser byte input is not valid UTF-8.',
  invalid_json: 'Tool result JSON is malformed.',
  invalid_json_value: 'Tool result data is not valid bounded JSON.',
  invalid_object: 'A required JSON object was malformed.',
  invalid_array: 'A required JSON array was malformed.',
  collection_too_large: 'A JSON collection exceeded the absolute safety bound.',
  object_too_large: 'A JSON object exceeded the configured field bound.',
  invalid_string: 'A required value was not a string.',
  string_too_long: 'A string exceeded the configured length bound.',
  unsafe_path: 'A source reference was not a safe repository-relative path.',
  invalid_integer: 'An integer value is outside the configured range.',
  invalid_number: 'A numeric value is malformed.',
  numeric_out_of_range: 'A numeric value is outside the configured range.',
  invalid_duration: 'Duration is outside the configured range.',
  invalid_exit_code: 'Exit code is outside the configured range.',
  invalid_termination_reason: 'Termination reason is unsupported.',
  invalid_status: 'Tool status is unsupported.',
  invalid_boolean: 'A boolean field was malformed.',
  input_too_large: 'Combined parser input exceeded the configured byte bound.',
  too_many_lines: 'Combined parser input exceeded the configured line bound.',
  data_too_deep: 'Nested JSON data exceeded the configured depth bound.',
  data_too_large: 'Nested JSON data exceeded the configured byte bound.',
  duplicate_key: 'Normalized JSON object keys collide.',
  invalid_coverage: 'Coverage counters are inconsistent.',
  conflicting_coverage_file: 'Coverage output contains conflicting entries for one path.',
  parser_error: 'Tool output could not be parsed.'
});

const WARNING_MESSAGES = Object.freeze({
  truncated: 'Normalized entries were truncated at the configured bound.'
});

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

class ParserFault extends Error {
  constructor(code, path = '$') {
    super(code);
    this.name = 'ParserFault';
    this.code = code;
    this.path = path;
  }
}

function fault(code, path = '$') {
  throw new ParserFault(code, path);
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareNumber(left, right) {
  return left - right;
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, path) {
  if (!isPlainObject(value)) fault('invalid_object', path);
  return value;
}

function requireArray(value, path, absoluteMaximum = MAX_RAW_COLLECTION_ENTRIES) {
  if (!Array.isArray(value)) fault('invalid_array', path);
  if (value.length > absoluteMaximum) fault('collection_too_large', path);
  return value;
}

function cleanString(value, path, maximum = MAX_STRING_LENGTH) {
  if (typeof value !== 'string') fault('invalid_string', path);
  if (value.length > maximum) fault('string_too_long', path);
  return value.replaceAll('\u0000', '');
}

function optionalString(value, path, maximum = MAX_STRING_LENGTH) {
  if (value === undefined || value === null) return null;
  return cleanString(value, path, maximum);
}

function safePath(value, path) {
  const normalized = cleanString(value, path, MAX_PATH_LENGTH).replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    segments.includes('..') ||
    segments.includes('.') ||
    normalized.includes('://')
  ) {
    fault('unsafe_path', path);
  }
  return normalized;
}

function boundedInteger(value, path, minimum, maximum, code = 'invalid_integer') {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fault(code, path);
  return value;
}

function boundedNumber(value, path, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fault('invalid_number', path);
  if (value < minimum || value > maximum) fault('numeric_out_of_range', path);
  return value;
}

function boundedJsonNumber(value, path) {
  return boundedNumber(value, path, -MAX_NUMERIC_VALUE, MAX_NUMERIC_VALUE);
}

function enumValue(value, allowed, path, code = 'invalid_status') {
  if (typeof value !== 'string' || !allowed.includes(value)) fault(code, path);
  return value;
}

function boolValue(value, path) {
  if (typeof value !== 'boolean') fault('invalid_boolean', path);
  return value;
}

function decodeText(value, path, allowUndefined = true) {
  if (value === undefined && allowUndefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) {
    try {
      return decoder.decode(value);
    } catch {
      fault('invalid_utf8', path);
    }
  }
  fault('invalid_text', path);
}

function countLines(value) {
  if (value.length === 0) return 0;
  return value.split(/\r\n|\r|\n/).length;
}

function serializeResultJson(value, path) {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return decodeText(value, path, false);
  if (value === undefined) return '';
  if (value === null) return 'null';
  fault('invalid_json_value', path);
}

function parseResultJson(value) {
  if (typeof value === 'string' || value instanceof Uint8Array) {
    const serialized = decodeText(value, '$.resultJson', false);
    try {
      return JSON.parse(serialized);
    } catch {
      fault('invalid_json', '$.resultJson');
    }
  }
  if (value === undefined) fault('missing_field', '$.resultJson');
  fault('invalid_json_value', '$.resultJson');
}

function warningCollector() {
  const warnings = [];
  return {
    addTruncation(path, omitted) {
      if (omitted <= 0) return;
      warnings.push({
        code: 'truncated',
        message: WARNING_MESSAGES.truncated,
        path,
        omitted
      });
    },
    values() {
      const unique = new Map();
      for (const warning of warnings) unique.set(stableStringify(warning), warning);
      return [...unique.values()].sort((left, right) =>
        compareText(left.code, right.code) ||
        compareText(left.path, right.path) ||
        compareNumber(left.omitted ?? 0, right.omitted ?? 0)
      );
    }
  };
}

function normalizeSortedCollection(raw, path, outputLimit, normalize, compare, warnings, observeUnique = null) {
  const values = requireArray(raw, path).map((item, index) => normalize(item, index));
  values.sort(compare);
  const unique = [];
  const seen = new Set();
  for (const value of values) {
    const key = stableStringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  if (observeUnique) observeUnique(unique);
  const omitted = Math.max(0, unique.length - outputLimit);
  warnings.addTruncation(path, omitted);
  return unique.slice(0, outputLimit);
}

function normalizeOrderedCollection(raw, path, outputLimit, normalize, warnings) {
  const values = requireArray(raw, path).map((item, index) => normalize(item, index));
  const omitted = Math.max(0, values.length - outputLimit);
  warnings.addTruncation(path, omitted);
  return values.slice(0, outputLimit);
}

function normalizeBoundedData(value, path, depth = 0) {
  if (depth > MAX_NESTING_DEPTH) fault('data_too_deep', path);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return boundedJsonNumber(value, path);
  if (typeof value === 'string') return cleanString(value, path);
  if (Array.isArray(value)) {
    if (value.length > MAX_OBJECT_FIELDS) fault('collection_too_large', path);
    return value.map((item, index) => normalizeBoundedData(item, `${path}[${index}]`, depth + 1));
  }
  if (!isPlainObject(value)) fault('invalid_json_value', path);
  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_FIELDS) fault('object_too_large', path);
  entries.sort(([left], [right]) => compareText(left, right));
  const result = {};
  const normalizedKeys = new Set();
  for (const [key, child] of entries) {
    const normalizedKey = cleanString(key, `${path}.*`, MAX_CATEGORY_LENGTH);
    if (normalizedKeys.has(normalizedKey)) fault('duplicate_key', `${path}.*`);
    normalizedKeys.add(normalizedKey);
    const normalizedChild = normalizeBoundedData(child, `${path}.*`, depth + 1);
    Object.defineProperty(result, normalizedKey, {
      value: normalizedChild,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  return result;
}

function normalizeCounterexample(value, path) {
  const result = normalizeBoundedData(value, path);
  if (encoder.encode(stableStringify(result)).byteLength > MAX_COUNTEREXAMPLE_BYTES) fault('data_too_large', path);
  return result;
}

function normalizeTrace(value, path, warnings) {
  if (value === undefined || value === null) return [];
  return normalizeOrderedCollection(value, path, MAX_TRACE_ENTRIES, (entry, index) => {
    const entryPath = `${path}[${index}]`;
    requirePlainObject(entry, entryPath);
    return {
      contract: cleanString(entry.contract ?? '', `${entryPath}.contract`, MAX_NAME_LENGTH),
      function: cleanString(entry.function ?? '', `${entryPath}.function`, MAX_NAME_LENGTH),
      arguments: normalizeBoundedData(entry.arguments ?? [], `${entryPath}.arguments`),
      result: normalizeBoundedData(entry.result ?? null, `${entryPath}.result`)
    };
  }, warnings);
}

function percentage(covered, total) {
  return total === 0 ? 100 : Math.round((covered / total) * 10_000) / 100;
}

function knownProfile(profileId) {
  assertProfileId(profileId);
  const parserVersion = PARSER_VERSIONS[profileId];
  if (!parserVersion) {
    throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
  }
  return parserVersion;
}

function baseResult(profileId, parserVersion, values = {}) {
  return {
    schemaVersion: TOOL_RESULT_SCHEMA_VERSION,
    profileId,
    parserVersion,
    exitClassification: values.exitClassification ?? 'success',
    terminationReason: values.terminationReason ?? 'completed',
    durationMs: values.durationMs ?? 0,
    exitCode: values.exitCode ?? null,
    truncated: values.truncated ?? false,
    diagnostics: values.diagnostics ?? [],
    tests: values.tests ?? [],
    counterexamples: values.counterexamples ?? [],
    invariants: values.invariants ?? [],
    findings: values.findings ?? [],
    coverage: values.coverage ?? null,
    parserWarnings: values.parserWarnings ?? [],
    parserErrors: values.parserErrors ?? [],
    summary: values.summary ?? {}
  };
}

function parserErrorResult(profileId, parserVersion, input, error) {
  const recognized = error instanceof ParserFault;
  const code = recognized && ERROR_MESSAGES[error.code] ? error.code : 'parser_error';
  const path = recognized && typeof error.path === 'string' && (error.path === '$' || error.path.startsWith('$.') || error.path.startsWith('$[')) ? error.path : '$';
  const durationMs = Number.isSafeInteger(input?.durationMs) && input.durationMs >= 0 && input.durationMs <= MAX_DURATION_MS
    ? input.durationMs
    : 0;
  const exitCode = Number.isSafeInteger(input?.exitCode) && input.exitCode >= 0 && input.exitCode <= 255
    ? input.exitCode
    : null;
  const terminationReason = TERMINATION_REASONS.includes(input?.terminationReason) ? input.terminationReason : 'completed';
  return deepFreeze(baseResult(profileId, parserVersion, {
    exitClassification: 'parser_error',
    terminationReason,
    durationMs,
    exitCode,
    parserErrors: [{ code, message: ERROR_MESSAGES[code], path }]
  }));
}

function prepareInput(input) {
  if (!isPlainObject(input)) fault('invalid_input', '$');
  for (const key of Object.keys(input)) {
    if (!INPUT_FIELDS.has(key)) fault('unknown_field', '$');
  }
  if (!Object.hasOwn(input, 'durationMs')) fault('missing_field', '$.durationMs');
  if (!Object.hasOwn(input, 'terminationReason')) fault('missing_field', '$.terminationReason');

  const terminationReason = enumValue(
    input.terminationReason,
    TERMINATION_REASONS,
    '$.terminationReason',
    'invalid_termination_reason'
  );
  const durationMs = boundedInteger(input.durationMs, '$.durationMs', 0, MAX_DURATION_MS, 'invalid_duration');
  const stdout = decodeText(input.stdout, '$.stdout');
  const stderr = decodeText(input.stderr, '$.stderr');
  const resultText = serializeResultJson(input.resultJson, '$.resultJson');

  const totalBytes = encoder.encode(stdout).byteLength + encoder.encode(stderr).byteLength + encoder.encode(resultText).byteLength;
  if (totalBytes > MAX_INPUT_BYTES) fault('input_too_large', '$');
  const totalLines = countLines(stdout) + countLines(stderr) + countLines(resultText);
  if (totalLines > MAX_LINES) fault('too_many_lines', '$');

  let exitCode = null;
  if (terminationReason === 'completed') {
    if (!Object.hasOwn(input, 'exitCode')) fault('missing_field', '$.exitCode');
    exitCode = boundedInteger(input.exitCode, '$.exitCode', 0, 255, 'invalid_exit_code');
  } else if (input.exitCode !== undefined && input.exitCode !== null) {
    exitCode = boundedInteger(input.exitCode, '$.exitCode', 0, 255, 'invalid_exit_code');
  }

  if (terminationReason !== 'completed') {
    return { terminationReason, durationMs, exitCode, stdout, stderr, result: null };
  }

  return {
    terminationReason,
    durationMs,
    exitCode,
    stdout,
    stderr,
    result: parseResultJson(input.resultJson)
  };
}

function finalizeResult(profileId, parserVersion, prepared, warnings, values) {
  const parserWarnings = warnings.values();
  return deepFreeze(baseResult(profileId, parserVersion, {
    terminationReason: prepared.terminationReason,
    durationMs: prepared.durationMs,
    exitCode: prepared.exitCode,
    truncated: parserWarnings.some((warning) => warning.code === 'truncated'),
    parserWarnings,
    ...values
  }));
}
export {
  MAX_STRING_LENGTH,
  MAX_RAW_COLLECTION_ENTRIES,
  MAX_OBJECT_FIELDS,
  MAX_DURATION_MS,
  MAX_NAME_LENGTH,
  MAX_CATEGORY_LENGTH,
  MAX_LINE_NUMBER,
  MAX_COVERAGE_VALUE,
  MAX_SEED,
  fault,
  compareText,
  compareNumber,
  stableStringify,
  deepFreeze,
  requirePlainObject,
  requireArray,
  cleanString,
  optionalString,
  safePath,
  boundedInteger,
  boundedNumber,
  enumValue,
  boolValue,
  warningCollector,
  normalizeSortedCollection,
  normalizeCounterexample,
  normalizeTrace,
  percentage,
  knownProfile,
  baseResult,
  parserErrorResult,
  prepareInput,
  finalizeResult
};
