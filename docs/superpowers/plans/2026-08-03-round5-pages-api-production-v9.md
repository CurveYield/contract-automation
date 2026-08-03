# Round 5 Pages API Production Deployment v9 — Implementation Plan

## Goal

Promote the accepted Ethereum/Base-only static application to the configured Pages production target without Wrangler or dependency downloads, and accept it only when Cloudflare's deployment object and the custom domain prove the same exact production binding.

## Phase 1 — Focused RED

1. Add `packages/runner/test/audit-round5-pages-api-production-v4.test.mjs`.
2. Require the v9 request, workflow, and manifest script to exist.
3. Require direct API endpoints, no-upload fail-closed logic, exact parent/source binding, production deployment-object assertions, and custom-domain UI checks.
4. Forbid package managers, Wrangler, asset-upload endpoints, compilation, Worker/R2/job/RPC/signing/broadcast paths, and manual dispatch.
5. Open a draft PR and preserve the naturally triggered failing CI runs.

## Phase 2 — Minimal implementation

1. Add `scripts/pages_asset_manifest_v1.py` with a dependency-free BLAKE3 implementation and self-test vectors.
2. Add `.agent-control/v1/orchestrator/DEPLOY_REQUEST_v9.json` bound to exact previous release SHA `70719851d8e18faf89e65027858b9f4f728d979d` and application source `2c6e543dfcaa17ca975bbde3c15302269bbf8072`.
3. Add `.github/workflows/deploy-v9.yml` with:
   - exact-parent one-time push trigger;
   - full-SHA checkout pin;
   - `production` environment;
   - accepted-source byte-identity check for `apps/web/public`;
   - dependency-free manifest generation;
   - upload-token acquisition;
   - missing-asset check requiring an empty result;
   - direct multipart deployment with no `branch` field;
   - deployment-object production/branch/commit/stage/alias checks;
   - bounded custom-domain UI checks;
   - sanitized issue #125 report and cleanup.
4. Update the PR body with exact implementation scope.

## Phase 3 — Exact-head verification

1. Inspect both naturally triggered CI workflows on the exact implementation head.
2. Require every repository test, syntax, lint, static Pages build, action-pin, and secretless-PR check to pass.
3. Inspect exact diff, reviews, comments, inline threads, mergeability, base SHA, and head SHA.
4. Merge only the exact verified head.

## Phase 4 — Live gate inspection

1. Inspect the naturally triggered v9 run; never rerun it.
2. Record exact run, job, every step, deployment ID, production classification, branch/commit binding, alias binding, and custom-domain result without recording secrets or service credentials.
3. Mark the gate accepted only if every required step succeeds.
4. Otherwise preserve the failed run, add a new versioned receipt, update issue #125 and the control plane, and use a fresh exact-parent request for any correction.
