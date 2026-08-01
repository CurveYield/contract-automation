---
protocol_version: 1
message_id: worker-2-phase6-result-contract-compatibility-v1-000003
sequence: 3
worker_id: worker-2
issued_at: 2026-08-01T14:05:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 77
branch: audit-phase6/result-contract-compatibility-v1
starting_sha: 5b2575eb22b63773e24943f084a72d14f2565e1b
supersedes_message_id: null
assignment_state: ready
---

# Worker 2 — Phase 6 result contract, catalog, replay, and compatibility gate v1

Read GitHub issue #77 in full. Its body is the authoritative implementation, ownership, overlap, verification, checkpoint, and reporting contract.

## Objective

Build and harden the isolated Phase 6 normalized tool-result envelope, deterministic read-only catalog, accepted-fixture replay gate, publication compatibility checks, mutation/adversarial defensive boundaries, static execution boundary, and durable acceptance evidence for `solidity-smt-v1`, `halmos-v1`, and `formal-obligations-v1`.

Complete all nine ordered issue sections before reporting completion. This is the largest coherent non-overlapping work package currently available to Worker 2 and is intended to be completed as one bounded 60–120 minute assignment.

## Bootstrap and exact identity

Scheduled or manually awakened invocations do not inherit ChatGPT Project files, uploaded ZIPs, local worktrees, `gh`, or hidden context. Re-fetch this immutable assignment and Worker 2's `CURRENT_v1.json`; verify sequence `3`, message ID `worker-2-phase6-result-contract-compatibility-v1-000003`, issue `#77`, branch `audit-phase6/result-contract-compatibility-v1`, and starting SHA `5b2575eb22b63773e24943f084a72d14f2565e1b` before editing. Attempt an isolated clone first; if Git transport fails, continue connector-first in a unique Worker 2 directory.

## Writable ownership

Write only to:

- `packages/audit-phase6-result-contracts/**`
- `packages/audit-phase6-tool-catalog/**`
- focused repository tests beginning `test/audit-phase6-result-`, `test/audit-phase6-catalog-`, `test/audit-phase6-compatibility-`, or `test/audit-phase6-replay-`
- one review file beginning `docs/audit/reviews/2026-08-01-audit-phase6-result-contract-compatibility-`

Tests may read but must not modify accepted Phase 6 fixtures.

## Non-overlap and restrictions

This assignment does not overlap Worker 0's Phase 1–3 work, Worker 1's Phase 4 catalog/API work, or Worker 3's Phase 5 result/catalog work. Existing Phase 6 profile-contract, parser, and fixture production paths are read-only upstream inputs. Do not modify Phase 4, Phase 5, API, web, workflow, executor, deployment, integration, shared-protocol, PR, or CurveYield Lite paths.

Do not install or download dependencies; compile or build; execute Solidity, SMTChecker, Halmos, Z3, Foundry, submitted projects, external tools, or containers; deploy; approve workflows; use production secrets or AWS; enable execution; or merge to main.

## Method and checkpoints

Use test-first direct Node and static checks only. Preserve exact red evidence before implementation and fresh green evidence after repair. Post concise progress checkpoints to issue #77 after sections 1–3, 4–6, and 7–9 as specified in the issue.

## Reporting destination and completion

Issue #77 is the sole valid destination for startup, progress, blocker, and final reports. Immediately before posting the final report, re-fetch `CURRENT_v1.json` and this immutable assignment and verify `issue_number: 77`. After posting, re-fetch issue #77, verify the exact comment exists, and record its full comment URL and numeric comment ID in Worker 2's completed `STATUS_v1.json` and completion event.

Commit and push only to `audit-phase6/result-contract-compatibility-v1`. Completion is invalid unless all nine issue sections are complete and the final report is durably verified on issue #77.