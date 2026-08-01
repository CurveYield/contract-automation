---
protocol_version: 1
message_id: worker-2-round1-phases1-6-reconstruction-v1-000004
sequence: 4
worker_id: worker-2
issued_at: 2026-08-01T17:00:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 95
branch: audit-round1/phases1-6-reconstruction-v1
starting_sha: 49a606ef35e9e0f253e20c689e64c0f8945f8cb2
supersedes_message_id: worker-2-phase6-result-contract-compatibility-v1-000003
assignment_state: ready
---

# Worker 2 — Round 1 Phase 1–6 latest-main reconstruction v1

Read GitHub issue #95 in full. It is the authoritative implementation, ownership, checkpoint, verification and reporting contract.

## Objective

Reconstruct and independently accept the complete approved Audit Phase 1–6 control-plane and inert tool-contract stack onto reviewed latest-main SHA `49a606ef35e9e0f253e20c689e64c0f8945f8cb2`, while preserving every newer GitHub-native simulation fix and excluding all active Worker 1, Worker 0 and Worker 3 paths.

This is intentionally a large integration workload. Completion requires all sixteen issue sections, all four checkpoint comments, a source/destination provenance manifest, combined Phase 1–6 tests, and a durable review. Copying files without executing the reconstructed acceptance suite is not completion.

## Bootstrap

Re-fetch this assignment, Worker 2 `CURRENT_v1.json`, issue #95, issue #94, and the four Round 1 integration control records. Verify:

- sequence `4`;
- message ID `worker-2-round1-phases1-6-reconstruction-v1-000004`;
- issue `#95`;
- branch `audit-round1/phases1-6-reconstruction-v1`;
- starting SHA `49a606ef35e9e0f253e20c689e64c0f8945f8cb2`;
- assignment blob SHA from `CURRENT_v1.json`;
- starting branch is identical to latest reviewed main.

Attempt an isolated clone first. If Git transport fails, continue connector-first in a unique writable directory. Do not install or download dependencies.

## Critical integration rules

- Never merge or cherry-pick stale worker ancestry.
- Transplant only accepted owned paths from the exact source SHAs in issue #95.
- Record source blob/digest and destination blob/digest for every transplanted path.
- Preserve all latest-main GitHub-native simulation files and later fixes.
- Do not touch Worker 1 Phase 4 catalog/API paths, Worker 0 Phase 7 paths, Worker 3 Phase 8 paths, GitHub Direct paths, Lite or unrelated code.
- Where a shared file needs adaptation, write a failing integration test first, make the minimal union, and record the adaptation.

## Mandatory checkpoints

Post only to issue #95:

1. Sections 1–4: latest-main preservation and Phase 1–3 reconstruction.
2. Sections 5–8: Phase 4 core/result reconstruction and congruence.
3. Sections 9–12: Phase 5/6 reconstruction and congruence.
4. Sections 13–16: cross-phase acceptance, static boundary, provenance and completion candidate.

Each checkpoint must pin exact branch SHA, paths, commands/counts, provenance totals, adaptations and unresolved incompatibilities.

## Restrictions

No dependency installation/download, package manager, compilation, build, submitted-project/tool execution, process spawning, container, live network/RPC, wallet/key/signer, transaction/calldata/broadcast, deployment, workflow approval, production secret, branch merge, PR, or merge to `main`. Keep submitted execution disabled.

## Reporting

Post startup, checkpoints, blockers and final report only to issue #95. Immediately before final reporting, re-fetch the mailbox pointer and assignment, verify all four checkpoint comments, post the final report, re-fetch it, and record the exact URL and numeric comment ID in completed status and the completion event.
