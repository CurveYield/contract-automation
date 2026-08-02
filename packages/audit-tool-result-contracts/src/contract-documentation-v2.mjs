import {
  CLASSIFICATIONS,
  MAX_CATEGORY_LENGTH,
  MAX_COUNTEREXAMPLE_BYTES,
  MAX_COVERAGE_VALUE,
  MAX_DURATION_MS,
  MAX_FINDINGS,
  MAX_LINE_NUMBER,
  MAX_NAME_LENGTH,
  MAX_NESTING_DEPTH,
  MAX_NUMERIC_VALUE,
  MAX_OBJECT_FIELDS,
  MAX_PATH_LENGTH,
  MAX_SEED,
  MAX_SOURCE_REFERENCES,
  MAX_STRING_LENGTH,
  MAX_SUMMARY_FIELDS,
  MAX_TEST_CASES,
  MAX_TRACE_ENTRIES,
  MAX_WARNINGS,
  PARSER_VERSIONS,
  TERMINATIONS,
  TOOL_RESULT_SCHEMA_VERSION,
  TOP_LEVEL_KEYS,
  TRUNCATION_MESSAGE,
  deepFreeze
} from './result-primitives-v1.mjs';

export const PHASE4_TOOL_RESULT_DOCUMENTATION_VERSION = 'phase4-tool-result-documentation-v2';

const safeString = (maximum = MAX_STRING_LENGTH) => ({
  type: 'string',
  maxLength: maximum,
  'x-curveyield-reject-nul': true
});
const safeName = () => safeString(MAX_NAME_LENGTH);
const safeCategory = () => safeString(MAX_CATEGORY_LENGTH);
const boundedInteger = (minimum, maximum) => ({
  type: 'integer', minimum, maximum, 'x-curveyield-reject-negative-zero': true
});
const boundedNumber = (minimum, maximum) => ({
  type: 'number', minimum, maximum, 'x-curveyield-finite-only': true, 'x-curveyield-reject-negative-zero': true
});
const ordinaryArray = (items, maxItems) => ({
  type: 'array', maxItems, items, 'x-curveyield-ordinary-dense-array': true
});

const profileParserPairs = Object.freeze(Object.fromEntries(
  Object.entries(PARSER_VERSIONS).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
));

const profileEvidenceRules = Object.freeze({
  'coverage-forge-v1': {
    parserVersion: PARSER_VERSIONS['coverage-forge-v1'],
    evidence: { coverage: 'required', diagnostics: 'empty', tests: 'empty', counterexamples: 'empty', invariants: 'empty', findings: 'empty' },
    summary: { required: ['files'], optional: [], valueType: 'nonnegative-integer' },
    classification: 'success iff exitCode is zero; tool_failure iff exitCode is nonzero'
  },
  'foundry-fuzz-v1': {
    parserVersion: PARSER_VERSIONS['foundry-fuzz-v1'],
    evidence: { tests: 'fuzz-tests', counterexamples: 'fuzz-counterexamples', diagnostics: 'empty', invariants: 'empty', findings: 'empty', coverage: 'null' },
    summary: { required: ['passed', 'failed', 'total'], optional: ['observedTotal', 'observedPassed', 'observedFailed'], valueType: 'nonnegative-integer' },
    classification: 'failure iff exitCode is nonzero or failed is nonzero',
    identity: 'each counterexample must match a failed test by test and seed'
  },
  'foundry-invariant-v1': {
    parserVersion: PARSER_VERSIONS['foundry-invariant-v1'],
    evidence: { invariants: 'invariants', counterexamples: 'invariant-counterexamples', diagnostics: 'empty', tests: 'empty', findings: 'empty', coverage: 'null' },
    summary: { required: ['passed', 'failed', 'total'], optional: ['observedTotal', 'observedPassed', 'observedFailed'], valueType: 'nonnegative-integer' },
    classification: 'failure iff exitCode is nonzero or failed is nonzero',
    identity: 'each top-level counterexample must match a failed invariant by contract, name, seed, value, and trace'
  },
  'foundry-test-v1': {
    parserVersion: PARSER_VERSIONS['foundry-test-v1'],
    evidence: { tests: 'unit-tests', diagnostics: 'empty', counterexamples: 'empty', invariants: 'empty', findings: 'empty', coverage: 'null' },
    summary: { required: ['passed', 'failed', 'skipped', 'total'], optional: ['observedTotal', 'observedPassed', 'observedFailed', 'observedSkipped'], valueType: 'nonnegative-integer' },
    classification: 'failure iff exitCode is nonzero or failed is nonzero'
  },
  'slither-v1': {
    parserVersion: PARSER_VERSIONS['slither-v1'],
    evidence: { findings: 'findings', diagnostics: 'empty', tests: 'empty', counterexamples: 'empty', invariants: 'empty', coverage: 'null' },
    summary: { required: ['findings', 'high'], optional: [], valueType: 'nonnegative-integer' },
    classification: 'success requires exitCode zero; tool_failure may represent nonzero exit or raw tool failure'
  },
  'solidity-compile-v1': {
    parserVersion: PARSER_VERSIONS['solidity-compile-v1'],
    evidence: { diagnostics: 'diagnostics', tests: 'empty', counterexamples: 'empty', invariants: 'empty', findings: 'empty', coverage: 'null' },
    summary: { required: ['contracts', 'errors', 'warnings', 'diagnostics'], optional: ['observedDiagnostics'], valueType: 'nonnegative-integer' },
    classification: 'failure iff exitCode is nonzero or errors is nonzero'
  }
});

