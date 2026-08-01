import {
  CLASSIFICATIONS,
  MAX_DURATION_MS,
  MAX_FINDINGS,
  MAX_NUMERIC_VALUE,
  MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES,
  MAX_WARNINGS,
  PARSER_VERSIONS,
  TERMINATIONS,
  TOOL_RESULT_SCHEMA_VERSION,
  TOP_LEVEL_KEYS,
  assertCanonicalArray,
  booleanValue,
  boundedArray,
  boundedInteger,
  boundedString,
  cloneValue,
  compareTuple,
  deepFreeze,
  ensureEmpty,
  enumValue,
  exactKeys,
  fail,
  isPlainObject,
  nullableInteger,
  plainObject
} from './result-primitives-v1.mjs';
import {
  validateCounterexample,
  validateCoverage,
  validateDiagnostic,
  validateFinding,
  validateFuzzTest,
  validateInvariant,
  validateParserError,
  validateSummary,
  validateUnitTest,
  validateWarning
} from './result-evidence-v1.mjs';

export const PHASE4_RESULT_CONTRACT_SCHEMA_VERSION = TOOL_RESULT_SCHEMA_VERSION;
export const PHASE4_TOOL_RESULT_CONTRACT_VERSION = 'phase4-tool-result-contract-v1';

function exactSummaryKeys(summary, required, optional = []) {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(summary)) if (!allowed.has(key)) fail('unknown_field', `$.summary.${key}`, `$.summary.${key} is not allowed`);
  for (const key of required) if (!Object.hasOwn(summary, key)) fail('missing_field', `$.summary.${key}`, `$.summary.${key} is required`);
}
function countStatus(values, status) { return values.filter((item) => item.status === status).length; }
function validateProfileEvidence(result) {
  const summary = result.summary;
  switch (result.profileId) {
    case 'solidity-compile-v1': {
      ensureEmpty(result.tests, '$.tests'); ensureEmpty(result.counterexamples, '$.counterexamples'); ensureEmpty(result.invariants, '$.invariants'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['contracts', 'errors', 'warnings', 'diagnostics'], ['observedDiagnostics']);
      for (const key of Object.keys(summary)) boundedInteger(summary[key], `$.summary.${key}`, 0, MAX_NUMERIC_VALUE);
      if (summary.diagnostics !== result.diagnostics.length) fail('summary_mismatch', '$.summary.diagnostics');
      if (!Object.hasOwn(summary, 'observedDiagnostics')) {
        if (summary.errors !== result.diagnostics.filter((item) => item.severity === 'error').length || summary.warnings !== result.diagnostics.filter((item) => item.severity === 'warning').length) fail('summary_mismatch', '$.summary');
      } else if (summary.observedDiagnostics < summary.diagnostics) fail('summary_mismatch', '$.summary.observedDiagnostics');
      break;
    }
    case 'foundry-test-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.counterexamples, '$.counterexamples'); ensureEmpty(result.invariants, '$.invariants'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['passed', 'failed', 'skipped', 'total'], ['observedTotal', 'observedPassed', 'observedFailed', 'observedSkipped']);
      for (const key of Object.keys(summary)) boundedInteger(summary[key], `$.summary.${key}`, 0, MAX_NUMERIC_VALUE);
      if (summary.total !== result.tests.length || summary.passed !== countStatus(result.tests, 'passed') || summary.failed !== countStatus(result.tests, 'failed') || summary.skipped !== countStatus(result.tests, 'skipped')) fail('summary_mismatch', '$.summary');
      break;
    }
    case 'foundry-fuzz-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.invariants, '$.invariants'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['passed', 'failed', 'total'], ['observedTotal', 'observedPassed', 'observedFailed']);
      for (const key of Object.keys(summary)) boundedInteger(summary[key], `$.summary.${key}`, 0, MAX_NUMERIC_VALUE);
      if (summary.total !== result.tests.length || summary.passed !== countStatus(result.tests, 'passed') || summary.failed !== countStatus(result.tests, 'failed')) fail('summary_mismatch', '$.summary');
      break;
    }
    case 'foundry-invariant-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.tests, '$.tests'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['passed', 'failed', 'total'], ['observedTotal', 'observedPassed', 'observedFailed']);
      for (const key of Object.keys(summary)) boundedInteger(summary[key], `$.summary.${key}`, 0, MAX_NUMERIC_VALUE);
      if (summary.total !== result.invariants.length || summary.passed !== countStatus(result.invariants, 'passed') || summary.failed !== countStatus(result.invariants, 'failed')) fail('summary_mismatch', '$.summary');
      break;
    }
    case 'slither-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.tests, '$.tests'); ensureEmpty(result.counterexamples, '$.counterexamples'); ensureEmpty(result.invariants, '$.invariants');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['findings', 'high']);
      boundedInteger(summary.findings, '$.summary.findings', 0, MAX_FINDINGS);
      boundedInteger(summary.high, '$.summary.high', 0, MAX_FINDINGS);
      if (summary.findings !== result.findings.length || summary.high !== result.findings.filter((item) => item.impact.toLowerCase() === 'high').length) fail('summary_mismatch', '$.summary');
      break;
    }
    case 'coverage-forge-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.tests, '$.tests'); ensureEmpty(result.counterexamples, '$.counterexamples'); ensureEmpty(result.invariants, '$.invariants'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage === null) fail('missing_field', '$.coverage');
      exactSummaryKeys(summary, ['files']);
      boundedInteger(summary.files, '$.summary.files', 0, MAX_SOURCE_REFERENCES);
      if (summary.files !== result.coverage.files.length) fail('summary_mismatch', '$.summary.files');
      break;
    }
    default: fail('unknown_profile_id', '$.profileId');
  }
}
function evidenceArraysAreEmpty(result) {
  return result.diagnostics.length === 0 && result.tests.length === 0 && result.counterexamples.length === 0 && result.invariants.length === 0 && result.findings.length === 0 && result.coverage === null;
}
function validateLifecycle(result) {
  const classification = result.exitClassification;
  const termination = result.terminationReason;
  if (classification === 'success' || classification === 'tool_failure' || classification === 'parser_error') {
    if (termination !== 'completed') fail('lifecycle_mismatch', '$.terminationReason');
  } else if (classification !== termination) fail('lifecycle_mismatch', '$.terminationReason');

  if (termination === 'completed') {
    if (classification !== 'parser_error' && result.exitCode === null) fail('invalid_exit_code_state', '$.exitCode');
    if (classification === 'success' && result.exitCode !== 0) fail('lifecycle_mismatch', '$.exitCode');
  } else if (result.exitCode !== null) fail('invalid_exit_code_state', '$.exitCode');

  if (classification === 'parser_error') {
    if (result.parserErrors.length !== 1) fail('parser_error_cardinality', '$.parserErrors');
    if (!evidenceArraysAreEmpty(result) || result.parserWarnings.length !== 0 || result.truncated !== false || Object.keys(result.summary).length !== 0) fail('terminal_evidence_present', '$');
  } else if (result.parserErrors.length !== 0) fail('unexpected_parser_error', '$.parserErrors');

  if (termination !== 'completed') {
    if (
      !evidenceArraysAreEmpty(result) || result.parserWarnings.length !== 0 || result.parserErrors.length !== 0 ||
      result.truncated !== false || Object.keys(result.summary).length !== 1 || result.summary.terminationReason !== termination
    ) fail('terminal_evidence_present', '$');
  }
}

