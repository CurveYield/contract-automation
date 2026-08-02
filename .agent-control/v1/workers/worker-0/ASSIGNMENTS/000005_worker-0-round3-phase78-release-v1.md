---
protocol_version: 1
message_id: worker-0-round3-phase78-release-v1-000005
sequence: 5
worker_id: worker-0
issued_at: 2026-08-02T02:25:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 112
branch: audit-round3/phase78-service-release-v1
starting_sha: 13af0c6c6c3d74ceacdc1894d6f3146460884fb4
supersedes_message_id: worker-0-phase9-phase78-service-reporting-v1-000004
assignment_state: ready
---

# Worker 0 — Round 3 Phase 7–8 core/service release candidate v1

Read issue #112 in full. It is the authoritative 20-section, five-checkpoint implementation, independent source-review, verification, and reporting contract.

## Objective

Produce the final Phase 7 persistent-fork, Phase 8 clean-room, and Phase 9 transport-neutral service/report/publication candidate. Implement every issue #111 lifecycle, recovery, tenant-read, hostile-boundary, merge/relation, and provenance repair test-first; reconcile operation budgets and service/report behavior; and publish a complete Round 4 handoff manifest.

## Bootstrap

Re-fetch this assignment, Worker 0 `CURRENT_v1.json`, issues #97, #101, #111 and #112, the assigned branch, and starting SHA. Verify sequence 5, message ID, issue, branch, assignment blob, and zero unexpected starting delta before editing.

## Mandatory scope

Complete all 20 ordered sections and all five checkpoints in issue #112. A documentation-only repair, unchanged re-acceptance, or focused happy-path suite is invalid.

## Frozen boundary

Do not modify the GitHub-native simulation/App/RPC addon, including `.github/workflows/github-native-simulate.yml`, `packages/github-native-sim/**`, runner RPC-policy/guard files, or related docs/tests. Do not touch other workers' owned paths.

## Restrictions

No dependency installation/download, compilation/build, submitted-project/external-tool execution, process/container/network/RPC, wallet/signing/transaction/broadcast, deployment, workflow approval, production secrets, PR, branch merge, or merge to `main`.

## Reporting

Post startup, five checkpoints, blockers, and final report only to issue #112. Re-fetch the mailbox and every checkpoint before final reporting. Record the exact final report URL/comment ID in completed status and the completion event.