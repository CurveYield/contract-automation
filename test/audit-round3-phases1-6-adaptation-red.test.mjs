import test from 'node:test';
import assert from 'node:assert/strict';

// These imports intentionally name the accepted hardened module graph.
// At the pinned Round 3 starting SHA, the files were absent because issue #103
// collapsed them into compact modules. The test becomes GREEN only after exact
// accepted-source restoration.
import { plainObject as validatePhase5PlainObject } from '../packages/audit-phase5-result-contracts/src/boundary.mjs';
import { validateHardhatRecords } from '../packages/audit-phase5-result-contracts/src/records.mjs';
import { fail as phase5Fail } from '../packages/audit-phase5-result-contracts/src/errors.mjs';
import { PHASE6_BOUNDS, scanPhase6ForbiddenFields } from '../packages/audit-phase6-profile-contracts/src/base.mjs';
import { PHASE6_PROFILE_TEMPLATES } from '../packages/audit-phase6-profile-contracts/src/profiles.mjs';
import { validateFormalResult } from '../packages/audit-phase6-profile-contracts/src/schemas.mjs';

const capture = (fn) => {
  try { fn(); return null; } catch (error) { return error; }
};

test('accepted Phase 5 hardened boundary modules exist and reject hostile values', () => {
  assert.equal(typeof validatePhase5PlainObject, 'function');
  assert.equal(typeof validateHardhatRecords, 'function');
  assert.equal(typeof phase5Fail, 'function');
  const error = capture(() => validatePhase5PlainObject([], '$'));
  assert.equal(error?.code, 'invalid_object');
});

test('accepted Phase 6 profile module graph exists and remains execution-disabled', () => {
  assert.equal(typeof scanPhase6ForbiddenFields, 'function');
  assert.ok(PHASE6_BOUNDS.inputBytes > 0);
  assert.deepEqual(Object.keys(PHASE6_PROFILE_TEMPLATES).sort(), [
    'formal-obligations-v1', 'halmos-v1', 'solidity-smt-v1'
  ]);
  for (const template of Object.values(PHASE6_PROFILE_TEMPLATES)) {
    assert.equal(template.runnable, false);
    assert.equal(template.executionEnabled, false);
    assert.equal(template.executor.available, false);
  }
});

test('accepted Phase 6 formal-result validator rejects dangling references', () => {
  const error = capture(() => validateFormalResult({
    schemaVersion: 'formal-result-v1',
    profileId: 'halmos-v1',
    outcome: 'disproved',
    obligations: [], assertions: [], models: [], traces: [],
    counterexamples: [{
      id: 'counterexample-1', obligationId: 'missing-obligation',
      assertionId: null, modelId: null, traceId: null,
      summary: 'bounded counterexample', sourceReferenceIds: []
    }],
    diagnostics: [], sourceReferences: [], parserWarnings: [], truncated: false
  }));
  assert.ok(error);
});