function validateCanonicalCollections(result) {
  assertCanonicalArray(result.diagnostics, '$.diagnostics', (left, right) => compareTuple([
    left.location.path, left.location.start ?? -1, left.location.end ?? -1, left.severity, left.category, left.message, JSON.stringify(left)
  ], [right.location.path, right.location.start ?? -1, right.location.end ?? -1, right.severity, right.category, right.message, JSON.stringify(right)]));
  if (result.profileId === 'foundry-test-v1') {
    assertCanonicalArray(result.tests, '$.tests', (left, right) => compareTuple([
      left.suite, left.name, left.status, left.durationMs, left.reason ?? '', JSON.stringify(left)
    ], [right.suite, right.name, right.status, right.durationMs, right.reason ?? '', JSON.stringify(right)]));
  } else if (result.profileId === 'foundry-fuzz-v1') {
    assertCanonicalArray(result.tests, '$.tests', (left, right) => compareTuple([
      left.test, left.seed, left.status, left.runs, JSON.stringify(left)
    ], [right.test, right.seed, right.status, right.runs, JSON.stringify(right)]));
  }
  assertCanonicalArray(result.counterexamples, '$.counterexamples', (left, right) => {
    const leftIdentity = Object.hasOwn(left, 'test') ? [left.test, left.seed] : [left.contract, left.invariant, left.seed];
    const rightIdentity = Object.hasOwn(right, 'test') ? [right.test, right.seed] : [right.contract, right.invariant, right.seed];
    return compareTuple([...leftIdentity, JSON.stringify(left)], [...rightIdentity, JSON.stringify(right)]);
  });
  assertCanonicalArray(result.invariants, '$.invariants', (left, right) => compareTuple([
    left.contract, left.name, left.seed, left.status, left.runs, left.depth, JSON.stringify(left.counterexample), JSON.stringify(left.trace), JSON.stringify(left)
  ], [right.contract, right.name, right.seed, right.status, right.runs, right.depth, JSON.stringify(right.counterexample), JSON.stringify(right.trace), JSON.stringify(right)]));
  assertCanonicalArray(result.findings, '$.findings', (left, right) => compareTuple([
    left.detector, left.locations[0]?.path ?? '', left.description, left.impact, left.confidence, JSON.stringify(left.locations), JSON.stringify(left)
  ], [right.detector, right.locations[0]?.path ?? '', right.description, right.impact, right.confidence, JSON.stringify(right.locations), JSON.stringify(right)]));
  assertCanonicalArray(result.parserWarnings, '$.parserWarnings', (left, right) => compareTuple([
    left.code, left.path, left.omitted, JSON.stringify(left)
  ], [right.code, right.path, right.omitted, JSON.stringify(right)]));
}

