---
protocol_version: 1
message_id: worker-3-phase9-github-direct-core-v1-000005
sequence: 5
worker_id: worker-3
issued_at: 2026-08-01T17:22:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 98
branch: audit-phase9/github-direct-core-v1
starting_sha: c1f624cee5de9644736d6ab8f967661e6ae348fd
supersedes_message_id: worker-3-phase8-clean-room-control-merge-v1-000004
assignment_state: ready
---

# Worker 3 — GitHub Direct core protocol, ledger, adapter, and disabled runner v1

Read GitHub issue #98 in full. It is the authoritative implementation, ownership, checkpoint, verification, and reporting contract.

## Objective

Implement the core half of `github-direct-audit-v1`: pure protocol, repository-native ledger planner, dependency-injected least-privilege GitHub adapter, and execution-disabled runner. Preserve `cloudflare-audit-v1` unchanged and operate with all Cloudflare/R2 credentials absent.

## Mandatory work size

Complete all sixteen sections and all four checkpoints in issue #98. A protocol-only result or happy-path adapter is not completion. Required evidence includes hostile/mutation matrices, ledger partial-write recovery, exact permission/transport traces, idempotent reporting, exact-SHA admission, fixture policy, execution-disabled outcomes, static cross-mode gates, and a durable review.

## Bootstrap

Re-fetch this assignment, Worker 3 `CURRENT_v1.json`, issue #98, the approved GitHub Direct design/specification/implementation plan, and the exact starting SHA. Verify sequence `5`, message ID, branch, issue, assignment blob SHA, and zero starting delta.

## Non-overlap

Do not modify CLI or workflows, Phase 1–8 packages, Worker 0/1/2 paths, API/web, Cloudflare/R2 infrastructure, GitHub-native simulation code, CurveYield Lite, deployment, or unrelated files.

## Restrictions

No dependency installation/download, package manager, compilation/build, live GitHub/network calls, submitted-project or external-tool execution, process/container/RPC, wallet/key/signing, transaction/broadcast, deployment, workflow creation/approval, production secret, branch merge, PR, or merge to `main`.

## Reporting

Post startup, four checkpoints, blockers, and final report only to issue #98. Before final reporting, re-fetch the mailbox pointer and all checkpoint comments; record the exact final report URL/comment ID in completed status and the completion event.