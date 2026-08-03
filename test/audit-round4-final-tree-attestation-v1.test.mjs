import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const APPROVED_BASE_SHA = 'bbb4cac794865f84b65ee78a2fc78d391421c759';
const PRE_ATTESTATION_HEAD_SHA = '136d166fa87c50ab95b3083fa4317df85850d8ac';
const MANIFEST_PATH = 'docs/audit/round4/integration/2026-08-03-round4-final-tree-attestation-v1.json';

const ATTESTED_PATHS = Object.freeze([
  ".github/workflows/export-v27-hardhat-harness.yml",
  ".github/workflows/github-native-sim-ci.yml",
  ".github/workflows/github-native-simulate.yml",
  ".github/workflows/live-fork-engine-smoke.yml",
  ".github/workflows/live-fork-upgrade-ci.yml",
  ".github/workflows/simulate.yml",
  ".github/workflows/v27-full-live-fork.yml",
  "apps/audit-api/src/phase9-reports.mjs",
  "apps/audit-api/test/round4-hidden-provider-noninterference-v1.test.mjs",
  "apps/audit-web/src/client.mjs",
  "apps/audit-web/src/pages-round3-v1.mjs",
  "apps/audit-web/src/render.mjs",
  "apps/audit-web/src/styles.css",
  "docs/audit/round4/integration/2026-08-02-additive-public-contract-compatibility-v1.json",
  "docs/audit/round4/integration/2026-08-02-phase5-accepted-repair-intake-v1.json",
  "docs/audit/round4/integration/2026-08-02-pr126-github-native-run-job-baseline-v1.json",
  "docs/audit/round4/integration/2026-08-02-pr126-protected-workflow-baseline-v1.json",
  "docs/audit/round4/integration/2026-08-02-pr126-run-job-baseline-v1.json",
  "docs/audit/round4/integration/2026-08-02-round4-assembled-candidate-checkpoint-v1.json",
  "docs/audit/round4/integration/2026-08-02-stagea-dependency-closure-v1.json",
  "docs/audit/round4/integration/2026-08-02-stagea-dependency-closure-v2.json",
  "docs/audit/round4/integration/2026-08-02-transitive-closure-v3.json",
  "docs/audit/round4/integration/2026-08-02-worker1-manifest-blob-correction-v1.json",
  "docs/audit/round4/integration/round5-production-input-v1.json",
  "docs/audit/round4/integration/stage0-candidate-registry-v1.json",
  "docs/audit/round4/integration/stage0-path-ownership-v1.json",
  "docs/audit/round4/integration/stage0-review-v1.md",
  "docs/audit/round4/integration/stage0-unions-and-waves-v1.json",
  "docs/audit/round4/integration/stage1-disjoint-intake-plan-v1.json",
  "docs/audit/round4/integration/stage1-live-ownership-inventory-v1.json",
  "docs/audit/round4/integration/stage1-live-source-registry-v1.json",
  "docs/audit/round4/integration/stage1-overlap-report-v1.json",
  "docs/audit/round4/integration/stage1-pr126-quarantine-inventory-v1.json",
  "docs/audit/round4/worker1/2026-08-02-phase78-api-compat-review-plan-v1.md",
  "docs/audit/round4/worker1/2026-08-02-phase78-api-route-export-compatibility-v1.md",
  "docs/audit/round4/worker4/2026-08-02-worker4-stage-a-compatibility-repair-v1.md",
  "docs/audit/round4/worker4/2026-08-02-worker4-stage-a-source-review-v1.md",
  "docs/live-fork-rpc-administration.md",
  "docs/live-fork-simulation-authoring.md",
  "docs/superpowers/plans/2026-08-02-live-fork-multi-rpc-routing.md",
  "docs/superpowers/plans/2026-08-02-pr126-security-reconciliation.md",
  "docs/superpowers/specs/2026-08-02-live-fork-multi-rpc-routing-design.md",
  "docs/superpowers/specs/2026-08-02-pr126-security-reconciliation-design.md",
  "github-native-sim/jobs/live-fork-v27-v1/README.md",
  "github-native-sim/jobs/live-fork-v27-v1/patch-reviewed-v27-harness.py",
  "github-native-sim/jobs/live-fork-v27-v1/run-ci.sh",
  "github-native-sim/jobs/live-fork-v27-v1/run-v27-live-fork.mjs",
  "packages/audit-api-contracts/src/authorization.mjs",
  "packages/audit-api-contracts/src/discovery.mjs",
  "packages/audit-api-contracts/src/index.mjs",
  "packages/audit-clean-room-campaigns/src/index.mjs",
  "packages/audit-clean-room-campaigns/src/terminal-manifest.mjs",
  "packages/audit-clean-room-protocol/src/boundary.mjs",
  "packages/audit-clean-room-protocol/src/index.mjs",
  "packages/audit-clean-room-reporting/src/campaign-merge.mjs",
  "packages/audit-clean-room-reporting/src/hidden.mjs",
  "packages/audit-clean-room-reporting/src/index.mjs",
  "packages/audit-clean-room-reporting/src/provenance.mjs",
  "packages/audit-clean-room-reporting/src/relations.mjs",
  "packages/audit-controlled-merge/src/index.mjs",
  "packages/audit-controlled-merge/src/legacy-service.mjs",
  "packages/audit-controlled-merge/src/publication-storage.mjs",
  "packages/audit-controlled-merge/src/relations.mjs",
  "packages/audit-controlled-merge/src/request-state.mjs",
  "packages/audit-fork-reporting/src/checkpoint-projections.mjs",
  "packages/audit-fork-reporting/src/common.mjs",
  "packages/audit-fork-reporting/src/delete-projection.mjs",
  "packages/audit-fork-reporting/src/fork-projections.mjs",
  "packages/audit-fork-reporting/src/index.mjs",
  "packages/audit-integration-round4/package.json",
  "packages/audit-integration-round4/src/index-legacy.mjs",
  "packages/audit-integration-round4/src/index.mjs",
  "packages/audit-integration-round4/src/live-evidence-candidates.mjs",
  "packages/audit-integration-round4/src/live-evidence-intake-worker0.mjs",
  "packages/audit-integration-round4/src/live-evidence-intake-worker1-production.mjs",
  "packages/audit-integration-round4/src/live-evidence-intake-worker1-support.mjs",
  "packages/audit-integration-round4/src/live-evidence-intake-worker3.mjs",
  "packages/audit-integration-round4/src/live-evidence-intake-worker4.mjs",
  "packages/audit-integration-round4/src/live-evidence-ownership.mjs",
  "packages/audit-integration-round4/src/live-evidence.mjs",
  "packages/audit-integration-round4/src/quarantine.mjs",
  "packages/audit-phase5-parsers/src/index.mjs",
  "packages/audit-phase5-parsers/src/lifecycle-boundary.mjs",
  "packages/audit-phase5-result-contracts/package.json",
  "packages/audit-phase5-tool-catalog/package.json",
  "packages/audit-phase78-publication/src/index.mjs",
  "packages/audit-phase78-publication/src/plans.mjs",
  "packages/audit-phase78-publication/src/quota.mjs",
  "packages/audit-phase78-publication/src/recovery.mjs",
  "packages/audit-phase78-service/src/authorization.mjs",
  "packages/audit-phase78-service/src/boundary.mjs",
  "packages/audit-phase78-service/src/constants.mjs",
  "packages/audit-phase78-service/src/contracts.mjs",
  "packages/audit-phase78-service/src/digest.mjs",
  "packages/audit-phase78-service/src/errors.mjs",
  "packages/audit-phase78-service/src/index.mjs",
  "packages/audit-phase78-service/src/orchestration.mjs",
  "packages/audit-phase78-service/src/pagination.mjs",
  "packages/audit-provenance/src/contracts.mjs",
  "packages/audit-provenance/src/graph.mjs",
  "packages/audit-provenance/src/index.mjs",
  "packages/audit-r2-store/src/index.mjs",
  "packages/audit-report-view-model/src/index.mjs",
  "packages/audit-report-view-model/src/lifecycle-v1.mjs",
  "packages/audit-report-view-model/src/models-core-v1.mjs",
  "packages/audit-report-view-model/src/models-operator-v1.mjs",
  "packages/audit-report-view-model/src/models-resources-v1.mjs",
  "packages/audit-report-view-model/src/safety-v1.mjs",
  "packages/audit-ui-contracts/src/index.mjs",
  "packages/audit-web-compat/src/github-direct-v2.mjs",
  "packages/audit-web-compat/src/index-v1.mjs",
  "packages/github-native-sim/src/local-state-journal.mjs",
  "packages/github-native-sim/src/run-job-file.mjs",
  "packages/github-native-sim/src/schema.mjs",
  "packages/github-native-sim/test/local-state-journal.test.mjs",
  "packages/github-native-sim/test/run-job-file.test.mjs",
  "packages/protocol/src/index.mjs",
  "packages/protocol/src/simulation-config.mjs",
  "packages/runner/src/archive-rpc-pool.mjs",
  "packages/runner/src/fork-engine.mjs",
  "packages/runner/src/github-rpc-health-store.mjs",
  "packages/runner/src/hardhat-edr-engine.mjs",
  "packages/runner/src/live-fork-proxy.mjs",
  "packages/runner/src/live-fork-runtime.mjs",
  "packages/runner/src/live-fork-time.mjs",
  "packages/runner/src/rpc-health-ledger.mjs",
  "packages/runner/src/rpc-health-session.mjs",
  "packages/runner/src/run-job.mjs",
  "packages/runner/src/workflow.mjs",
  "packages/runner/test/archive-rpc-pool.test.mjs",
  "packages/runner/test/github-rpc-health-store.test.mjs",
  "packages/runner/test/live-fork-config.test.mjs",
  "packages/runner/test/live-fork-proxy.test.mjs",
  "packages/runner/test/live-fork-runtime-actions.test.mjs",
  "packages/runner/test/rpc-error-redaction-security.test.mjs",
  "packages/runner/test/rpc-health-ledger-security.test.mjs",
  "packages/runner/test/rpc-health-ledger.test.mjs",
  "packages/runner/test/rpc-health-session.test.mjs",
  "packages/runner/test/run-job-live-fork.test.mjs",
  "scripts/live-fork-engine-smoke.mjs",
  "scripts/rpc-health-admin.mjs",
  "test/audit-phase5-catalog-hardening-v2.test.mjs",
  "test/audit-phase5-compatibility-fixture-replay-v2.test.mjs",
  "test/audit-phase5-compatibility-helpers-v2.mjs",
  "test/audit-phase5-compatibility-mutation-vectors-v2.test.mjs",
  "test/audit-phase5-compatibility-static-boundary-v2.test.mjs",
  "test/audit-phase5-parser-contract-static-boundary-v1.test.mjs",
  "test/audit-phase5-parser-lifecycle-normalization-v1.test.mjs",
  "test/audit-phase5-result-boundary-ordering-v2.test.mjs",
  "test/audit-phase5-result-contract-compatibility-v1.test.mjs",
  "test/audit-phase5-result-evidence-summary-v2.test.mjs",
  "test/audit-phase5-result-lifecycle-hardening-v2.test.mjs",
  "test/audit-round2-phases1-8-adversarial.test.mjs",
  "test/audit-round2-phases1-8-mutation.test.mjs",
  "test/audit-round2-phases1-8-static-boundary.test.mjs",
  "test/audit-round3-phases4-6-compatibility.test.mjs",
  "test/audit-round3-protected-blobs-and-static.test.mjs",
  "test/audit-round3-release-intake-adversarial.test.mjs",
  "test/audit-round3-release-integration-v1.test.mjs",
  "test/audit-round4-integration-stage0-red.test.mjs",
  "test/audit-round4-integration-stage0-takeover-red.test.mjs",
  "test/audit-round4-worker1-phase78-e2e-v1.test.mjs",
  "test/audit-round4-worker1-publication-replay-v1.test.mjs",
  "test/audit-round4-worker1-report-compat-v1.test.mjs",
  "test/audit-round4-worker1-service-compat-v1.test.mjs",
  "test/audit-round4-worker1-source-review-red-v1.test.mjs",
  "test/audit-round4-worker1-static-boundary-v1.test.mjs",
  "test/audit-round4-worker4-client-races-v1.test.mjs",
  "test/audit-round4-worker4-compatibility-v1.test.mjs",
  "test/audit-round4-worker4-direct-render-v1.test.mjs",
  "test/audit-round4-worker4-hostile-e2e-v1.test.mjs",
  "test/audit-round4-worker4-public-fixtures-v1.test.mjs",
  "test/audit-round4-worker4-source-review-v1.test.mjs",
  "test/audit-round4-worker4-static-accessibility-v1.test.mjs",
  "test/fixtures/audit-phase5/cancellation-v1.json",
  "test/fixtures/audit-phase5/dependency-conflicting-duplicates-v2.json",
  "test/fixtures/audit-phase5/dependency-findings-v1.json",
  "test/fixtures/audit-phase5/dependency-success-v1.json",
  "test/fixtures/audit-phase5/echidna-findings-v1.json",
  "test/fixtures/audit-phase5/echidna-success-v1.json",
  "test/fixtures/audit-phase5/fixture-manifest-v1.json",
  "test/fixtures/audit-phase5/fixture-manifest-v2.json",
  "test/fixtures/audit-phase5/hardhat-findings-v1.json",
  "test/fixtures/audit-phase5/hardhat-sensitive-messages-v2.json",
  "test/fixtures/audit-phase5/hardhat-success-v1.json",
  "test/fixtures/audit-phase5/malformed-output-v1.txt",
  "test/fixtures/audit-phase5/mutation-conflicting-duplicates-v2.json",
  "test/fixtures/audit-phase5/mutation-findings-v1.json",
  "test/fixtures/audit-phase5/mutation-success-v1.json",
  "test/fixtures/audit-phase5/parser-error-unsafe-path-v1.json",
  "test/fixtures/audit-phase5/resource-exhaustion-v1.json",
  "test/fixtures/audit-phase5/timeout-v1.json",
  "test/fixtures/audit-round2-phases1-8/canonical-v1.json",
  "test/fixtures/audit-round4/integration/stage0-unresolved-candidates-v1.json",
  "test/fixtures/audit-round4/worker1/multi-tenant-scenarios-v1.json",
  "test/fixtures/audit-round4/worker1/source-verification-v1.json",
  "test/fixtures/audit-round4/worker4/github-direct-public-v2.json",
  "test/pr126-workflow-trust-v1.test.mjs"
]);
const EXCLUDED_SELF_REFERENTIAL_PATHS = Object.freeze([
  "packages/audit-integration-round4/src/live-evidence-gates.mjs",
  "test/audit-round4-integration-live-evidence-v1.test.mjs",
  "docs/audit/round4/integration/2026-08-03-round4-final-tree-attestation-v1.json",
  "test/audit-round4-final-tree-attestation-v1.test.mjs"
]);

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function buildAggregate() {
  const entries = ATTESTED_PATHS.map((path) => {
    assert.ok(existsSync(path), `attested path is missing: ${path}`);
    return `${path}\0${gitBlobSha(readFileSync(path))}`;
  });
  return {
    pathCount: entries.length,
    digest: createHash('sha256').update(`${entries.join('\n')}\n`, 'utf8').digest('hex')
  };
}

