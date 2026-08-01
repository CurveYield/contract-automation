---
protocol_version: 1
message_id: worker-3-phase5-result-contract-compatibility-000001
sequence: 1
worker_id: worker-3
issued_at: 2026-08-01T12:26:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 71
branch: audit-phase5/result-contract-compatibility-v1
starting_sha: 0145922dc09756e69e58c0eb3a9feba24c86d2fd
supersedes_message_id: null
assignment_state: ready
---

# Worker 3 — Phase 5 result contract, catalog, and compatibility gate v1

Read GitHub issue #71 in full. Its body is the authoritative implementation, ownership, verification, and reporting contract.

## Objective

Implement a strict Phase 5 normalized-result runtime contract, deterministic four-profile catalog, cross-package compatibility assertions, and authoritative fixture replay/inventory gate using the accepted Phase 5 profile and parser packages.

## Bootstrap

Scheduled or manually awakened invocations do not inherit ChatGPT Project files, uploaded ZIPs, local worktrees, `gh`, or hidden context. Attempt an isolated clone first; if Git transport fails, continue connector-first. Verify issue #71, branch `audit-phase5/result-contract-compatibility-v1`, and starting SHA `0145922dc09756e69e58c0eb3a9feba24c86d2fd` before editing.

## Restrictions

Do not modify existing Phase 5 profile-contract/parser production paths or fixtures. Do not touch Phase 4, Phase 6, API, web, workflows, deployment, integration branches, or CurveYield Lite. No dependency installation, compilation, external tools, submitted projects, containers, deployment, execution enablement, or merge to `main`.

## Completion

Use focused red/green direct Node tests. Commit only to the assigned branch and post the complete final report to issue #71 with pinned SHA, changed files, exports, fixture replay results, boundary evidence, blocked checks, residual risks, and a final recommendation.