# Round 5 Pages API Production Deployment v10 — Implementation Plan

## Goal

Repair GitHub pre-run workflow validation while preserving the exact dependency-free Pages API production gate introduced by v9.

## Phase 1 — Focused RED

1. Add `packages/runner/test/audit-round5-pages-api-production-v5.test.mjs` only.
2. Require a fresh v10 workflow and request bound to release parent `11036211d5448e0bd32bb4c4fdd85bf638caa53d`.
3. Reject every `${{ runner.* }}` expression in the workflow definition.
4. Require `$RUNNER_TEMP/pages-v10` initialization inside the first runner shell and persistence through `$GITHUB_ENV`.
5. Preserve all direct Pages API, no-download, no-upload, exact-production-binding, UI-scope, and safety assertions.
6. Capture the naturally triggered missing-v10-gate failure without rerunning any workflow.

## Phase 2 — Minimal implementation

1. Add `.agent-control/v1/orchestrator/DEPLOY_REQUEST_v10.json`.
2. Add `.github/workflows/deploy-v10.yml` by copying the accepted v9 API behavior and changing only versioned bindings and transient-directory initialization.
3. Keep `scripts/pages_asset_manifest_v1.py` unchanged.
4. Add this plan and the matching versioned design record.

## Phase 3 — Exact-head verification

1. Inspect both naturally triggered PR workflows on the final exact head.
2. Require the focused test, all repository tests, syntax validation, lint, build, action-pin checks, and secretless-PR checks to pass.
3. Inspect the exact diff, changed filenames, comments, reviews, inline threads, mergeability, base SHA, and head SHA.
4. Merge only the exact verified head with an expected-head guard.

## Phase 4 — Trusted live gate

1. Inspect the naturally triggered v10 push run; never rerun it.
2. Record exact run, job, every step, source SHA, application source, deployment short ID, production binding, alias binding, custom-domain result, and sanitized issue #125 comment.
3. Accept only if every required step succeeds and every prohibited operation remains false.
4. If rejected, preserve the run and use a fresh versioned exact-parent correction.
5. If accepted, create a fresh exact-parent current-source production smoke gate.
