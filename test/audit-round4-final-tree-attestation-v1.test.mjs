import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MANIFEST_PATH = 'docs/audit/round4/integration/2026-08-03-round4-final-tree-attestation-v1.json';
const RELEASE_BINDING_PATH = 'docs/audit/round5/release-source-binding-v1.json';

const APPROVED_BASE_SHA = 'bbb4cac794865f84b65ee78a2fc78d391421c759';
const PRE_ATTESTATION_HEAD_SHA = '136d166fa87c50ab95b3083fa4317df85850d8ac';
const ACCEPTED_SOURCE_SHA = '3da6b10f240e2abd031195f440c7cd80b72b691b';
const ACCEPTED_MERGE_REF_SHA = '311311768f3e0465d0583f2be0a0f7d67215fa52';
const ATTESTED_PATH_COUNT = 198;
const CHANGED_PATH_COUNT = 202;
const ATTESTED_PATH_DIGEST_SHA256 = '22ee6ee759c027189b9e8887e584c976e378a6de917a20acb0e5275e3a1afc16';
const MANIFEST_BLOB_SHA = '4b98c2b00a89204a2d3152f568f6986123b13fac';
const RELEASE_BINDING_BLOB_SHA = '1291bc67588f7a8038a4a7b1ee8a7ef8e08791e6';

const EXCLUDED_SELF_REFERENTIAL_PATHS = Object.freeze([
  'packages/audit-integration-round4/src/live-evidence-gates.mjs',
  'test/audit-round4-integration-live-evidence-v1.test.mjs',
  'docs/audit/round4/integration/2026-08-03-round4-final-tree-attestation-v1.json',
  'test/audit-round4-final-tree-attestation-v1.test.mjs'
]);

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function readImmutableJson(path, expectedBlobSha) {
  const bytes = readFileSync(path);
  assert.equal(
    gitBlobSha(bytes),
    expectedBlobSha,
    `${path} changed after immutable acceptance`
  );
  return JSON.parse(bytes.toString('utf8'));
}

test('Round 4 immutable attestation record remains bound after later release rounds', () => {
  const manifest = readImmutableJson(MANIFEST_PATH, MANIFEST_BLOB_SHA);

  assert.equal(manifest.schemaVersion, 'round4-final-tree-attestation-v1');
  assert.equal(manifest.repository, 'CurveYield/contract-automation');
  assert.equal(manifest.pullRequest, 139);
  assert.equal(manifest.approvedBaseSha, APPROVED_BASE_SHA);
  assert.equal(manifest.preAttestationHeadSha, PRE_ATTESTATION_HEAD_SHA);
  assert.equal(manifest.attestedPathCount, ATTESTED_PATH_COUNT);
  assert.equal(manifest.attestedPathDigestSha256, ATTESTED_PATH_DIGEST_SHA256);
  assert.equal(manifest.changedPathCountAfterAttestation, CHANGED_PATH_COUNT);
  assert.deepEqual(manifest.excludedSelfReferentialPaths, EXCLUDED_SELF_REFERENTIAL_PATHS);
  assert.equal(manifest.manualWorkflowDispatchOrRerun, false);
  assert.equal(manifest.liveSimulationExecutedByAttestation, false);
  assert.equal(manifest.productionSecretsReadOrChanged, false);
  assert.equal(manifest.workerOwnedStatusOrAckModified, false);

  const releaseBinding = readImmutableJson(RELEASE_BINDING_PATH, RELEASE_BINDING_BLOB_SHA);
  assert.equal(releaseBinding.schemaVersion, 'round5-release-source-binding-v1');
  assert.equal(releaseBinding.releaseBindingId, 'round5-release-source-3da6b10-v1');
  assert.equal(releaseBinding.round4PullRequest, 139);
  assert.equal(releaseBinding.acceptedBaseSha, APPROVED_BASE_SHA);
  assert.equal(releaseBinding.acceptedSourceSha, ACCEPTED_SOURCE_SHA);
  assert.equal(releaseBinding.acceptedMergeRefSha, ACCEPTED_MERGE_REF_SHA);
  assert.equal(releaseBinding.changedPathCount, CHANGED_PATH_COUNT);
  assert.equal(releaseBinding.exactTreeAttestation.path, MANIFEST_PATH);
  assert.equal(releaseBinding.exactTreeAttestation.attestedPathCount, ATTESTED_PATH_COUNT);
  assert.equal(releaseBinding.exactTreeAttestation.directlyValidatedSelfReferentialPathCount, 4);
  assert.equal(releaseBinding.exactTreeAttestation.digestSha256, ATTESTED_PATH_DIGEST_SHA256);
  assert.deepEqual(releaseBinding.exactHeadWorkflowRuns, [30788571549, 30788571507]);
  assert.equal(releaseBinding.verification.repositoryTestsFailed, 0);
  assert.equal(releaseBinding.verification.manualWorkflowDispatchOrRerun, false);
  assert.equal(releaseBinding.verification.liveSimulationExecutedByOrchestrator, false);
  assert.equal(releaseBinding.staticAcceptance, 'ACCEPT');
});
