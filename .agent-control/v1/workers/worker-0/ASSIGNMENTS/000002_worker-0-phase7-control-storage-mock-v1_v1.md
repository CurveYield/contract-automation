---
protocol_version: 1
message_id: worker-0-phase7-control-storage-mock-v1-000002
sequence: 2
worker_id: worker-0
issued_at: 2026-08-01T15:33:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 80
branch: audit-phase7/control-storage-mock-v1
starting_sha: 2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c
supersedes_message_id: worker-0-phase1-3-pr-chain-000001
assignment_state: ready
---

# Worker 0 — Phase 7 persistent-fork protocol, checkpoint state, and mock adapter v1

Read GitHub issue #80 in full. Its body is the authoritative implementation, ownership, verification, and reporting contract.

## Objective

Implement the complete Phase 7 control/storage surface that is safe without active fork compute: strict fork/action/checkpoint/export protocols, exact chain/block identity, authorization and quotas, conditional state/index transitions through accepted storage abstractions, and a deterministic inert mock adapter. Real fork creation remains `awaiting_executor`.

This is a long, bounded 60–120 minute package. Complete all nine ordered sections in issue #80.

## Bootstrap

Re-fetch this immutable assignment, Worker 0 `CURRENT_v1.json`, issue #80, and branch state before editing. Verify:

- sequence `2`;
- message ID `worker-0-phase7-control-storage-mock-v1-000002`;
- issue `#80`;
- branch `audit-phase7/control-storage-mock-v1`;
- starting SHA `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c`;
- assignment blob SHA from `CURRENT_v1.json`.

Attempt an isolated clone first. If Git transport fails, continue connector-first in a unique writable directory. Do not install or download dependencies.

## Exclusive ownership

Writable paths are limited to:

- `packages/audit-fork-protocol/**`;
- `packages/audit-forks/**`;
- `packages/audit-fork-mock-adapter/**`;
- tests beginning `test/audit-phase7-fork-`, `test/audit-phase7-checkpoint-`, or `test/audit-phase7-mock-`;
- one durable review beginning `docs/audit/reviews/2026-08-01-audit-phase7-control-storage-mock-`.

Do not modify Phase 1–6 packages except read-only imports from accepted neutral protocol/storage primitives. Do not modify API/web, workflows, deployments, executors, integration branches, Worker 1/2/3 paths, GitHub Direct packages/specifications/plans, or CurveYield Lite.

This assignment has no writable overlap with Worker 1 issue #72, Worker 3 issue #79, Worker 2's completed issue #77, or orchestrator planning issue #81.

## Restrictions

No dependency installation/download, package manager, compilation, build, external audit tool, submitted project, container, live RPC, wallet/key/signer, transaction/calldata broadcast, deployment, workflow approval, production secret, AWS, execution enablement, or merge to `main`.

## Reporting destination

Read `.agent-control/v1/REPORT_DESTINATION_POLICY_v1.md`.

Post startup, progress, blocker, and final reports only to issue #80. Immediately before final reporting:

1. Re-fetch `CURRENT_v1.json`.
2. Re-fetch this assignment and verify its blob SHA and `issue_number: 80`.
3. Post only to issue #80.
4. Re-fetch issue #80 and verify the report exists.
5. Record the exact issue-comment URL and numeric comment ID in completed `STATUS_v1.json` and the completion event.

Completion is invalid without those durable records.

## Completion

Use focused test-first direct Node work and preserve initial red evidence. Commit only to `audit-phase7/control-storage-mock-v1`. The final report must include exact starting/final SHAs, every changed file, red/green commands/counts, interface inventory, identity/auth/state-transition and checkpoint/export/quota/retention truth tables, storage operation traces, mock replay results, static boundary results, blocked active-compute/API checks, residual risks, and `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT`.