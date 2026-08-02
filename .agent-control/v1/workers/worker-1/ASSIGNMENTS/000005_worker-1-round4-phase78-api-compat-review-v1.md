# Worker 1 — Round 4 independent Phase 7–8/API compatibility review and assembled API acceptance v1

## Identity

- Worker ID: `worker-1-round4-phase78-api-compat-review-v1`
- Sequence: `5`
- Message ID: `worker-1-round4-phase78-api-compat-review-v1-000005`
- Repository: `CurveYield/contract-automation`
- Issue: `#121`
- Branch: `audit-round4/review-phase78-api-compat-v1`
- Starting SHA: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`
- Round: **4 — final static/inert integration and acceptance round before Round 5 production testing**

## Authoritative inputs

- Worker 0 reconciled Round 3 branch head: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`.
- Worker 0 repaired core candidate: `dc77c51eb02d6f07b6ce9d582d8629b9c9932788`.
- Worker 0 durable closeout comment: issue #112 comment `5156777973`.
- Worker 0 recommendation: `ACCEPT WITH REPAIR`.
- Worker 0 closeout review: `docs/audit/reviews/2026-08-02-worker0-phase78-round3-closeout-v1.md`.
- Worker 0 handoff: `docs/audit/round3/2026-08-02-worker0-phase78-round4-handoff-v1.json`.
- Worker 1 Round 3 API/GPT/auth head: `6d877e2d87f1a91380a6c5d1efc47550527d8729`, issue #113.
- Round 4 master gate: issue #119.

Re-fetch all inputs and reject any mismatch before editing.

## Goal

Independently review and complete the bounded service/report/publication compatibility work left unfinished by Worker 0. Prove that the repaired Phase 7–8 core is correctly exposed to the public API/GPT/auth layer with exact tenant/attempt scoping, lifecycle/report truth, hidden-resource non-interference, deterministic cursor/cache behavior and stable bounded errors. Repair only observed defects test-first. Publish the exact reviewed/repaired Phase 7–8 head for Worker 2, then independently accept or reject the frozen assembled candidate from the API/GPT perspective.

## Owned paths

- proven repairs to Worker 0-owned Phase 7–8 public contract/service/reporting/publication paths;
- tests `test/audit-round4-worker1-*`;
- fixtures `test/fixtures/audit-round4/worker1/**`;
- reviews/manifests `docs/audit/round4/worker1/**`.

Do not alter Worker 1 Round 3 API production in Stage A. Never alter the GitHub-native simulation/App/RPC addon.

## Mandatory unfinished Worker 0 scope

You must explicitly close all six gaps from the orchestrator closeout:

1. reconcile `audit-phase78-service` orchestration states and operation summaries with repaired transient lifecycle/storage operations;
2. prove all service/report/publication reads use tenant/attempt-scoped core readers only;
3. reconcile fork, clean-room and provenance reports against repaired validators;
4. exercise pagination/cursor, quota, retention, tombstone and immutable-publication replay matrices;
5. add complete multi-tenant Phase 7–8 service/report E2E scenarios;
6. publish final per-path/blob and production-prerequisite manifests.

## Stage A ordered work

1. Pin exact source head, reports, issue #111 findings, handoff manifest and every owned path/blob.
2. Re-run Phase 7 43-test, Phase 8 32-test and combined 75-test evidence where permissible.
3. Build an API route-to-Phase 7–8 export/schema/state/error compatibility registry.
4. Inspect service requests, results, errors, authorization, orchestration, pagination, reporting and publication modules line by line.
5. Add observed RED tests for transient-state projection mismatches and incorrect operation accounting.
6. Add RED tests proving no public seam can use unscoped fork/request/checkpoint readers.
7. Add RED tests for hidden-vs-absent status/body/header/count/cache/ETag differences.
8. Add RED tests for stale/tampered cursors, cross-scope caches, report/reference identity drift, impossible self-hashed records, oversized values and unstable/provider-reflected errors.

### Checkpoint 1

Post exact source/report/blob verification, route/export compatibility map, observed RED commands/results, protected hashes and changed paths.

9. Repair only proven Phase 7–8 public service/report/publication defects.
10. Reconcile every fork/checkpoint/export/restore/delete/tombstone lifecycle projection with repaired core states and operation budgets.
11. Reconcile clean-room access/share/merge/provenance/report projections and relation/provenance validators.
12. Enforce exact tenant/workspace/campaign/fork/merge/attempt identity and hidden-resource non-interference.
13. Harden deterministic pagination/cursors, no hidden totals, scope-bound ETags/cache and stable bounded errors.
14. Exercise partial immutable publication and CAS-pointer/index replay at every failure boundary.
15. Exercise quotas, retention, operation limits, cancellation and terminal-state behavior.
16. Build multi-tenant E2E scenarios spanning full fork and clean-room/report lifecycles.

### Checkpoint 2

Post repaired SHA, service/report schema inventory, lifecycle projections, storage/publication traces, non-interference results, E2E totals and GREEN evidence.

17. Run broad one-field mutation, hostile-object, cross-tenant, stale-CAS, retry, cancellation, quota/retention, duplicate/conflict and error-redaction matrices.
18. Run all permissible direct-Node, syntax, JSON, changed-path, public-export, Cloudflare-compatible contract, protected-blob and whitespace gates.
19. Publish complete reviewed/repaired path/blob manifest, public compatibility manifest and deterministic Worker 2 intake instructions.
20. Publish `ACCEPT`, `ACCEPT WITH REPAIR` or `REJECT` with no unsupported production-readiness claim.

### Checkpoint 3 — Stage A completion

Post final Stage A SHA, every changed path/blob, tests/mutations/scenarios/failure-boundary totals, exact public versions, residual risks and Worker 2 intake order.

## Stage B assembled API acceptance

After Worker 2 freezes one assembled integration SHA on issue #119:

1. Pin the exact SHA; any newer SHA invalidates acceptance.
2. Verify all API/GPT routes and methods, client/GPT/admin/service identity separation and resource binding.
3. Verify hidden-resource non-interference, pagination/cursors/ETags/cache and recursive redaction.
4. Verify report/capability/catalog discovery and Phase 7–8 service compatibility.
5. Verify Cloudflare Worker import/runtime portability and no hidden transport/execution authority.
6. Verify protected simulation-addon blob equality.
7. Publish final `ACCEPT` or `REJECT` against that exact SHA.

## Restrictions

No dependency installation unless issue #121 permits it, no submitted-project execution, no live RPC/network, no wallet/signing/transaction, no deployment, no secret values, no PR, no branch merge and no direct `main` modification.

## Completion

Post startup/checkpoints/final reports only to issue #121, commit only to `audit-round4/review-phase78-api-compat-v1`, record exact report IDs and SHAs in status, and monitor issue #119 for the Stage B candidate.
