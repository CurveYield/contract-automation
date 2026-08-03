import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const RECEIPT_PATH = 'docs/audit/round5/production-test-static-readiness-receipt-v1.json';
const VERIFIED_PACKAGE_HEAD_SHA = '2a66733192c02d253a63b25d98f02222a3265f52';
const RELEASE_BINDING_ID = 'round5-release-source-3da6b10-v1';

const PACKAGE_PATHS = Object.freeze([
  'docs/audit/round5/README_v1.md',
  'docs/audit/round5/deployment-preflight-manifest-v1.json',
  'docs/audit/round5/observability-redaction-manifest-v1.json',
  'docs/audit/round5/production-authorization-gate-v1.json',
  'docs/audit/round5/production-resource-manifest-v1.json',
  'docs/audit/round5/production-test-manifest-v1.json',
  'docs/audit/round5/release-source-binding-v1.json',
  'docs/audit/round5/rollback-recovery-manifest-v1.json',
  'docs/audit/round5/secret-variable-binding-manifest-v1.json',
  'docs/audit/round5/trusted-v27-live-regression-contract-v1.json',
  'docs/superpowers/plans/2026-08-03-round5-production-test-preparation-v1.md',
  'docs/superpowers/specs/2026-08-03-round5-production-test-preparation-design-v1.md',
  'packages/runner/test/audit-round5-production-readiness-v1.test.mjs',
  'packages/runner/test/audit-round5-readiness-package-index-v1.test.mjs'
]);

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function buildPackageAggregate() {
  const entries = PACKAGE_PATHS.map((path) => {
    assert.ok(existsSync(path), `missing static readiness package path: ${path}`);
    return `${path}\0${gitBlobSha(readFileSync(path))}`;
  });
  return {
    pathCount: entries.length,
    digest: createHash('sha256').update(`${entries.join('\n')}\n`, 'utf8').digest('hex')
  };
}

test('Round 5 static readiness receipt binds the verified package and leaves live gates closed', () => {
  assert.deepEqual(PACKAGE_PATHS, [...PACKAGE_PATHS].sort());
  assert.equal(PACKAGE_PATHS.length, 14);

  const aggregate = buildPackageAggregate();
  assert.ok(
    existsSync(RECEIPT_PATH),
    `missing Round 5 static readiness receipt; pathCount=${aggregate.pathCount} digest=${aggregate.digest}`
  );

  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
  assert.equal(receipt.schemaVersion, 'round5-production-test-static-readiness-receipt-v1');
  assert.equal(receipt.releaseBindingId, RELEASE_BINDING_ID);
  assert.equal(receipt.verifiedPackageHeadSha, VERIFIED_PACKAGE_HEAD_SHA);
  assert.equal(receipt.packagePathCount, aggregate.pathCount);
  assert.equal(receipt.packageAggregateDigestSha256, aggregate.digest);
  assert.deepEqual(receipt.verifiedPackageWorkflowRuns, [30790244219, 30790244240]);
  assert.equal(receipt.staticProductionTestReadiness, 'ACCEPT');
  assert.equal(receipt.productionTestingReady, true);
  assert.equal(receipt.promotionAuthorized, false);
  assert.equal(receipt.credentialNameReadinessAuthorized, false);
  assert.equal(receipt.deploymentAuthorized, false);
  assert.equal(receipt.liveProductionTestingAuthorized, false);
  assert.equal(receipt.manualWorkflowDispatchOrRerun, false);
  assert.equal(receipt.liveSimulationExecutedByOrchestrator, false);
});
