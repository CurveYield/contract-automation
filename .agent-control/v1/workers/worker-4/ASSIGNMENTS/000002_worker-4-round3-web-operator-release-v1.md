---
protocol_version: 1
message_id: worker-4-round3-web-operator-release-v1-000002
sequence: 2
worker_id: worker-4
issued_at: 2026-08-02T02:29:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 116
branch: audit-round3/web-operator-release-v1
starting_sha: 79d86fe29baabc986f7a38aa8c048efb1379a106
supersedes_message_id: worker-4-phase9-web-reports-operator-ui-v1-000001
assignment_state: ready
---

# Worker 4 — Round 3 web/operator production release candidate v1

Read issue #116 in full. It is the authoritative 20-section, five-checkpoint implementation, independent source-review, accessibility, client-state, verification, and reporting contract.

## Objective

Produce the final execution-disabled Audit web/report/operator candidate with strict compatibility contracts, complete lifecycle and report views, safe rendering, client cancellation/cache behavior, operator diagnostics, accessibility, responsive hardening, inert end-to-end flows, and a Round 4 deployment/integration handoff manifest.

## Bootstrap

Re-fetch this assignment, Worker 4 `CURRENT_v1.json`, issues #105 and #116, the assigned branch, and starting SHA. Verify sequence 2, message ID, issue, branch, assignment blob, and zero unexpected starting delta before editing.

## Mandatory scope

Complete all 20 ordered sections and all five checkpoints in issue #116. A visual polish pass, fixture demo, or unchanged re-acceptance is not completion.

## Frozen boundary

Do not modify the GitHub-native simulation/App/RPC addon, including `.github/workflows/github-native-simulate.yml`, `packages/github-native-sim/**`, runner RPC-policy/guard files, or related docs/tests. Do not touch other workers' owned paths.

## Restrictions

No dependency installation/download, unavailable compilation/build, live API/network/RPC calls, submitted-project execution, process/container, wallet/signing/transaction/broadcast, deployment, workflow approval, production secrets, PR, branch merge, or merge to `main`.

## Reporting

Post startup, five checkpoints, blockers, and final report only to issue #116. Re-fetch the mailbox and every checkpoint before final reporting. Record the exact final report URL/comment ID in completed status and the completion event.