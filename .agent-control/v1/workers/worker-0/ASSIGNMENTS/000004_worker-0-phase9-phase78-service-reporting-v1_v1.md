---
protocol_version: 1
message_id: worker-0-phase9-phase78-service-reporting-v1-000004
sequence: 4
worker_id: worker-0
issued_at: 2026-08-01T23:32:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 101
branch: audit-phase9/phase78-service-reporting-v1
starting_sha: 4c875bb9291d3e714af9cd0013ee5d460f576a2b
supersedes_message_id: worker-0-round1-phases7-8-reconstruction-v1-000003
assignment_state: ready
---

# Worker 0 — Phase 9 persistent-fork and clean-room service/reporting v1

Read GitHub issue #101 in full. It is the authoritative ownership, implementation, checkpoint, verification, and reporting contract.

## Objective

Build the full transport-neutral Phase 9 service/reporting layer over accepted Phase 7–8: strict service contracts, authorization composition, orchestration plans, fork and clean-room report projections, immutable publication plans, CAS/retry/recovery, quota/retention, pagination, multi-tenant E2E, adversarial matrices, and static capability proof.

## Mandatory work size

Complete all sixteen ordered sections and all four checkpoint comments in issue #101. A schema-only or happy-path implementation is not completion.

## Bootstrap

Re-fetch this assignment, Worker 0 `CURRENT_v1.json`, issue #101, branch, and exact starting SHA. Verify sequence 4 and assignment blob before editing.

## Non-overlap

Do not touch API/web/GitHub Direct/workflow/GitHub-native simulation/runner-RPC policy/Phase 1–6/Lite/deployment paths.

## Restrictions

No dependency installation, build, submitted execution, process/container/network/RPC, wallet/signing/transaction/broadcast, deployment, workflow approval, production secrets, branch merge, PR, or merge to main.

## Reporting

Post startup, four checkpoints, blockers, and final report only to issue #101. Record the exact final report URL/comment ID in completed status and the completion event.