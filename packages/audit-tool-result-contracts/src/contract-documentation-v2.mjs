import {
  CLASSIFICATIONS,
  MAX_FINDINGS,
  MAX_NESTING_DEPTH,
  MAX_NUMERIC_VALUE,
  MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES,
  MAX_TRACE_ENTRIES,
  PARSER_VERSIONS,
  TERMINATIONS,
  TOOL_RESULT_SCHEMA_VERSION,
  TOP_LEVEL_KEYS,
  deepFreeze
} from './result-primitives-v1.mjs';

export const PHASE4_TOOL_RESULT_DOCUMENTATION_VERSION = 'phase4-tool-result-documentation-v2';

export const PHASE4_TOOL_RESULT_DOCUMENTATION = deepFreeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://curveyield.com/audit/schemas/phase4-tool-result-contract-v2.schema.json',
  title: 'CurveYield Phase 4 normalized tool result runtime contract documentation v2',
  description: 'Compact deterministic documentation for the authoritative in-process validator. The runtime validator remains authoritative.',
  type: 'object',
  additionalProperties: false,
  required: [...TOP_LEVEL_KEYS],
  properties: Object.fromEntries(TOP_LEVEL_KEYS.map((key) => [key, { 'x-curveyield-runtime-required': true }])),
  'x-curveyield-profile-parser-pairs': { ...PARSER_VERSIONS },
  'x-curveyield-result-schema-version': TOOL_RESULT_SCHEMA_VERSION,
  'x-curveyield-classifications': [...CLASSIFICATIONS],
  'x-curveyield-termination-reasons': [...TERMINATIONS],
  'x-curveyield-runtime-bounds': {
    findings: MAX_FINDINGS,
    tests: MAX_TEST_CASES,
    counterexamples: MAX_TEST_CASES,
    invariants: MAX_TEST_CASES,
    traceEntries: MAX_TRACE_ENTRIES,
    sourceReferences: MAX_SOURCE_REFERENCES,
    numericAbsoluteValue: MAX_NUMERIC_VALUE,
    nestingDepth: MAX_NESTING_DEPTH
  },
  'x-curveyield-runtime-authoritative': true
});

export function serializePhase4ToolResultDocumentation() {
  return `${JSON.stringify(PHASE4_TOOL_RESULT_DOCUMENTATION, null, 2)}\n`;
}