const lifecycleRules = Object.freeze({
  completed: {
    allowedClassifications: ['success', 'tool_failure', 'parser_error'],
    exitCode: 'integer-0-to-255-except-parser-error-may-be-null'
  },
  timeout: { classification: 'timeout', exitCode: null, evidence: 'empty', summary: { terminationReason: 'timeout' } },
  cancelled: { classification: 'cancelled', exitCode: null, evidence: 'empty', summary: { terminationReason: 'cancelled' } },
  resource_exhaustion: { classification: 'resource_exhaustion', exitCode: null, evidence: 'empty', summary: { terminationReason: 'resource_exhaustion' } },
  parser_error: { terminationReason: 'completed', parserErrors: 1, evidence: 'empty', parserWarnings: 0, truncated: false, summary: 'empty' },
  truncation: { truncated: 'equals-presence-of-canonical-truncated-warning' }
});

export const PHASE4_TOOL_RESULT_DOCUMENTATION = deepFreeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://curveyield.com/audit/schemas/phase4-tool-result-contract-v2.schema.json',
  title: 'CurveYield Phase 4 normalized tool result runtime contract documentation v2',
  description: 'Deterministic documentation for the authoritative in-process tool-result-v1 validator. Custom x-curveyield keywords describe runtime-only canonicalization and lifecycle constraints that standard JSON Schema cannot express.',
  type: 'object',
  additionalProperties: false,
  required: [...TOP_LEVEL_KEYS],
  properties: {
    schemaVersion: { const: TOOL_RESULT_SCHEMA_VERSION },
    profileId: { type: 'string', enum: Object.keys(profileParserPairs), maxLength: MAX_CATEGORY_LENGTH },
    parserVersion: { type: 'string', enum: Object.values(profileParserPairs), maxLength: MAX_CATEGORY_LENGTH },
    exitClassification: { type: 'string', enum: [...CLASSIFICATIONS], maxLength: MAX_CATEGORY_LENGTH },
    terminationReason: { type: 'string', enum: [...TERMINATIONS], maxLength: MAX_CATEGORY_LENGTH },
    durationMs: boundedInteger(0, MAX_DURATION_MS),
    exitCode: { anyOf: [{ type: 'null' }, boundedInteger(0, 255)] },
    truncated: { type: 'boolean' },
    diagnostics: ordinaryArray({ $ref: '#/$defs/diagnostic' }, MAX_FINDINGS),
    tests: ordinaryArray({ oneOf: [{ $ref: '#/$defs/unitTest' }, { $ref: '#/$defs/fuzzTest' }] }, MAX_TEST_CASES),
    counterexamples: ordinaryArray({ oneOf: [{ $ref: '#/$defs/fuzzCounterexample' }, { $ref: '#/$defs/invariantCounterexample' }] }, MAX_TEST_CASES),
    invariants: ordinaryArray({ $ref: '#/$defs/invariant' }, MAX_TEST_CASES),
    findings: ordinaryArray({ $ref: '#/$defs/finding' }, MAX_FINDINGS),
    coverage: { oneOf: [{ type: 'null' }, { $ref: '#/$defs/coverage' }] },
    parserWarnings: ordinaryArray({ $ref: '#/$defs/parserWarning' }, MAX_WARNINGS),
    parserErrors: ordinaryArray({ $ref: '#/$defs/parserError' }, 1),
    summary: {
      type: 'object', maxProperties: MAX_SUMMARY_FIELDS, additionalProperties: { $ref: '#/$defs/summaryValue' },
      'x-curveyield-plain-data-object': true, 'x-curveyield-canonical-key-order': 'code-unit-ascending'
    }
  },
  $defs: {
    boundedJson: {
      description: 'JSON-like value bounded and canonicalized recursively by the runtime validator.',
      'x-curveyield-max-depth': MAX_NESTING_DEPTH,
      'x-curveyield-max-container-entries': MAX_OBJECT_FIELDS,
      'x-curveyield-max-string-length': MAX_STRING_LENGTH,
      'x-curveyield-max-absolute-number': MAX_NUMERIC_VALUE,
      'x-curveyield-plain-data-only': true,
      'x-curveyield-canonical-object-key-order': 'code-unit-ascending'
    },
    sourceLocation: {
      type: 'object', additionalProperties: false, required: ['path', 'start', 'end'],
      properties: {
        path: { $ref: '#/$defs/safePath' },
        start: { anyOf: [{ type: 'null' }, boundedInteger(0, MAX_NUMERIC_VALUE)] },
        end: { anyOf: [{ type: 'null' }, boundedInteger(0, MAX_NUMERIC_VALUE)] }
      },
      'x-curveyield-end-not-before-start': true
    },
    safePath: {
      ...safeString(MAX_PATH_LENGTH),
      pattern: '^(?!/)(?!\\\\)(?![A-Za-z]:)(?![A-Za-z][A-Za-z0-9+.-]*:)(?!.*(?:^|/)\\.{1,2}(?:/|$))(?!.*\\\\)(?!.*[\\u0000-\\u001f\\u007f]).*$'
    },
    diagnostic: {
      type: 'object', additionalProperties: false,
      required: ['severity', 'category', 'component', 'message', 'formattedMessage', 'location'],
      properties: {
        severity: { type: 'string', enum: ['error', 'warning', 'info'] },
        category: safeCategory(), component: safeCategory(), message: safeString(), formattedMessage: safeString(),
        location: { $ref: '#/$defs/sourceLocation' }
      }
    },
    unitTest: {
      type: 'object', additionalProperties: false, required: ['suite', 'name', 'status', 'durationMs', 'reason'],
      properties: { suite: safeName(), name: safeName(), status: { type: 'string', enum: ['passed', 'failed', 'skipped'] }, durationMs: boundedNumber(0, MAX_DURATION_MS), reason: { anyOf: [{ type: 'null' }, safeString()] } }
    },
    fuzzTest: {
      type: 'object', additionalProperties: false, required: ['test', 'status', 'runs', 'seed'],
      properties: { test: safeName(), status: { type: 'string', enum: ['passed', 'failed'] }, runs: boundedInteger(0, 1_000_000), seed: boundedInteger(0, MAX_SEED) }
    },
    traceEntry: {
      type: 'object', additionalProperties: false, required: ['contract', 'function', 'arguments', 'result'],
      properties: { contract: safeName(), function: safeName(), arguments: { $ref: '#/$defs/boundedJson' }, result: { $ref: '#/$defs/boundedJson' } }
    },
    trace: ordinaryArray({ $ref: '#/$defs/traceEntry' }, MAX_TRACE_ENTRIES),
    fuzzCounterexample: {
      type: 'object', additionalProperties: false, required: ['test', 'seed', 'value', 'trace'],
      properties: { test: safeName(), seed: boundedInteger(0, MAX_SEED), value: { $ref: '#/$defs/boundedJson' }, trace: { $ref: '#/$defs/trace' } },
      'x-curveyield-max-canonical-encoded-bytes': MAX_COUNTEREXAMPLE_BYTES
    },
    invariantCounterexample: {
      type: 'object', additionalProperties: false, required: ['contract', 'invariant', 'seed', 'value', 'trace'],
      properties: { contract: safeName(), invariant: safeName(), seed: boundedInteger(0, MAX_SEED), value: { $ref: '#/$defs/boundedJson' }, trace: { $ref: '#/$defs/trace' } },
      'x-curveyield-max-canonical-encoded-bytes': MAX_COUNTEREXAMPLE_BYTES
    },
    invariant: {
      type: 'object', additionalProperties: false, required: ['contract', 'name', 'status', 'runs', 'depth', 'seed', 'counterexample', 'trace'],
      properties: {
        contract: safeName(), name: safeName(), status: { type: 'string', enum: ['passed', 'failed'] }, runs: boundedInteger(0, 1_000_000),
        depth: boundedInteger(0, 10_000), seed: boundedInteger(0, MAX_SEED), counterexample: { $ref: '#/$defs/boundedJson' }, trace: { $ref: '#/$defs/trace' }
      }
    },
    sourceReference: {
      type: 'object', additionalProperties: false, required: ['path', 'lines'],
      properties: { path: { $ref: '#/$defs/safePath' }, lines: { ...ordinaryArray(boundedInteger(1, MAX_LINE_NUMBER), MAX_SOURCE_REFERENCES), uniqueItems: true, 'x-curveyield-order': 'strictly-ascending' } }
    },
    finding: {
      type: 'object', additionalProperties: false, required: ['detector', 'impact', 'confidence', 'description', 'locations'],
      properties: { detector: safeCategory(), impact: safeString(80), confidence: safeString(80), description: safeString(), locations: ordinaryArray({ $ref: '#/$defs/sourceReference' }, MAX_SOURCE_REFERENCES) }
    },
    coverageMetric: {
      type: 'object', additionalProperties: false, required: ['covered', 'total', 'percentage'],
      properties: { covered: boundedInteger(0, MAX_COVERAGE_VALUE), total: boundedInteger(0, MAX_COVERAGE_VALUE), percentage: boundedNumber(0, 100) },
      'x-curveyield-percentage-formula': 'total === 0 ? 100 : round((covered / total) * 10000) / 100',
      'x-curveyield-covered-not-greater-than-total': true
    },
    coverageFile: {
      type: 'object', additionalProperties: false, required: ['path', 'lines', 'functions', 'branches'],
      properties: { path: { $ref: '#/$defs/safePath' }, lines: { $ref: '#/$defs/coverageMetric' }, functions: { $ref: '#/$defs/coverageMetric' }, branches: { $ref: '#/$defs/coverageMetric' } }
    },
    coverage: {
      type: 'object', additionalProperties: false, required: ['files', 'totals'],
      properties: {
        files: ordinaryArray({ $ref: '#/$defs/coverageFile' }, MAX_SOURCE_REFERENCES),
        totals: { type: 'object', additionalProperties: false, required: ['lines', 'functions', 'branches'], properties: { lines: { $ref: '#/$defs/coverageMetric' }, functions: { $ref: '#/$defs/coverageMetric' }, branches: { $ref: '#/$defs/coverageMetric' } } }
      },
      'x-curveyield-totals-equal-file-sums': true
    },
    parserWarning: {
      type: 'object', additionalProperties: false, required: ['code', 'message', 'path', 'omitted'],
      properties: { code: { const: 'truncated' }, message: { const: TRUNCATION_MESSAGE }, path: safeString(), omitted: boundedInteger(1, 10_000) }
    },
    parserError: {
      type: 'object', additionalProperties: false, required: ['code', 'message', 'path'],
      properties: { code: safeString(80), message: safeString(), path: safeString() }
    },
    summaryValue: {
      anyOf: [{ type: 'null' }, { type: 'boolean' }, safeString(), boundedNumber(0, MAX_NUMERIC_VALUE)]
    }
  },
  'x-curveyield-runtime-authority': {
    validator: 'validatePhase4ToolResult',
    contractVersion: 'phase4-tool-result-contract-v1',
    documentationVersion: PHASE4_TOOL_RESULT_DOCUMENTATION_VERSION,
    standardSchemaIsAdvisory: true,
    rejectsAccessorsSymbolsNonEnumerableSparseArraysCyclesAndHostileReflection: true,
    returnsRecursivelyFrozenDefensiveCanonicalClone: true
  },
  'x-curveyield-runtime-bounds': {
    findings: MAX_FINDINGS,
    tests: MAX_TEST_CASES,
    counterexamples: MAX_TEST_CASES,
    invariants: MAX_TEST_CASES,
    traceEntries: MAX_TRACE_ENTRIES,
    sourceReferences: MAX_SOURCE_REFERENCES,
    stringLength: MAX_STRING_LENGTH,
    pathLength: MAX_PATH_LENGTH,
    nameLength: MAX_NAME_LENGTH,
    categoryLength: MAX_CATEGORY_LENGTH,
    numericAbsoluteValue: MAX_NUMERIC_VALUE,
    nestingDepth: MAX_NESTING_DEPTH,
    objectFields: MAX_OBJECT_FIELDS,
    counterexampleBytes: MAX_COUNTEREXAMPLE_BYTES,
    durationMs: MAX_DURATION_MS,
    coverageValue: MAX_COVERAGE_VALUE,
    lineNumber: MAX_LINE_NUMBER,
    seed: MAX_SEED,
    warnings: MAX_WARNINGS,
    summaryFields: MAX_SUMMARY_FIELDS,
    exitCode: 255
  },
  'x-curveyield-profile-parser-pairs': profileParserPairs,
  'x-curveyield-lifecycle-rules': lifecycleRules,
  'x-curveyield-profile-evidence-rules': profileEvidenceRules
});

export function serializePhase4ToolResultDocumentation() {
  return `${JSON.stringify(PHASE4_TOOL_RESULT_DOCUMENTATION, null, 2)}\n`;
}
