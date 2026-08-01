import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE4_TOOL_RESULT_DOCUMENTATION,
  serializePhase4ToolResultDocumentation
} from '../packages/audit-tool-result-contracts/src/index.mjs';

test('Phase 4 schema documentation is deterministic and complete', () => {
  assert.deepEqual(JSON.parse(serializePhase4ToolResultDocumentation()), PHASE4_TOOL_RESULT_DOCUMENTATION);
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.required.length, 17);
  assert.equal(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION.properties).length, 17);
  assert.equal(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-profile-parser-pairs']).length, 6);
  assert.equal(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-profile-evidence-rules']).length, 6);
  assert.equal(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-runtime-bounds']).length, 21);
  assert.equal(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION.$defs).length >= 15, true);
});

test('schema documentation remains advisory and names the runtime validator authority', () => {
  const authority = PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-runtime-authority'];
  assert.equal(authority.validator, 'validatePhase4ToolResult');
  assert.equal(authority.standardSchemaIsAdvisory, true);
  assert.equal(authority.returnsRecursivelyFrozenDefensiveCanonicalClone, true);
  assert.equal(authority.rejectsAccessorsSymbolsNonEnumerableSparseArraysCyclesAndHostileReflection, true);
});
