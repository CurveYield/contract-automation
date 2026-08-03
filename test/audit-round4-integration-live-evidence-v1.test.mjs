import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND4_EXTERNAL_QUARANTINE } from '../packages/audit-integration-round4/src/quarantine.mjs';

const EXPECTED_HEADS = [
  'bbb4cac794865f84b65ee78a2fc78d391421c759',
  'e26b78c2c26f3c11897e8fea397c8615fc66a5a0',
  'a70e6d762530bf0ce8c7dfd467c8b1278b6dd43d',
  '11823bb8150debcf65b87aec27a20325546f864e'
];

test('merged PR 126 replaces the stale draft quarantine with all 41 paths', () => {
  assert.equal(ROUND4_EXTERNAL_QUARANTINE.state, 'merged-security-repair-required');
  assert.equal(ROUND4_EXTERNAL_QUARANTINE.headSha, 'df2e51824d257669dac204de5bf869c80ed6e844');
  assert.equal(ROUND4_EXTERNAL_QUARANTINE.mergeCommitSha, '500de7b8752e926f7478feafb81b92586d6364ea');
  assert.equal(ROUND4_EXTERNAL_QUARANTINE.mainHeadSha, '500de7b8752e926f7478feafb81b92586d6364ea');
  assert.equal(ROUND4_EXTERNAL_QUARANTINE.changedFileCount, 41);
  assert.equal(ROUND4_EXTERNAL_QUARANTINE.paths.length, 41);
  assert.deepEqual(ROUND4_EXTERNAL_QUARANTINE.paths, [...ROUND4_EXTERNAL_QUARANTINE.paths].sort());
});

test('live Stage A registry binds four accepted code heads and reports', async () => {
  const { ROUND4_ACCEPTED_STAGE_A_INPUTS } = await import('../packages/audit-integration-round4/src/live-evidence.mjs');
  assert.deepEqual(ROUND4_ACCEPTED_STAGE_A_INPUTS.map((item) => item.reviewedCodeSnapshotSha), EXPECTED_HEADS);
  assert.deepEqual(ROUND4_ACCEPTED_STAGE_A_INPUTS.map((item) => item.reportCommentId), [5157224221, 5157596912, 5157962261, 5157176317]);
  assert.ok(ROUND4_ACCEPTED_STAGE_A_INPUTS.every(Object.isFrozen));
});

test('live ownership includes the two missing Worker 1 Phase 7-8 prefixes', async () => {
  const { ROUND4_LIVE_OWNERSHIP } = await import('../packages/audit-integration-round4/src/live-evidence.mjs');
  const phase78 = ROUND4_LIVE_OWNERSHIP.domains.find((item) => item.domain === 'phase7-8');
  assert.ok(phase78.ownedPrefixes.includes('packages/audit-phase78-service'));
  assert.ok(phase78.ownedPrefixes.includes('packages/audit-phase78-publication'));
});

test('exact accepted intake is 55 paths and disjoint from all 41 PR 126 paths', async () => {
  const { ROUND4_DISJOINT_INTAKE, analyzeRound4LiveEvidence } = await import('../packages/audit-integration-round4/src/live-evidence.mjs');
  const analysis = analyzeRound4LiveEvidence();
  assert.equal(ROUND4_DISJOINT_INTAKE.length, 55);
  assert.equal(new Set(ROUND4_DISJOINT_INTAKE.map((item) => item.path)).size, 55);
  assert.equal(analysis.quarantinedPathCount, 41);
  assert.equal(analysis.overlapCount, 0);
  assert.deepEqual(analysis.overlaps, []);
});

test('final assembled candidate is authorized by accepted repairs and exact-tree attestation', async () => {
  const { ROUND4_LIVE_GATES } = await import('../packages/audit-integration-round4/src/live-evidence.mjs');
  assert.equal(ROUND4_LIVE_GATES.finalAssembledCandidateAuthorized, true);
  assert.equal(ROUND4_LIVE_GATES.pr126SecurityRepairAccepted, true);
  assert.equal(ROUND4_LIVE_GATES.stage0ValidatorRepairAccepted, true);
  assert.equal(ROUND4_LIVE_GATES.exactTreeAttestationPresent, true);
  assert.deepEqual(ROUND4_LIVE_GATES.unresolved, []);
  assert.deepEqual(ROUND4_LIVE_GATES.resolved, [
    'pr126-security-repair-acceptance',
    'stage0-direct-takeover-validator-repair-receipt',
    'round4-final-tree-attestation-v1'
  ]);
  assert.ok(Object.isFrozen(ROUND4_LIVE_GATES));
  assert.ok(Object.isFrozen(ROUND4_LIVE_GATES.unresolved));
  assert.ok(Object.isFrozen(ROUND4_LIVE_GATES.resolved));
});