export function validatePhase4ToolResult(value) {
  plainObject(value, '$');
  exactKeys(value, TOP_LEVEL_KEYS, '$');
  if (value.schemaVersion !== TOOL_RESULT_SCHEMA_VERSION) fail('invalid_schema_version', '$.schemaVersion');
  boundedString(value.profileId, '$.profileId', 160);
  boundedString(value.parserVersion, '$.parserVersion', 160);
  const expectedParser = PARSER_VERSIONS[value.profileId];
  if (!expectedParser) fail('unknown_profile_id', '$.profileId');
  if (value.parserVersion !== expectedParser) fail('profile_parser_mismatch', '$.parserVersion');
  enumValue(value.exitClassification, '$.exitClassification', CLASSIFICATIONS);
  enumValue(value.terminationReason, '$.terminationReason', TERMINATIONS);
  boundedInteger(value.durationMs, '$.durationMs', 0, MAX_DURATION_MS);
  nullableInteger(value.exitCode, '$.exitCode', 0, 255);
  booleanValue(value.truncated, '$.truncated');

  boundedArray(value.diagnostics, '$.diagnostics', MAX_FINDINGS);
  value.diagnostics.forEach((item, index) => validateDiagnostic(item, `$.diagnostics[${index}]`));
  boundedArray(value.tests, '$.tests', MAX_TEST_CASES);
  value.tests.forEach((item, index) => {
    if (isPlainObject(item) && Object.hasOwn(item, 'suite')) validateUnitTest(item, `$.tests[${index}]`);
    else validateFuzzTest(item, `$.tests[${index}]`);
  });
  boundedArray(value.counterexamples, '$.counterexamples', MAX_TEST_CASES);
  value.counterexamples.forEach((item, index) => validateCounterexample(item, `$.counterexamples[${index}]`));
  boundedArray(value.invariants, '$.invariants', MAX_TEST_CASES);
  value.invariants.forEach((item, index) => validateInvariant(item, `$.invariants[${index}]`));
  boundedArray(value.findings, '$.findings', MAX_FINDINGS);
  value.findings.forEach((item, index) => validateFinding(item, `$.findings[${index}]`));
  if (value.coverage !== null) validateCoverage(value.coverage, '$.coverage');
  boundedArray(value.parserWarnings, '$.parserWarnings', MAX_WARNINGS);
  value.parserWarnings.forEach((item, index) => validateWarning(item, `$.parserWarnings[${index}]`));
  boundedArray(value.parserErrors, '$.parserErrors', 1);
  value.parserErrors.forEach((item, index) => validateParserError(item, `$.parserErrors[${index}]`));
  validateSummary(value.summary, '$.summary');

  validateCanonicalCollections(value);
  const hasTruncation = value.parserWarnings.some((warning) => warning.code === 'truncated');
  if (value.truncated !== hasTruncation) fail('truncation_mismatch', '$.truncated');
  validateLifecycle(value);
  if (value.terminationReason === 'completed' && value.exitClassification !== 'parser_error') validateProfileEvidence(value);

  return deepFreeze(cloneValue(value));
}
