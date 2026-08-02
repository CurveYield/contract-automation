# Worker 1 Round 4 Phase 7–8 Stage A Intake for Worker 2 v1

## Decision

**ACCEPT WITH REPAIR** for deterministic Stage B integration.

Worker 1 independently reviewed Worker 0's Phase 7–8 candidate from the API/GPT/auth consumer boundary, reproduced ten public-seam defects, and repaired only the affected service, reporting, pagination/cache, and publication contracts.

## Exact sources

- Round 4 starting/reconciled Worker 0 source: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`.
- Worker 0 repaired core candidate: `dc77c51eb02d6f07b6ce9d582d8629b9c9932788`.
- Worker 0 durable closeout: issue #112 comment `5156777973`.
- Worker 1 Round 3 API candidate: `6d877e2d87f1a91380a6c5d1efc47550527d8729`.
- Worker 1 reviewed Stage A code/test candidate: `e26b78c2c26f3c11897e8fea397c8615fc66a5a0`.
- Exact code/test path-and-blob manifest:
  - path: `docs/audit/round4/worker1/2026-08-02-phase78-stage-a-path-blob-manifest-v1.json`
  - blob: `3ecd9f2b76091a1fb6320b4c9dbd4f10c5ed38f3`
- Public compatibility manifest:
  - path: `docs/audit/round4/worker1/2026-08-02-phase78-public-compatibility-manifest-v1.json`
  - blob: `8bcf9124c01fd47401c16fc58bb0f094f85f6bdb`

## Mandatory intake method

Do not merge this branch wholesale and do not import its ancestry. Intake exact registered blobs by exact path.

1. Start from Worker 2's accepted/repaired Phase 1–6 integration-spine head.
2. Replace stale Phase 7–8 core paths with Worker 0's accepted/repaired exact core blobs.
3. Intake the 17 Worker 1 public-seam production blobs from the path/blob manifest:
   - `packages/audit-phase78-service/src/{constants,contracts,authorization,orchestration,pagination,errors,index}.mjs`
   - `packages/audit-fork-reporting/src/{common,fork-projections,checkpoint-projections,delete-projection}.mjs`
   - `packages/audit-clean-room-reporting/src/{campaign-merge,hidden,provenance,relations}.mjs`
   - `packages/audit-phase78-publication/src/{plans,recovery}.mjs`
4. Intake the six `test/audit-round4-worker1-*` tests and two Worker 1 Round 4 fixtures.
5. Intake the Worker 1 Round 4 compatibility/review documentation as non-production provenance.
6. Reject any path not present in the committed manifests.
7. Reject any blob mismatch, stale source SHA, ownership overlap, protected-addon difference, or adaptation not explicitly documented.

## Shared-file union result

There is no shared production file union in this package. Every repaired production path is wholly owned by the Phase 7–8 public service/report/publication seam. Worker 1 Round 3 API production was not modified.

No GitHub-native simulation/App/RPC-addon path and no PR #126 live-fork/simulation path may be imported from this branch.

## Required public-version locks

The combined candidate must retain:

- service request/response/error v1 for legacy compatibility;
- service request/response/error v2 for exact attempt-bound Phase 7–8 access;
- page cursor/page v2 for hidden-resource-safe Phase 7–8 listing;
- authorization decision v2;
- orchestration and retry plan v2;
- report projections v2;
- immutable/mutable publication plan v2;
- scoped publication recovery v1.

Phase 7–8 API routes must select v2 contracts. Legacy page v1 retains its historical `total` field and must not be used for hidden-resource-sensitive Phase 7–8 discovery.

## Exact API consumer contract

The API/GPT layer may consume only:

- repaired public semantic validators from Phase 7 and Phase 8;
- `ForkService` tenant/attempt-scoped public readers;
- the exported Phase 7–8 service contracts;
- validator-backed report projections;
- exact-scope publication plans and recovery records.

It must not import storage keys, raw object stores, unscoped readers, R2 internals, credentials, workflow authority, executor authority, or submitted-project code.

## Required post-intake commands

Run from the exact assembled tree without dependency installation:

```text
node --test test/audit-round4-worker1-source-review-red-v1.test.mjs
node --test test/audit-round4-worker1-service-compat-v1.test.mjs
node --test test/audit-round4-worker1-report-compat-v1.test.mjs
node --test test/audit-round4-worker1-publication-replay-v1.test.mjs
node --test test/audit-round4-worker1-phase78-e2e-v1.test.mjs
node --test test/audit-round4-worker1-static-boundary-v1.test.mjs
```

Then rerun:

- Worker 0 repaired Phase 7 lifecycle, hostile-boundary, merge/relation/provenance and scoped-reader suites against the same tree;
- Worker 1 Round 3 API/GPT/auth/report-discovery suites;
- Worker 2 combined identity/schema/version/export locks;
- changed-path ownership, exact blob and protected-addon checks;
- JavaScript syntax, JSON validation and whitespace/diff checks.

A failure in the actual repaired core modules invalidates Stage A acceptance even if the isolated no-download seam harness passed.

## Expected Stage A evidence

- 10 observed source-review RED cases.
- 108 total focused/broad Stage A tests, all passing.
- 29 JavaScript production/test syntax checks, all clean.
- 12 named multi-tenant scenarios.
- 17 repaired production paths.
- 27 exact code/test candidate paths in the path/blob manifest.
- zero unowned paths.
- zero protected/frozen paths.

## Production prerequisites not tested here

- live Cloudflare Worker runtime and bindings;
- live R2 CAS/object behavior and retention rules;
- authenticated API selection of v2 contracts;
- production provider latency/failure behavior;
- deployment, observability, rollback and secret-presence validation.

Those remain Round 5 work. No secret value is required or present in this package.

## Stage B gate

Worker 1 Stage B acceptance begins only after issue #119 publishes and freezes one exact assembled SHA. Every API/GPT/auth/Phase 7–8 compatibility check will run against that same SHA. Any newer integration commit invalidates the acceptance.
