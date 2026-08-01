---
protocol_version: 1
message_id: worker-1-phase9-catalog-api-gpt-composition-replacement-v1-000003
sequence: 3
worker_id: worker-1
issued_at: 2026-08-01T23:38:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 102
branch: audit-phase9/catalog-api-gpt-composition-v1
starting_sha: fec9968b2c24250a1decee270a86d4db9ae31bff
supersedes_message_id: worker-1-phase9-catalog-api-gpt-composition-v1-000002
assignment_state: ready
---

# Replacement Worker 1 — Phase 9 catalog, API, GPT, and capability composition v1

The prior Worker 1 runtime was retired before consuming or completing sequence 2. Read GitHub issue #102 in full. It remains the authoritative ownership, implementation, checkpoint, verification, and reporting contract.

## Objective

Re-prove and finish the Phase 4 catalog/API work, then implement the complete read-only Phase 4–6 catalog, aggregate capability, report-discovery, and GPT-facing API subsystem with strict authentication, pagination, caching boundaries, redaction, hidden-resource non-interference, real entry composition, hostile-boundary tests, and static execution-disabled proof.

## Mandatory work size

Complete all sixteen ordered sections and all four checkpoint comments in issue #102. Reconciliation of issue #72 alone is not completion.

## Bootstrap

Re-fetch this assignment, Worker 1 `CURRENT_v1.json`, issue #102, issue #72 for historical context, the assigned branch, and exact starting SHA. Verify sequence 3, message ID, issue, branch, assignment blob SHA, and zero delta beyond the pinned starting SHA before editing.

## Non-overlap

Do not touch Phase 4–8 core packages, Worker 0/2/3/4 paths, GitHub Direct, web UI, GitHub-native simulation, runner/RPC policy, CurveYield Lite, deployment files, or production credentials.

## Restrictions

No dependency installation/download, compilation/build, submitted-project or external-tool execution, process/container/network/RPC, wallet/key/signing, transaction/broadcast, deployment, workflow approval, production secrets, branch merge, PR, or merge to `main`.

## Reporting

Post startup, all four checkpoints, blockers, and final report only to issue #102. Before final reporting, re-fetch this assignment and every checkpoint. Record the exact final report URL/comment ID in Worker 1 completed status and completion event.