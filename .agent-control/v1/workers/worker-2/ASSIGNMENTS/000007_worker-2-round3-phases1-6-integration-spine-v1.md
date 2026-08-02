---
protocol_version: 1
message_id: worker-2-round3-phases1-6-integration-spine-v1-000007
sequence: 7
worker_id: worker-2
issued_at: 2026-08-02T02:27:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 114
branch: audit-round3/phases1-8-release-integration-v1
starting_sha: 5f834d9702a4d28061222a64cfa9d870c97a4978
supersedes_message_id: worker-2-round2-phases1-8-integration-v1-000006
assignment_state: ready
---

# Worker 2 — Round 3 Phase 1–6 hardening and integration spine v1

Read issue #114 in full. It is the authoritative 20-section, five-checkpoint implementation, independent source-review, integration-manifest, verification, and reporting contract.

## Objective

Produce the authoritative hardened Phase 1–6 candidate and final platform integration spine. Re-review all compact issue #103 adaptations, repair weakened semantics test-first, build strict source/blob/interface intake contracts for the other Round 3 candidates, and publish the Round 4 master intake manifest.

## Bootstrap

Re-fetch this assignment, Worker 2 `CURRENT_v1.json`, issues #103 and #114, the assigned branch, and starting SHA. Verify sequence 7, message ID, issue, branch, assignment blob, and zero unexpected starting delta before editing.

## Mandatory scope

Complete all 20 ordered sections and all five checkpoints in issue #114. The stale Phase 7–8 production currently present is a superseded input: do not modify or accept it as final. Round 4 will replace it from Worker 0 by exact path.

## Frozen boundary

Do not modify the GitHub-native simulation/App/RPC addon, including `.github/workflows/github-native-simulate.yml`, `packages/github-native-sim/**`, runner RPC-policy/guard files, or related docs/tests. Do not touch other workers' owned paths.

## Restrictions

No dependency installation/download, compilation/build, submitted-project/external-tool execution, process/container/network/RPC, wallet/signing/transaction/broadcast, deployment, workflow approval, production secrets, PR, branch merge, or merge to `main`.

## Reporting

Post startup, five checkpoints, blockers, and final report only to issue #114. Re-fetch the mailbox and every checkpoint before final reporting. Record the exact final report URL/comment ID in completed status and the completion event.