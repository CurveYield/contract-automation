# Worker 1 Round 4 Phase 7–8/API Compatibility Review Implementation Plan v1

> **For agentic workers:** REQUIRED SUB-SKILL: use test-driven development for every production behavior change and execute this plan task-by-task in the isolated branch `audit-round4/review-phase78-api-compat-v1`.

**Goal:** Independently review and minimally repair the Phase 7–8 public service, reporting, pagination/cache, and publication seams so Worker 2 can deterministically intake one exact reviewed head.

**Architecture:** Keep repaired Phase 7–8 core validators and tenant/attempt-scoped readers authoritative. Public service/report/publication code must consume only those exported contracts, derive visible projections from validated records, bind every cursor/cache/publication plan to exact resource scope, and normalize failures to bounded stable errors. Stage A ends with exact path/blob manifests and Worker 2 intake instructions; Stage B waits for issue #119 to freeze one assembled SHA.

**Tech stack:** JavaScript ESM, Node built-in test runner, standard Web APIs, GitHub contents API, JSON/Markdown manifests.

## Global Constraints

- Starting SHA: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`.
- Repaired core candidate: `dc77c51eb02d6f07b6ce9d582d8629b9c9932788`.
- Writable production paths are limited to proven Phase 7–8 public service/reporting/publication repairs.
- Writable tests: `test/audit-round4-worker1-*` and `test/fixtures/audit-round4/worker1/**`.
- Writable documentation: `docs/audit/round4/worker1/**`.
- Worker 1 Round 3 API production is read-only in Stage A.
- GitHub-native simulation/App/RPC-addon and PR #126 live-fork/simulation paths are frozen.
- No dependency installation/download, compilation/build, submitted-project execution, live RPC/network, wallet/signing/transaction, deployment, secret values, PR, branch merge, or direct `main` modification.
- Every behavior repair requires observed RED evidence before production edits.
- Local verification may use only a no-download mirror of exact fetched source plus clearly identified test-only stubs; harness-only files are never repository changes.

---

### Task 1: Pin source truth and produce Checkpoint 1 RED evidence

**Files:**
- Create: `test/audit-round4-worker1-source-review-red-v1.test.mjs`
- Create: `test/fixtures/audit-round4/worker1/source-verification-v1.json`
- Create: `docs/audit/round4/worker1/2026-08-02-phase78-api-route-export-compatibility-v1.md`

**Interfaces:**
- Consumes: Worker 0 handoff, closeout review, repaired core public exports, Worker 1 Round 3 route/auth manifest.
- Produces: exact source registry, route-to-export/schema/state/error map, and one failing test per observed seam defect.

- [ ] **Step 1:** Record the exact starting SHA, source report/comment IDs, handoff blob, changed-path registry, protected-addon pins, and the repaired core public export inventory.
- [ ] **Step 2:** Write focused tests proving the current source incorrectly permits or exposes: missing attempt scope, generic stale operation accounting, hidden-member signals, unvalidated report records, weak cursor/cache scope, and insufficient publication scope/replay identity.
- [ ] **Step 3:** Run the focused test file in the no-download mirror and verify failures are behavioral—not missing-file, syntax, or harness failures.
- [ ] **Step 4:** Commit only the RED test, source fixture, compatibility map, and this plan.
- [ ] **Step 5:** Post Checkpoint 1 to issue #121 with exact SHA, RED counts, compatibility map, protected pins, and changed paths.

### Task 2: Repair service contracts, authorization, orchestration, pagination, and stable errors

**Files:**
- Modify: `packages/audit-phase78-service/src/constants.mjs`
- Modify: `packages/audit-phase78-service/src/contracts.mjs`
- Modify: `packages/audit-phase78-service/src/authorization.mjs`
- Modify: `packages/audit-phase78-service/src/orchestration.mjs`
- Modify: `packages/audit-phase78-service/src/pagination.mjs`
- Create or modify as proven necessary: `packages/audit-phase78-service/src/errors.mjs`
- Modify: `packages/audit-phase78-service/src/index.mjs`
- Create: `test/audit-round4-worker1-service-compat-v1.test.mjs`

**Interfaces:**
- Consumes: `validateServiceRequest`, repaired fork lifecycle/state semantics, exact operation/storage map, tenant/attempt scoped core reader contract.
- Produces: versioned exact attempt-bound service requests; route-safe authorization; operation-specific lifecycle/storage plans; scope-bound cursor/cache metadata; stable bounded public errors.

- [ ] **Step 1:** Add failing tests for exact attempt binding, hidden-vs-absent authorization equivalence, transient lifecycle plans, exact operation summaries, stale/tampered cursor rejection, scope-bound ETags, and provider-error normalization.
- [ ] **Step 2:** Run the new tests and preserve the expected RED output.
- [ ] **Step 3:** Implement the smallest versioned contract changes needed to make attempt identity explicit and immutable without weakening existing tenant/workspace/campaign/fork/merge identity.
- [ ] **Step 4:** Replace the generic orchestration plan with operation-specific, deterministic transition/publication/recovery descriptors derived from the repaired storage boundaries.
- [ ] **Step 5:** Make denial output non-interfering and normalize internal/provider errors to a fixed public code/message/path set.
- [ ] **Step 6:** Bind cursors, ETags, and cache metadata to exact visible scope and view digest; omit hidden totals.
- [ ] **Step 7:** Run focused and prior compatible service tests; commit only after GREEN.

### Task 3: Repair fork, clean-room, relation, and provenance projections

**Files:**
- Modify: `packages/audit-fork-reporting/src/fork-projections.mjs`
- Modify: `packages/audit-fork-reporting/src/checkpoint-projections.mjs`
- Modify: `packages/audit-fork-reporting/src/delete-projection.mjs`
- Modify: `packages/audit-clean-room-reporting/src/campaign-merge.mjs`
- Modify: `packages/audit-clean-room-reporting/src/relations.mjs`
- Modify: `packages/audit-clean-room-reporting/src/provenance.mjs`
- Modify as needed: `packages/audit-clean-room-reporting/src/hidden.mjs`
- Create: `test/audit-round4-worker1-report-compat-v1.test.mjs`

**Interfaces:**
- Consumes: `validateForkState`, `validateCheckpointManifest`, `validateExportManifest`, `validateForkTombstone`, `validateTerminalCampaignManifest`, `validateMergeManifest`, `validateDuplicateRelation`, `validateConflictRelation`, and `validateProvenanceIndex`.
- Produces: hostile-safe, validator-backed, identity-consistent, recursively frozen visible reports with no hidden-resource signal.

- [ ] **Step 1:** Add failing tests for invalid lifecycle states, malformed checkpoint/export/tombstone records, impossible merge/provenance records, hostile accessors/proxies, hidden relation count drift, and hidden-node digest/cache drift.
- [ ] **Step 2:** Run and preserve RED evidence.
- [ ] **Step 3:** Validate every source record through the repaired core validator before projection.
- [ ] **Step 4:** Derive report IDs/digests solely from visible validated fields and exact caller scope.
- [ ] **Step 5:** Remove hidden existence booleans/counts/digests and return one byte-identical absent/hidden projection.
- [ ] **Step 6:** Run focused report tests plus repaired core validator tests; commit after GREEN.

### Task 4: Repair scoped publication and replay recovery

**Files:**
- Modify: `packages/audit-phase78-publication/src/plans.mjs`
- Modify: `packages/audit-phase78-publication/src/recovery.mjs`
- Modify as proven necessary: `packages/audit-phase78-publication/src/quota.mjs`
- Create: `test/audit-round4-worker1-publication-replay-v1.test.mjs`

**Interfaces:**
- Consumes: exact service request identity, resource kind/ID/attempt scope, immutable-write and CAS-pointer boundaries.
- Produces: deterministic scoped keys, immutable create/CAS plans, typed replay checkpoints, conflict rejection, quotas/retention enforcement, and pointer-last convergence.

- [ ] **Step 1:** Add failing tests for cross-attempt key collisions, stale CAS, conflicting immutable retries, duplicate plan entries, pointer-before-immutable replay, quota/retention boundaries, cancellation, and terminal-state publication.
- [ ] **Step 2:** Run and preserve RED evidence.
- [ ] **Step 3:** Bind all plan keys and digests to tenant/workspace plus campaign/fork/merge/attempt resource identity.
- [ ] **Step 4:** Represent each immutable/precondition/index/pointer boundary explicitly and reject conflicting completion evidence.
- [ ] **Step 5:** Enforce deterministic pointer-last recovery, bounded attempts, quotas, retention, and terminal/cancellation behavior.
- [ ] **Step 6:** Run focused publication/replay tests; commit after GREEN.

### Task 5: Multi-tenant E2E, broad hostile matrices, and Stage A handoff

**Files:**
- Create: `test/audit-round4-worker1-phase78-e2e-v1.test.mjs`
- Create: `test/audit-round4-worker1-static-boundary-v1.test.mjs`
- Create: `test/fixtures/audit-round4/worker1/multi-tenant-scenarios-v1.json`
- Create: `docs/audit/round4/worker1/2026-08-02-phase78-public-compatibility-manifest-v1.json`
- Create: `docs/audit/round4/worker1/2026-08-02-phase78-stage-a-path-blob-manifest-v1.json`
- Create: `docs/audit/round4/worker1/2026-08-02-phase78-worker2-intake-v1.md`
- Create: `docs/audit/round4/worker1/2026-08-02-phase78-api-compat-stage-a-review-v1.md`

**Interfaces:**
- Consumes: all repaired Stage A public service/report/publication contracts.
- Produces: complete Stage A evidence, deterministic Worker 2 intake order, production prerequisites, residual risks, and final Stage A verdict.

- [ ] **Step 1:** Add multi-tenant fork create/checkpoint/export/restore/delete/tombstone and clean-room campaign/share/merge/provenance/report scenarios, including hidden-vs-absent and concurrent retry cases.
- [ ] **Step 2:** Add one-field mutation, accessor/proxy/sparse/cycle/oversize, cross-tenant/attempt, stale-CAS, duplicate/conflict, cancellation, quota/retention, and error-redaction matrices.
- [ ] **Step 3:** Run every permissible direct-Node test, syntax and JSON check, public-export scan, Cloudflare-compatible import scan, changed-path allowlist, protected-blob comparison, and whitespace check.
- [ ] **Step 4:** Publish exact public versions, changed paths/blobs, test/mutation/scenario/failure-boundary totals, production prerequisites, and residual risks.
- [ ] **Step 5:** Post Checkpoints 2 and 3 plus the Stage A final report to issue #121, re-fetch each durable comment, and update Worker 1 status with the exact reviewed/repaired SHA and report IDs.
- [ ] **Step 6:** Leave status `working` with Stage B waiting until issue #119 freezes one exact assembled SHA.

### Task 6: Stage B assembled API acceptance

**Files:**
- Create after activation: `docs/audit/round4/worker1/2026-08-02-assembled-api-acceptance-v1.md`
- Create after activation: `test/audit-round4-worker1-assembled-api-acceptance-v1.test.mjs`

**Interfaces:**
- Consumes: one frozen assembled SHA from issue #119.
- Produces: one exact-SHA API/GPT/auth/Phase 7–8 compatibility `ACCEPT` or `REJECT` report.

- [ ] **Step 1:** Wait until Worker 2 publishes and freezes the assembled SHA; do not infer or pre-accept it.
- [ ] **Step 2:** Verify all routes/methods, identity separation, hidden-resource non-interference, pagination/cursors/ETags/cache, redaction, report/capability/catalog discovery, Phase 7–8 compatibility, Cloudflare portability, and protected blobs against that exact SHA.
- [ ] **Step 3:** Post the final Stage B verdict to issue #121, re-fetch the comment, and complete the mailbox status/event only if the SHA remains current.
