---
protocol_version: 1
message_id: worker-3-phase8-clean-room-control-merge-v1-000004
sequence: 4
worker_id: worker-3
issued_at: 2026-08-01T16:15:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 91
branch: audit-phase8/clean-room-control-merge-v1
starting_sha: 2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c
supersedes_message_id: worker-3-phase5-parser-lifecycle-repair-v1-000003
assignment_state: ready
---

# Worker 3 — Phase 8 clean-room ACL, non-interference, controlled merge, and provenance v1

Read GitHub issue #91 in full, including normative correction comment `5152283643`. The issue and that correction are the authoritative implementation, ownership, verification, checkpoint, and reporting contract.

## Objective

Implement the entire isolated Phase 8 clean-room campaign control plane: strict tenant/workspace/campaign authorization, explicit base-artifact sharing, hidden-resource non-interference, terminal campaign manifests, controlled merge state and planning, duplicate/conflict relation maps, provenance graphs/indexes, merged-report references, deterministic scoped storage transactions, quotas/retention/recovery, end-to-end multi-tenant scenarios, adversarial mutation coverage, and static security boundaries.

This is intentionally a broad multi-package assignment. Completion requires **all eighteen ordered sections**, all four checkpoint comments, the completion-candidate checkpoint, and the durable review/final report. A narrow fix, one module, or one test file is not completion.

## Bootstrap

Re-fetch this assignment, Worker 3 `CURRENT_v1.json`, issue #91, correction comment `5152283643`, and branch state before editing. Verify:

- sequence `4`;
- message ID `worker-3-phase8-clean-room-control-merge-v1-000004`;
- issue `#91`;
- branch `audit-phase8/clean-room-control-merge-v1`;
- starting SHA `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c`;
- assignment blob SHA from `CURRENT_v1.json`.

Attempt an isolated clone first. If Git transport fails, continue connector-first in a unique writable directory. Do not install or download dependencies.

## Exclusive ownership

Writable paths are limited to:

- `packages/audit-clean-room-protocol/**`;
- `packages/audit-clean-room-access/**`;
- `packages/audit-clean-room-campaigns/**`;
- `packages/audit-controlled-merge/**`;
- `packages/audit-provenance/**`;
- new inert fixtures under `test/fixtures/audit-phase8/**`;
- focused test files using the Phase 8 prefixes listed in issue #91;
- one durable review beginning `docs/audit/reviews/2026-08-01-audit-phase8-clean-room-control-merge-`.

Do not modify Worker 0 Phase 7 packages, Worker 1 Phase 4 catalog/API paths, Worker 2 Phase 6 packages, existing Phase 1–7 production code, API/web, workflows, deployment, executors, integration branches, GitHub Direct files, or CurveYield Lite.

This assignment may prepare Phase 8 in isolation while Phase 7 is active, but Phase 8 integration remains gated on independent acceptance of Phase 7.

## Work-size and checkpoint enforcement

The four checkpoints are mandatory and must be posted only to issue #91:

1. Sections 1–7: protocol, authorization, visibility, non-interference, storage keys/indexes, and sharing grants.
2. Sections 8–11: terminal manifests, merge state machine, duplicate relations, and conflict relations.
3. Sections 12–14: provenance, merge publication, storage transactions, quotas, retention, and recovery.
4. Sections 15–18 completion candidate: end-to-end fixtures/scenarios, adversarial corpus, static boundary, durable review, and final verification.

Each checkpoint must identify the current exact branch SHA, changed files, focused commands/counts, and the matrices required by issue #91. Do not post the final report until all four checkpoints can be re-fetched from issue #91.

## Restrictions

No dependency installation/download, package manager, compilation, build, external audit tool, submitted-project execution, process spawning, container, network/RPC, arbitrary URL, wallet/key/signer, transaction/calldata/broadcast, deployment, workflow approval, production secret, AWS, execution enablement, source-code merge execution, or merge to `main`.

## Reporting destination

Read `.agent-control/v1/REPORT_DESTINATION_POLICY_v1.md`.

Post startup, checkpoints, blockers, and final report only to issue #91. Immediately before final reporting:

1. re-fetch `CURRENT_v1.json`;
2. re-fetch this assignment and verify its blob SHA and `issue_number: 91`;
3. verify all four checkpoint comments are present on issue #91;
4. post only to issue #91;
5. re-fetch issue #91 and verify the final report exists;
6. record the exact issue-comment URL and numeric comment ID in completed `STATUS_v1.json` and the completion event.

Completion is invalid without those durable records.

## Completion

Use test-first direct Node work and preserve initial red evidence. Commit only to `audit-phase8/clean-room-control-merge-v1`. The final report must include every item required by issue #91 section 18 and the completion contract, including exact starting/final SHAs, every changed file, all four checkpoints, full authorization/sharing/non-interference/terminal/merge/relation/provenance/storage truth tables, fixture/scenario inventory, mutation totals, static boundary results, blocked integration checks, residual risks, and `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT`.