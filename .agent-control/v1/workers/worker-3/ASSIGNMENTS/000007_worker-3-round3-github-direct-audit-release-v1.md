---
protocol_version: 1
message_id: worker-3-round3-github-direct-audit-release-v1-000007
sequence: 7
worker_id: worker-3
issued_at: 2026-08-02T02:28:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 115
branch: audit-round3/github-direct-audit-release-v1
starting_sha: 66c3060da74ba79a780847eb86307d0b5641b20a
supersedes_message_id: worker-3-phase9-github-direct-service-workflow-v1-000006
assignment_state: ready
---

# Worker 3 — Round 3 GitHub Direct Audit release candidate v1

Read issue #115 in full. It is the authoritative 20-section, five-checkpoint implementation, independent source-review, security, workflow, verification, and reporting contract.

## Scope clarification

This assignment concerns `github-direct-audit-v1`, the Audit control plane. It does not concern the GitHub-native contract simulation/App/RPC addon.

## Objective

Produce the final GitHub Direct Audit candidate: protocol, ledger, authorization capabilities, adapter, service, CLI, reporting, trusted workflow, replay/recovery, compatibility contracts, operating guide, and Round 4 handoff manifest.

## Bootstrap

Re-fetch this assignment, Worker 3 `CURRENT_v1.json`, issues #98, #104 and #115, the assigned branch, and starting SHA. Verify sequence 7, message ID, issue, branch, assignment blob, and zero unexpected starting delta before editing.

## Mandatory scope

Complete all 20 ordered sections and all five checkpoints in issue #115. Re-running the prior suite or changing documentation alone is not completion.

## Frozen boundary

Do not modify the GitHub-native simulation/App/RPC addon, including `.github/workflows/github-native-simulate.yml`, `packages/github-native-sim/**`, runner RPC-policy/guard/run-job files, or related docs/tests. Do not touch other workers' owned paths.

## Restrictions

No dependency installation/download, compilation/build, live GitHub/network calls, submitted-project execution, process/container/RPC, wallet/signing/transaction/broadcast, deployment, production secrets, workflow approval, PR, branch merge, or merge to `main`.

## Reporting

Post startup, five checkpoints, blockers, and final report only to issue #115. Re-fetch the mailbox and every checkpoint before final reporting. Record the exact final report URL/comment ID in completed status and the completion event.