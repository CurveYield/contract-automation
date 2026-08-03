import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhase5ToolResult, validatePhase5ResultForProfile } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { createPhase5ToolCatalog, assertPhase5PackageCompatibility } from '../packages/audit-phase5-tool-catalog/src/index.mjs';
import { getPhase5ProfileTemplate, createPublishedPhase5ProfileContract } from '../packages/audit-phase5-profile-contracts/src/index.mjs';

function hardhatResult() {
  return {
    schemaVersion: 'phase5-tool-result-v1', profileId: 'hardhat-test-v1', parserVersion: 'hardhat-test-parser-v1',
    classification: 'success', durationMs: 1, exitCode: 0,
    hardhatTests: [{ file: 'test/Example.test.js', suite: 'Example', name: 'works', status: 'passed', durationMs: 1, errorMessage: null }],
    echidnaProperties: [], mutationResults: [], dependencyFindings: [],
    evidence: [{ schemaVersion: 'phase5-parser-evidence-v1', type: 'hardhat-test-summary', recordCount: 1 }],
    artifacts: [], parserErrors: [], summary: { passed: 1, failed: 0, skipped: 0, total: 1 }
  };
}

test('strict result contract returns a recursively frozen defensive clone', () => {
  const source = hardhatResult();
  const result = validatePhase5ToolResult(source);
  assert.notEqual(result, source);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.hardhatTests[0]), true);
  source.hardhatTests[0].name = 'changed';
  assert.equal(result.hardhatTests[0].name, 'works');
});

test('profile/parser substitution, extra keys, and custom prototypes fail', () => {
  const profile = getPhase5ProfileTemplate('hardhat-test-v1');
  assert.throws(() => validatePhase5ResultForProfile(profile, { ...hardhatResult(), profileId: 'echidna-v1', parserVersion: 'echidna-parser-v1', hardhatTests: [] }), /profile|summary/i);
  assert.throws(() => validatePhase5ToolResult({ ...hardhatResult(), extra: true }), /keys/i);
  const hostile = hardhatResult();
  Object.setPrototypeOf(hostile, { hostile: true });
  assert.throws(() => validatePhase5ToolResult(hostile), /plain object/i);
});

test('lifecycle inconsistencies and conflicting duplicates fail deterministically', () => {
  assert.throws(() => validatePhase5ToolResult({ ...hardhatResult(), classification: 'timeout', exitCode: 0 }), /terminal result|lifecycle/i);
  const mutation = {
    schemaVersion:'phase5-tool-result-v1', profileId:'mutation-v1', parserVersion:'mutation-parser-v1', classification:'findings', durationMs:1, exitCode:1,
    hardhatTests:[], echidnaProperties:[], dependencyFindings:[], evidence:[], artifacts:[], parserErrors:[],
    mutationResults:[
      { id:'m1', status:'killed', operator:'binary-op-mutation', file:'contracts/A.sol', line:1, column:1, killedBy:'test A' },
      { id:'m1', status:'survived', operator:'binary-op-mutation', file:'contracts/A.sol', line:1, column:1, killedBy:null }
    ],
    summary:{ killed:1, survived:1, timedOut:0, invalid:0, total:2, mutationScore:50 }
  };
  assert.throws(() => validatePhase5ToolResult(mutation), (error) => error.code === 'conflicting_duplicate');
  assert.throws(() => validatePhase5ToolResult({ ...mutation, mutationResults:[...mutation.mutationResults].reverse() }), (error) => error.code === 'conflicting_duplicate');
});

test('catalog is exact, sorted, inert, and admits only validated publication contracts', () => {
  const catalog = createPhase5ToolCatalog();
  assert.deepEqual(catalog.map((item) => item.profileId), [...catalog.map((item) => item.profileId)].sort());
  assert.deepEqual(new Set(catalog.map((item) => item.profileId)), new Set(['hardhat-test-v1','echidna-v1','mutation-v1','dependency-scan-v1']));
  assert.equal(catalog.every((item) => !item.runnable && !item.executionEnabled && item.executorState === 'unavailable' && item.digest === null), true);
  const published = createPublishedPhase5ProfileContract('hardhat-test-v1', { digest: `sha256:${'a'.repeat(64)}`, publishedAt: '2026-08-01T00:00:00.000Z' });
  const admitted = createPhase5ToolCatalog([published]);
  assert.equal(admitted.find((item) => item.profileId === 'hardhat-test-v1').digest, `sha256:${'a'.repeat(64)}`);
  assert.throws(() => createPhase5ToolCatalog([published, published]), /duplicate/i);
});

test('cross-package compatibility gate proves exact profile/parser/catalog set', () => {
  const result = assertPhase5PackageCompatibility();
  assert.equal(result.compatible, true);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.executorState, 'unavailable');
});
