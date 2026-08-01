---
protocol_version: 1
message_id: worker-3-phase9-github-direct-service-workflow-v1-000006
sequence: 6
worker_id: worker-3
issued_at: 2026-08-01T23:35:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 104
branch: audit-phase9/github-direct-service-workflow-v1
starting_sha: 2df9cbfd534ab97da9aa26077879433a7fc4a8a4
supersedes_message_id: worker-3-phase9-github-direct-core-v1-000005
assignment_state: ready
---

# Worker 3 — Phase 9 GitHub Direct service, CLI, trusted workflow, and reporting v1

Read GitHub issue #104 in full. It is the authoritative ownership, implementation, checkpoint, verification, and reporting contract.

## Objective

Complete GitHub Direct mode around the accepted core: service orchestration, injected App authorization capabilities, CLI, idempotent Check/status/comment reporting, bounded artifact metadata, trusted pinned workflow, end-to-end fake-GitHub scenarios, adversarial matrices, and execution-disabled proof.

## Mandatory work size

Complete all sixteen ordered sections and all four checkpoint comments in issue #104. CLI-only or workflow-only completion is invalid.

## Bootstrap

Re-fetch this assignment, Worker 3 `CURRENT_v1.json`, issue #104, branch, and exact starting SHA. Verify sequence 6 and assignment blob before editing.

## Non-overlap

Do not touch Worker 0/1/2/4 paths, Cloudflare/R2 production packages, GitHub-native simulation, runner/RPC policy, Lite, submitted executor, deployment, or secrets.

## Restrictions

No dependency installation, build, live GitHub/network calls, submitted execution, process/container/RPC, wallet/signing/transaction/broadcast, deployment, production secrets, workflow approval, branch merge, PR, or merge to main.

## Reporting

Post startup, four checkpoints, blockers, and final report only to issue #104. Record the exact final report URL/comment ID in completed status and the completion event.