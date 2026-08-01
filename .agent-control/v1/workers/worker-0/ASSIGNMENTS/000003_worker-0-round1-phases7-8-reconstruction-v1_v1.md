---
protocol_version: 1
message_id: worker-0-round1-phases7-8-reconstruction-v1-000003
sequence: 3
worker_id: worker-0
issued_at: 2026-08-01T17:22:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 97
branch: audit-round1/phases7-8-reconstruction-v1
starting_sha: c1f624cee5de9644736d6ab8f967661e6ae348fd
supersedes_message_id: worker-0-phase7-control-storage-mock-v1-000002
assignment_state: ready
---

# Worker 0 — Round 1 Phase 7–8 reconstruction and repair v1

Read GitHub issue #97 in full. It is the authoritative implementation, ownership, checkpoint, verification, and reporting contract.

## Objective

Reconstruct Phase 7 and Phase 8 onto latest-main SHA `c1f624cee5de9644736d6ab8f967661e6ae348fd`, repair every source-review defect test-first, prove cross-phase identity/storage/non-interference/retry behavior, and produce a provenance-backed integration candidate.

The prior Phase 7 and Phase 8 `ACCEPT` reports are superseded as acceptance evidence. Their branches are untrusted source inputs only. Documentation-only remediation is invalid.

## Mandatory work size

Complete all sixteen sections and all four checkpoints in issue #97. This includes source-to-destination provenance for every path, Phase 7 deletion/index repair, Phase 8 authorization/storage/runtime repair, broad multi-tenant and mutation suites, cross-phase integration, static capability review, latest-main preservation, and a durable review.

## Bootstrap

Re-fetch this assignment, Worker 0 `CURRENT_v1.json`, issue #97, issue #94, source issues #80/#91, both source branches, and the exact starting SHA. Verify sequence `3`, message ID, branch, issue, assignment blob SHA, and zero starting delta.

## Non-overlap

Do not touch Worker 1 Phase 4 catalog/API, Worker 2 Phase 1–6 reconstruction, Worker 3 GitHub Direct core, GitHub-native simulation code, API/web/workflows/deployment, CurveYield Lite, or unrelated paths.

## Restrictions

No dependency installation/download, package manager, compilation/build, submitted-project or external-tool execution, process/container/network/RPC, wallet/key/signing, transaction/broadcast, deployment, workflow approval, production secret, branch merge, PR, or merge to `main`. Keep execution disabled.

## Reporting

Post startup, four checkpoints, blockers, and final report only to issue #97. Before final reporting, re-fetch the mailbox pointer and all checkpoint comments; record the exact final report URL/comment ID in completed status and the completion event.