test('Round 4 final tree has one complete immutable attestation', () => {
  assert.equal(new Set(ATTESTED_PATHS).size, ATTESTED_PATHS.length);
  assert.deepEqual(ATTESTED_PATHS, [...ATTESTED_PATHS].sort());
  assert.equal(ATTESTED_PATHS.length, 198);

  const aggregate = buildAggregate();
  assert.ok(
    existsSync(MANIFEST_PATH),
    `missing final-tree attestation; computed pathCount=${aggregate.pathCount} digest=${aggregate.digest}`
  );

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  assert.equal(manifest.schemaVersion, 'round4-final-tree-attestation-v1');
  assert.equal(manifest.repository, 'CurveYield/contract-automation');
  assert.equal(manifest.approvedBaseSha, APPROVED_BASE_SHA);
  assert.equal(manifest.preAttestationHeadSha, PRE_ATTESTATION_HEAD_SHA);
  assert.equal(manifest.attestedPathCount, aggregate.pathCount);
  assert.equal(manifest.attestedPathDigestSha256, aggregate.digest);
  assert.deepEqual(manifest.excludedSelfReferentialPaths, EXCLUDED_SELF_REFERENTIAL_PATHS);
  assert.equal(manifest.changedPathCountAfterAttestation, 202);
  assert.equal(manifest.manualWorkflowDispatchOrRerun, false);
  assert.equal(manifest.liveSimulationExecutedByAttestation, false);
  assert.equal(manifest.mergeAuthorized, false);
});
