# Worker 0 — Round 4 independent integration-spine review and assembled semantic acceptance v1

## Identity

- Worker ID: `worker-0-round4-integration-spine-review-v1`
- Sequence: `6`
- Message ID: `worker-0-round4-integration-spine-review-v1-000006`
- Repository: `CurveYield/contract-automation`
- Issue: `#120`
- Branch: `audit-round4/review-integration-spine-v1`
- Starting SHA: `5914b03382422ea714346625a601b5dbda3aa0cd`
- Round: **4 — final static/inert integration and acceptance round before Round 5 production testing**

## Authoritative inputs

- Worker 2 Round 3 final integration-spine head: `5914b03382422ea714346625a601b5dbda3aa0cd`.
- Worker 2 durable orchestrator report comment: issue #114 comment `5156779012`.
- Worker 2 release review: `docs/audit/reviews/2026-08-01-audit-round3-phases1-8-release-integration-v1.md`.
- Worker 2 release manifest: `docs/audit/integration/2026-08-01-audit-round3-phases1-8-release-manifest-v1.json`.
- Worker 0 reconciled Phase 7–8 head: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`.
- Worker 0 repaired core candidate: `dc77c51eb02d6f07b6ce9d582d8629b9c9932788`.
- Round 4 master gate: issue #119.

Re-fetch all inputs and reject any mismatch before editing.

## Goal

Independently review Worker 2’s Phase 1–6 hardening and release-integration spine as the Phase 7–8 consumer. Prove exact source/blob intake, public-interface/schema/lifecycle compatibility, shared-file union safety and deterministic replacement of stale Phase 7–8 paths. Repair only independently reproduced defects. Then accept or reject Worker 2’s frozen assembled candidate from the complete Phase 1–8 semantic perspective.

## Owned paths

- minimal proven repairs to Worker 2-owned Phase 1–6 or integration-spine paths;
- tests `test/audit-round4-worker0-*`;
- fixtures `test/fixtures/audit-round4/worker0/**`;
- reviews/manifests `docs/audit/round4/worker0/**`.

Do not alter Worker 0 Round 3 Phase 7–8 production in Stage A. Never alter the GitHub-native simulation/App/RPC addon.

## Stage A ordered work

1. Pin exact candidate/report/manifest/path/blob/source identities.
2. Re-run all permissible Worker 2 focused tests, syntax and manifest gates.
3. Independently verify Phase 1–3 repairs and Phase 4–6 exact-source claims.
4. Build a complete dependency map from repaired Phase 7–8 public contracts to Phase 1–6 exports, schemas, identities, storage prefixes and lifecycle outcomes.
5. Add observed RED tests for missing exports, weakened validators, stale source/blob acceptance, count-only identity checks and public-interface drift.
6. Add RED tests for lifecycle incompatibility, tenant/workspace/campaign/job/report/evidence identity drift and hidden-resource mismatch.
7. Attack component manifests, source/destination blob truth, protected path matching and adaptation declarations.
8. Attack shared-file unions for overlapping field ownership, missing inputs, unowned history import, whole-side conflict resolution and digest substitution.

### Checkpoint 1

Post exact source/provenance verification, dependency map, RED commands/results, protected hashes and changed paths.

9. Repair only proven Worker 2-owned defects.
10. Verify all accepted/repaired source identities remain exact and adaptations are explicitly documented.
11. Harden component manifests, interface locks, overlap checks, protected paths and shared-file union validators where required.
12. Verify deterministic replacement rules reject stale Phase 7–8 paths and accept only registered exact reviewed paths.
13. Build cross-Phase 1–8 public identity/lifecycle/report compatibility tests without importing Phase 7–8 internals.
14. Verify execution-disabled/capability composition remains deny-by-default.
15. Build a complete Worker 2 intake instruction package with exact path/blob operations and post-intake gates.
16. Run broad hostile-object, mutation, version-skew, stale-CAS, retry, cancellation, quota/retention and cross-tenant matrices.

### Checkpoint 2

Post repaired SHA, compatibility matrices, GREEN results, intake instructions, source/blob table and residual risks.

17. Perform fresh line-by-line review of every changed production/integration module.
18. Run changed-path ownership, exact source/blob, protected-addon, syntax, JSON, direct-Node, static capability and whitespace gates.
19. Publish final Stage A review, complete path/blob manifest and `ACCEPT`, `ACCEPT WITH REPAIR` or `REJECT`.
20. Keep the branch ready for Stage B without merging or importing other subsystem history.

### Checkpoint 3 — Stage A completion

Post final Stage A SHA, all paths/blobs, test/mutation totals, exact Worker 2 intake contract and verdict.

## Stage B assembled semantic acceptance

After Worker 2 freezes one assembled integration SHA on issue #119:

1. Pin that exact SHA; any newer SHA invalidates prior acceptance.
2. Verify Phase 1–8 identities, schemas, storage keys, public exports and provenance.
3. Verify workspace/campaign/job/evidence/report lifecycle truth.
4. Verify fork create/checkpoint/export/restore/delete/tombstone lifecycle, partial-write recovery and scoped reads.
5. Verify clean-room policy/access/share/merge/provenance/report semantics.
6. Run stale-CAS, retries, cancellation, quota/retention, duplicate/conflict, hostile-object and cross-tenant scenarios.
7. Verify execution-disabled guarantees and protected simulation-addon blob equality.
8. Publish final `ACCEPT` or `REJECT` against the exact assembled SHA.

## Restrictions

No dependency installation unless issue #120 permits it, no submitted-project execution, no live RPC/network, no wallet/signing/transaction, no deployment, no secrets, no PR, no branch merge and no direct `main` modification.

## Completion

Post startup/checkpoints/final reports only to issue #120, commit only to `audit-round4/review-integration-spine-v1`, record exact report IDs and SHAs in status, and monitor issue #119 for the Stage B candidate.
