import {
  CLASSIFICATIONS, MAX_DURATION_MS, MAX_FINDINGS, MAX_NUMERIC_VALUE, MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES, MAX_WARNINGS, PARSER_VERSIONS, TERMINATIONS, TOOL_RESULT_SCHEMA_VERSION,
  TOP_LEVEL_KEYS, assertCanonicalArray, booleanValue, boundedArray, boundedInteger, boundedString,
  canonicalStringify, compareTuple, deepFreeze, ensureEmpty, enumValue, exactKeys, fail, isPlainObject,
  nullableInteger, plainObject, sanitizeExternalValue
} from './result-primitives-v1.mjs';
import {
  validateCounterexample, validateCoverage, validateDiagnostic, validateFinding, validateFuzzTest,
  validateInvariant, validateParserError, validateSummary, validateUnitTest, validateWarning
} from './result-evidence-v1.mjs';

export const PHASE4_RESULT_CONTRACT_SCHEMA_VERSION = TOOL_RESULT_SCHEMA_VERSION;
export const PHASE4_TOOL_RESULT_CONTRACT_VERSION = 'phase4-tool-result-contract-v1';

function exactSummaryKeys(summary, required, optional = []) {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(summary)) if (!allowed.has(key)) fail('unknown_field', `$.summary.${key}`, `$.summary.${key} is not allowed`);
  for (const key of required) if (!Object.hasOwn(summary, key)) fail('missing_field', `$.summary.${key}`, `$.summary.${key} is required`);
}
function countStatus(values, status) { return values.filter((item) => item.status === status).length; }
function assertClassification(result, failed) {
  const expected = failed ? 'tool_failure' : 'success';
  if (result.exitClassification !== expected) fail('classification_mismatch', '$.exitClassification');
}
function validateFuzzCounterexampleIdentities(result) {
  for (let index = 0; index < result.counterexamples.length; index += 1) {
    const counterexample = result.counterexamples[index];
    const matchingTest = result.tests.find((item) => item.test === counterexample.test && item.seed === counterexample.seed);
    if (!matchingTest) {
      const sameTest = result.tests.some((item) => item.test === counterexample.test);
      fail('evidence_identity_mismatch', `$.counterexamples[${index}].${sameTest ? 'seed' : 'test'}`);
    }
    if (matchingTest.status !== 'failed') fail('evidence_identity_mismatch', `$.counterexamples[${index}].test`);
  }
}
function validateInvariantCounterexampleIdentities(result) {
  for (let index = 0; index < result.counterexamples.length; index += 1) {
    const counterexample = result.counterexamples[index];
    const sameContract = result.invariants.filter((item) => item.contract === counterexample.contract);
    if (sameContract.length === 0) fail('evidence_identity_mismatch', `$.counterexamples[${index}].contract`);
    const sameInvariant = sameContract.filter((item) => item.name === counterexample.invariant);
    if (sameInvariant.length === 0) fail('evidence_identity_mismatch', `$.counterexamples[${index}].invariant`);
    const matching = sameInvariant.find((item) => item.seed === counterexample.seed);
    if (!matching) fail('evidence_identity_mismatch', `$.counterexamples[${index}].seed`);
    if (matching.status !== 'failed') fail('evidence_identity_mismatch', `$.counterexamples[${index}].invariant`);
    if (canonicalStringify(matching.counterexample) !== canonicalStringify(counterexample.value)) fail('evidence_identity_mismatch', `$.counterexamples[${index}].value`);
    if (canonicalStringify(matching.trace) !== canonicalStringify(counterexample.trace)) fail('evidence_identity_mismatch', `$.counterexamples[${index}].trace`);
  }
}
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
      assertClassification(result, result.exitCode !== 0 || summary.errors > 0);
      break;
    }
    case 'foundry-test-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.counterexamples, '$.counterexamples'); ensureEmpty(result.invariants, '$.invariants'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['passed', 'failed', 'skipped', 'total'], ['observedTotal', 'observedPassed', 'observedFailed', 'observedSkipped']);
      for (const key of Object.keys(summary)) boundedInteger(summary[key], `$.summary.${key}`, 0, MAX_NUMERIC_VALUE);
      if (summary.total !== result.tests.length || summary.passed !== countStatus(result.tests, 'passed') || summary.failed !== countStatus(result.tests, 'failed') || summary.skipped !== countStatus(result.tests, 'skipped')) fail('summary_mismatch', '$.summary');
      assertClassification(result, result.exitCode !== 0 || summary.failed > 0);
      break;
    }
    case 'foundry-fuzz-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.invariants, '$.invariants'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['passed', 'failed', 'total'], ['observedTotal', 'observedPassed', 'observedFailed']);
      for (const key of Object.keys(summary)) boundedInteger(summary[key], `$.summary.${key}`, 0, MAX_NUMERIC_VALUE);
      if (summary.total !== result.tests.length || summary.passed !== countStatus(result.tests, 'passed') || summary.failed !== countStatus(result.tests, 'failed')) fail('summary_mismatch', '$.summary');
      validateFuzzCounterexampleIdentities(result);
      assertClassification(result, result.exitCode !== 0 || summary.failed > 0);
      break;
    }
    case 'foundry-invariant-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.tests, '$.tests'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['passed', 'failed', 'total'], ['observedTotal', 'observedPassed', 'observedFailed']);
      for (const key of Object.keys(summary)) boundedInteger(summary[key], `$.summary.${key}`, 0, MAX_NUMERIC_VALUE);
      if (summary.total !== result.invariants.length || summary.passed !== countStatus(result.invariants, 'passed') || summary.failed !== countStatus(result.invariants, 'failed')) fail('summary_mismatch', '$.summary');
      validateInvariantCounterexampleIdentities(result);
      assertClassification(result, result.exitCode !== 0 || summary.failed > 0);
      break;
    }
    case 'slither-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.tests, '$.tests'); ensureEmpty(result.counterexamples, '$.counterexamples'); ensureEmpty(result.invariants, '$.invariants');
      if (result.coverage !== null) fail('unexpected_evidence', '$.coverage');
      exactSummaryKeys(summary, ['findings', 'high']); boundedInteger(summary.findings, '$.summary.findings', 0, MAX_FINDINGS); boundedInteger(summary.high, '$.summary.high', 0, MAX_FINDINGS);
      if (summary.findings !== result.findings.length || summary.high !== result.findings.filter((item) => item.impact.toLowerCase() === 'high').length) fail('summary_mismatch', '$.summary');
      break;
    }
    case 'coverage-forge-v1': {
      ensureEmpty(result.diagnostics, '$.diagnostics'); ensureEmpty(result.tests, '$.tests'); ensureEmpty(result.counterexamples, '$.counterexamples'); ensureEmpty(result.invariants, '$.invariants'); ensureEmpty(result.findings, '$.findings');
      if (result.coverage === null) fail('missing_field', '$.coverage'); exactSummaryKeys(summary, ['files']); boundedInteger(summary.files, '$.summary.files', 0, MAX_SOURCE_REFERENCES);
      if (summary.files !== result.coverage.files.length) fail('summary_mismatch', '$.summary.files');
      assertClassification(result, result.exitCode !== 0);
      break;
    }
    default: fail('unknown_profile_id', '$.profileId');
  }
}
function evidenceArraysAreEmpty(result) {
  return result.diagnostics.length === 0 && result.tests.length === 0 && result.counterexamples.length === 0 && result.invariants.length === 0 && result.findings.length === 0 && result.coverage === null;
}
function validateLifecycle(result) {
  const classification = result.exitClassification; const termination = result.terminationReason;
  if (classification === 'success' || classification === 'tool_failure' || classification === 'parser_error') { if (termination !== 'completed') fail('lifecycle_mismatch', '$.terminationReason'); }
  else if (classification !== termination) fail('lifecycle_mismatch', '$.terminationReason');
  if (termination === 'completed') {
    if (classification !== 'parser_error' && result.exitCode === null) fail('invalid_exit_code_state', '$.exitCode');
    if (classification === 'success' && result.exitCode !== 0) fail('lifecycle_mismatch', '$.exitCode');
  } else if (result.exitCode !== null) fail('invalid_exit_code_state', '$.exitCode');
  if (classification === 'parser_error') {
    if (result.parserErrors.length !== 1) fail('parser_error_cardinality', '$.parserErrors');
    if (!evidenceArraysAreEmpty(result) || result.parserWarnings.length !== 0 || result.truncated !== false || Object.keys(result.summary).length !== 0) fail('terminal_evidence_present', '$');
  } else if (result.parserErrors.length !== 0) fail('unexpected_parser_error', '$.parserErrors');
  if (termination !== 'completed') {
    if (!evidenceArraysAreEmpty(result) || result.parserWarnings.length !== 0 || result.parserErrors.length !== 0 || result.truncated !== false || Object.keys(result.summary).length !== 1 || result.summary.terminationReason !== termination) fail('terminal_evidence_present', '$');
  }
}
function validateCanonicalCollections(result) {
  assertCanonicalArray(result.diagnostics, '$.diagnostics', (left, right) => compareTuple([left.location.path, left.location.start ?? -1, left.location.end ?? -1, left.severity, left.category, left.message, canonicalStringify(left)], [right.location.path, right.location.start ?? -1, right.location.end ?? -1, right.severity, right.category, right.message, canonicalStringify(right)]));
  if (result.profileId === 'foundry-test-v1') assertCanonicalArray(result.tests, '$.tests', (left, right) => compareTuple([left.suite, left.name, left.status, left.durationMs, left.reason ?? '', canonicalStringify(left)], [right.suite, right.name, right.status, right.durationMs, right.reason ?? '', canonicalStringify(right)]));
  else if (result.profileId === 'foundry-fuzz-v1') assertCanonicalArray(result.tests, '$.tests', (left, right) => compareTuple([left.test, left.seed, left.status, left.runs, canonicalStringify(left)], [right.test, right.seed, right.status, right.runs, canonicalStringify(right)]));
  assertCanonicalArray(result.counterexamples, '$.counterexamples', (left, right) => {
    const leftIdentity = Object.hasOwn(left, 'test') ? [left.test, left.seed] : [left.contract, left.invariant, left.seed];
    const rightIdentity = Object.hasOwn(right, 'test') ? [right.test, right.seed] : [right.contract, right.invariant, right.seed];
    return compareTuple([...leftIdentity, canonicalStringify(left)], [...rightIdentity, canonicalStringify(right)]);
  });
  assertCanonicalArray(result.invariants, '$.invariants', (left, right) => compareTuple([left.contract, left.name, left.seed, left.status, left.runs, left.depth, canonicalStringify(left.counterexample), canonicalStringify(left.trace), canonicalStringify(left)], [right.contract, right.name, right.seed, right.status, right.runs, right.depth, canonicalStringify(right.counterexample), canonicalStringify(right.trace), canonicalStringify(right)]));
  assertCanonicalArray(result.findings, '$.findings', (left, right) => compareTuple([left.detector, left.locations[0]?.path ?? '', left.description, left.impact, left.confidence, JSON.stringify(left.locations), canonicalStringify(left)], [right.detector, right.locations[0]?.path ?? '', right.description, right.impact, right.confidence, JSON.stringify(right.locations), canonicalStringify(right)]));
  assertCanonicalArray(result.parserWarnings, '$.parserWarnings', (left, right) => compareTuple([left.code, left.path, left.omitted, canonicalStringify(left)], [right.code, right.path, right.omitted, canonicalStringify(right)]));
}
export function validatePhase4ToolResult(value) {
  const result = sanitizeExternalValue(value, '$');
  plainObject(result, '$'); exactKeys(result, TOP_LEVEL_KEYS, '$');
  if (result.schemaVersion !== TOOL_RESULT_SCHEMA_VERSION) fail('invalid_schema_version', '$.schemaVersion');
  boundedString(result.profileId, '$.profileId', 160); boundedString(result.parserVersion, '$.parserVersion', 160);
  const expectedParser = PARSER_VERSIONS[result.profileId]; if (!expectedParser) fail('unknown_profile_id', '$.profileId');
  if (result.parserVersion !== expectedParser) fail('profile_parser_mismatch', '$.parserVersion');
  enumValue(result.exitClassification, '$.exitClassification', CLASSIFICATIONS); enumValue(result.terminationReason, '$.terminationReason', TERMINATIONS);
  boundedInteger(result.durationMs, '$.durationMs', 0, MAX_DURATION_MS); nullableInteger(result.exitCode, '$.exitCode', 0, 255); booleanValue(result.truncated, '$.truncated');
  boundedArray(result.diagnostics, '$.diagnostics', MAX_FINDINGS); result.diagnostics.forEach((item, index) => validateDiagnostic(item, `$.diagnostics[${index}]`));
  boundedArray(result.tests, '$.tests', MAX_TEST_CASES); result.tests.forEach((item, index) => { if (isPlainObject(item) && Object.hasOwn(item, 'suite')) validateUnitTest(item, `$.tests[${index}]`); else validateFuzzTest(item, `$.tests[${index}]`); });
  boundedArray(result.counterexamples, '$.counterexamples', MAX_TEST_CASES); result.counterexamples.forEach((item, index) => validateCounterexample(item, `$.counterexamples[${index}]`));
  boundedArray(result.invariants, '$.invariants', MAX_TEST_CASES); result.invariants.forEach((item, index) => validateInvariant(item, `$.invariants[${index}]`));
  boundedArray(result.findings, '$.findings', MAX_FINDINGS); result.findings.forEach((item, index) => validateFinding(item, `$.findings[${index}]`));
  if (result.coverage !== null) validateCoverage(result.coverage, '$.coverage');
  boundedArray(result.parserWarnings, '$.parserWarnings', MAX_WARNINGS); result.parserWarnings.forEach((item, index) => validateWarning(item, `$.parserWarnings[${index}]`));
  boundedArray(result.parserErrors, '$.parserErrors', 1); result.parserErrors.forEach((item, index) => validateParserError(item, `$.parserErrors[${index}]`)); validateSummary(result.summary, '$.summary');
  validateCanonicalCollections(result); const hasTruncation = result.parserWarnings.some((warning) => warning.code === 'truncated');
  if (result.truncated !== hasTruncation) fail('truncation_mismatch', '$.truncated'); validateLifecycle(result);
  if (result.terminationReason === 'completed' && result.exitClassification !== 'parser_error') validateProfileEvidence(result);
  return deepFreeze(result);
}
