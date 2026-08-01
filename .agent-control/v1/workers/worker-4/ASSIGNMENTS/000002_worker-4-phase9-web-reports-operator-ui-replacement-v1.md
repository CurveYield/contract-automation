---
protocol_version: 1
message_id: worker-4-phase9-web-reports-operator-ui-replacement-v1-000002
sequence: 2
worker_id: worker-4
issued_at: 2026-08-01T23:41:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 105
branch: audit-phase9/web-reports-operator-ui-v1
starting_sha: 3f68cc1b12cc7f9a84e4cb04b768c049138814c6
supersedes_message_id: worker-4-phase9-web-reports-operator-ui-v1-000001
assignment_state: ready
---

# Replacement Worker 4 — Phase 9 web reports, operator console, and accessibility hardening v1

The original Worker 4 runtime was deleted and sequence 1 was not consumed. This sequence 2 assignment is authoritative. Read GitHub issue #105 in full; it remains the complete ownership, implementation, checkpoint, verification, and reporting contract.

## Objective

Build the complete execution-disabled Phase 9 Audit web/report surface: strict UI contracts, defensive view models, report/campaign/job/fork/clean-room views, capability/catalog discovery, operator diagnostics, responsive accessible layouts, safe injected client behavior, inert end-to-end flows, adversarial rendering tests, and static boundary proof.

## Mandatory work size

Complete all sixteen ordered sections and all four checkpoint comments in issue #105. A mockup, shell, or happy-path UI is not completion.

## Bootstrap

Re-fetch this assignment, Worker 4 `CURRENT_v1.json`, issue #105, the assigned branch, and exact starting SHA. Verify sequence 2, message ID, issue, branch, assignment blob SHA, and zero starting delta before editing.

## Non-overlap

Do not touch `apps/audit-api/**`, Phase 1–8 core packages, Worker 0/1/2/3 paths, GitHub Direct packages/workflows, GitHub-native simulation, runner/RPC policy, CurveYield Lite, deployment files, or production credentials.

## Restrictions

No dependency installation/download, unavailable build tooling, live API/network calls, submitted-project execution, process/container/RPC, wallet/key/signing, transaction/broadcast, deployment, workflow approval, production secrets, branch merge, PR, or merge to `main`.

## Reporting

Post startup, four checkpoints, blockers, and final report only to issue #105. Before final reporting, re-fetch this assignment and every checkpoint. Record the exact final report URL/comment ID in Worker 4 completed status and completion event.