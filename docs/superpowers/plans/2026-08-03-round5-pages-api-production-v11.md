# Round 5 Pages API Production Deployment v11 — Implementation Plan

## Goal

Repair the v10 deployment acceptance predicate by separating terminal Cloudflare deployment-stage success from production custom-domain content binding.

## Phase 1 — Focused RED

1. Add `packages/runner/test/audit-round5-pages-api-production-v6.test.mjs` only.
2. Require a fresh v11 workflow and request bound to release parent `23a6ec8d8cc89d3aaa5d6a19d843bc37544358b5`.
3. Require terminal stage name `deploy` and status `success` without referencing `.result.aliases`.
4. Require deployment short-ID recording before polling.
5. Require a separate custom-domain HTML and JavaScript content gate.
6. Preserve all no-download, no-upload, exact-source, Ethereum/Base-only, and no-RPC/signing/broadcast assertions.
7. Capture the naturally triggered missing-v11-gate failure without rerunning any workflow.

## Phase 2 — Minimal implementation

1. Add `.agent-control/v1/orchestrator/DEPLOY_REQUEST_v11.json`.
2. Add `.github/workflows/deploy-v11.yml` by preserving the accepted v10 request, source, manifest, asset-cache, direct deployment, cleanup, and reporting behavior.
3. Replace only the combined terminal-stage-and-alias predicate with terminal deployment-stage assertions.
4. Record the deployment short ID immediately after validating the deployment response.
5. Rename and retain the separate production custom-domain content step.
6. Keep `scripts/pages_asset_manifest_v1.py` unchanged.
7. Add this plan and the matching versioned design record.

## Phase 3 — Exact-head verification

1. Inspect both naturally triggered PR workflows on the final exact head.
2. Require the focused test, complete repository tests, syntax validation, lint, build, action-pin checks, and secretless-PR checks to pass.
3. Inspect exact diff, changed filenames, comments, reviews, inline threads, mergeability, base SHA, and head SHA.
4. Merge only the exact verified head with an expected-head guard.

## Phase 4 — Trusted live gate

1. Inspect the naturally triggered v11 push run; never rerun it.
2. Record exact run, job, every step, source SHA, application source, deployment short ID, terminal stage binding, custom-domain content result, and sanitized issue #125 comment.
3. Accept only if every required step succeeds and every prohibited operation remains false.
4. If rejected, preserve the run and use a fresh versioned exact-parent correction.
5. If accepted, create a fresh exact-parent current-source production smoke gate.
