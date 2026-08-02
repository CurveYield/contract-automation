import {
  MAX_CATEGORY_LENGTH,
  MAX_COVERAGE_VALUE,
  MAX_COUNTEREXAMPLE_BYTES,
  MAX_DURATION_MS,
  MAX_LINE_NUMBER,
  MAX_NAME_LENGTH,
  MAX_NUMERIC_VALUE,
  MAX_OBJECT_FIELDS,
  MAX_SEED,
  MAX_SOURCE_REFERENCES,
  MAX_STRING_LENGTH,
  MAX_SUMMARY_FIELDS,
  MAX_TRACE_ENTRIES,
  TRUNCATION_MESSAGE,
  assertCanonicalArray,
  boundedArray,
  boundedInteger,
  boundedJson,
  boundedNumber,
  boundedString,
  compareTuple,
  counterexampleValue,
  exactKeys,
  enumValue,
  fail,
  nullableInteger,
  nullableString,
  plainObject,
  safePath
} from './result-primitives-v1.mjs';

function validateLocation(value, path) {
  plainObject(value, path);
  exactKeys(value, ['path', 'start', 'end'], path);
  safePath(value.path, `${path}.path`);
  nullableInteger(value.start, `${path}.start`, 0, MAX_NUMERIC_VALUE);
  nullableInteger(value.end, `${path}.end`, 0, MAX_NUMERIC_VALUE);
  if (value.start !== null && value.end !== null && value.end < value.start) fail('invalid_integer', `${path}.end`, `${path}.end precedes start`);
}
function validateDiagnostic(value, path) {
  plainObject(value, path);
  exactKeys(value, ['severity', 'category', 'component', 'message', 'formattedMessage', 'location'], path);
  enumValue(value.severity, `${path}.severity`, ['error', 'warning', 'info']);
  boundedString(value.category, `${path}.category`, MAX_CATEGORY_LENGTH);
  boundedString(value.component, `${path}.component`, MAX_CATEGORY_LENGTH);
  boundedString(value.message, `${path}.message`);
  boundedString(value.formattedMessage, `${path}.formattedMessage`);
  validateLocation(value.location, `${path}.location`);
}
function validateUnitTest(value, path) {
  plainObject(value, path);
  exactKeys(value, ['suite', 'name', 'status', 'durationMs', 'reason'], path);
  boundedString(value.suite, `${path}.suite`, MAX_NAME_LENGTH);
  boundedString(value.name, `${path}.name`, MAX_NAME_LENGTH);
  enumValue(value.status, `${path}.status`, ['passed', 'failed', 'skipped']);
  boundedNumber(value.durationMs, `${path}.durationMs`, 0, MAX_DURATION_MS);
  nullableString(value.reason, `${path}.reason`);
}
function validateFuzzTest(value, path) {
  plainObject(value, path);
  exactKeys(value, ['test', 'status', 'runs', 'seed'], path);
  boundedString(value.test, `${path}.test`, MAX_NAME_LENGTH);
  enumValue(value.status, `${path}.status`, ['passed', 'failed']);
  boundedInteger(value.runs, `${path}.runs`, 0, 1_000_000);
  boundedInteger(value.seed, `${path}.seed`, 0, MAX_SEED);
}
function validateTrace(value, path) {
  boundedArray(value, path, MAX_TRACE_ENTRIES);
  value.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    plainObject(entry, itemPath);
    exactKeys(entry, ['contract', 'function', 'arguments', 'result'], itemPath);
    boundedString(entry.contract, `${itemPath}.contract`, MAX_NAME_LENGTH);
    boundedString(entry.function, `${itemPath}.function`, MAX_NAME_LENGTH);
    boundedJson(entry.arguments, `${itemPath}.arguments`);
    boundedJson(entry.result, `${itemPath}.result`);
  });
}
function validateCounterexample(value, path) {
  plainObject(value, path);
  if (Object.hasOwn(value, 'test')) {
    exactKeys(value, ['test', 'seed', 'value', 'trace'], path);
    boundedString(value.test, `${path}.test`, MAX_NAME_LENGTH);
  } else {
    exactKeys(value, ['contract', 'invariant', 'seed', 'value', 'trace'], path);
    boundedString(value.contract, `${path}.contract`, MAX_NAME_LENGTH);
    boundedString(value.invariant, `${path}.invariant`, MAX_NAME_LENGTH);
  }
  boundedInteger(value.seed, `${path}.seed`, 0, MAX_SEED);
  counterexampleValue(value.value, `${path}.value`);
  validateTrace(value.trace, `${path}.trace`);
}
function validateInvariant(value, path) {
  plainObject(value, path);
  exactKeys(value, ['contract', 'name', 'status', 'runs', 'depth', 'seed', 'counterexample', 'trace'], path);
  boundedString(value.contract, `${path}.contract`, MAX_NAME_LENGTH);
  boundedString(value.name, `${path}.name`, MAX_NAME_LENGTH);
  enumValue(value.status, `${path}.status`, ['passed', 'failed']);
  boundedInteger(value.runs, `${path}.runs`, 0, 1_000_000);
  boundedInteger(value.depth, `${path}.depth`, 0, 10_000);
  boundedInteger(value.seed, `${path}.seed`, 0, MAX_SEED);
  if (value.counterexample !== null) counterexampleValue(value.counterexample, `${path}.counterexample`);
  validateTrace(value.trace, `${path}.trace`);
}
function validateSourceReference(value, path) {
  plainObject(value, path);
  exactKeys(value, ['path', 'lines'], path);
  safePath(value.path, `${path}.path`);
  boundedArray(value.lines, `${path}.lines`, MAX_SOURCE_REFERENCES);
  let previous = 0;
  for (let index = 0; index < value.lines.length; index += 1) {
    const line = boundedInteger(value.lines[index], `${path}.lines[${index}]`, 1, MAX_LINE_NUMBER);
    if (line <= previous) fail('noncanonical_order', `${path}.lines[${index}]`, `${path}.lines must be unique and ascending`);
    previous = line;
  }
}
function validateFinding(value, path) {
  plainObject(value, path);
  exactKeys(value, ['detector', 'impact', 'confidence', 'description', 'locations'], path);
  boundedString(value.detector, `${path}.detector`, MAX_CATEGORY_LENGTH);
  boundedString(value.impact, `${path}.impact`, 80);
  boundedString(value.confidence, `${path}.confidence`, 80);
  boundedString(value.description, `${path}.description`);
  boundedArray(value.locations, `${path}.locations`, MAX_SOURCE_REFERENCES);
  value.locations.forEach((location, index) => validateSourceReference(location, `${path}.locations[${index}]`));
  assertCanonicalArray(value.locations, `${path}.locations`, (left, right) => compareTuple([
    left.path, left.lines[0] ?? 0, JSON.stringify(left.lines)
  ], [right.path, right.lines[0] ?? 0, JSON.stringify(right.lines)]));
}
function validateCoverageMetric(value, path) {
  plainObject(value, path);
  exactKeys(value, ['covered', 'total', 'percentage'], path);
  boundedInteger(value.covered, `${path}.covered`, 0, MAX_COVERAGE_VALUE);
  boundedInteger(value.total, `${path}.total`, 0, MAX_COVERAGE_VALUE);
  boundedNumber(value.percentage, `${path}.percentage`, 0, 100);
  if (value.covered > value.total) fail('invalid_coverage', path, `${path}.covered exceeds total`);
  const expected = value.total === 0 ? 100 : Math.round((value.covered / value.total) * 10_000) / 100;
  if (value.percentage !== expected) fail('invalid_coverage', `${path}.percentage`, `${path}.percentage is not canonical`);
}
function validateCoverageFile(value, path) {
  plainObject(value, path);
  exactKeys(value, ['path', 'lines', 'functions', 'branches'], path);
  safePath(value.path, `${path}.path`);
  for (const metric of ['lines', 'functions', 'branches']) validateCoverageMetric(value[metric], `${path}.${metric}`);
}
function validateCoverage(value, path) {
  plainObject(value, path);
  exactKeys(value, ['files', 'totals'], path);
  boundedArray(value.files, `${path}.files`, MAX_SOURCE_REFERENCES);
  value.files.forEach((file, index) => validateCoverageFile(file, `${path}.files[${index}]`));
  assertCanonicalArray(value.files, `${path}.files`, (left, right) => compareTuple([left.path, JSON.stringify(left)], [right.path, JSON.stringify(right)]));
  plainObject(value.totals, `${path}.totals`);
  exactKeys(value.totals, ['lines', 'functions', 'branches'], `${path}.totals`);
  for (const metric of ['lines', 'functions', 'branches']) {
    validateCoverageMetric(value.totals[metric], `${path}.totals.${metric}`);
    const covered = value.files.reduce((sum, file) => sum + file[metric].covered, 0);
    const total = value.files.reduce((sum, file) => sum + file[metric].total, 0);
    if (covered !== value.totals[metric].covered || total !== value.totals[metric].total) fail('invalid_coverage', `${path}.totals.${metric}`, `${path}.totals.${metric} does not equal file totals`);
  }
}
function validateWarning(value, path) {
  plainObject(value, path);
  exactKeys(value, ['code', 'message', 'path', 'omitted'], path);
  if (value.code !== 'truncated' || value.message !== TRUNCATION_MESSAGE) fail('invalid_warning', path, `${path} is not a canonical warning`);
  boundedString(value.path, `${path}.path`);
  boundedInteger(value.omitted, `${path}.omitted`, 1, 10_000);
}
function validateParserError(value, path) {
  plainObject(value, path);
  exactKeys(value, ['code', 'message', 'path'], path);
  boundedString(value.code, `${path}.code`, 80);
  boundedString(value.message, `${path}.message`);
  boundedString(value.path, `${path}.path`);
}
function validateSummary(value, path) {
  plainObject(value, path);
  const entries = Object.entries(value);
  if (entries.length > MAX_SUMMARY_FIELDS) fail('object_too_large', path, `${path} exceeds ${MAX_SUMMARY_FIELDS} fields`);
  for (const [key, child] of entries) {
    boundedString(key, `${path}.*`, MAX_CATEGORY_LENGTH);
    if (child === null || typeof child === 'boolean') continue;
    if (typeof child === 'string') { boundedString(child, `${path}.${key}`); continue; }
    if (typeof child === 'number') { boundedNumber(child, `${path}.${key}`, 0, MAX_NUMERIC_VALUE); continue; }
    fail('invalid_summary_value', `${path}.${key}`, `${path}.${key} must be a bounded primitive`);
  }
}

export {
  validateDiagnostic,
  validateUnitTest,
  validateFuzzTest,
  validateCounterexample,
  validateInvariant,
  validateFinding,
  validateCoverage,
  validateWarning,
  validateParserError,
  validateSummary
};
