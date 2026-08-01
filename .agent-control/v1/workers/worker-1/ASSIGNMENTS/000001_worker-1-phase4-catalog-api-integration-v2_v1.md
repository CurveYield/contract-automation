---
protocol_version: 1
message_id: worker-1-phase4-catalog-api-integration-v2-000001
sequence: 1
worker_id: worker-1
issued_at: 2026-08-01T12:38:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 72
branch: audit-phase4/catalog-api-integration-v2
starting_sha: d90099c201d3012c090b6f73dda604bd5b143c95
supersedes_message_id: null
assignment_state: ready
---

# Worker 1 — Phase 4 catalog/API integration and truthful capability repair v2

Read GitHub issue #72 in full. Its body is the authoritative implementation, ownership, verification, and reporting contract.

## Objective

Port the accepted catalog/read-only API work onto the current Phase 4 base containing profiles, adapters, parsers, and fixtures. Repair stale capability reporting, support approved read identities without exposing control-plane or attestation credentials, and prove cross-package catalog integrity.

## Bootstrap

Scheduled or manually awakened invocations do not inherit ChatGPT Project files, uploaded ZIPs, local worktrees, `gh`, or hidden context. Attempt an isolated clone first; if Git transport fails, continue connector-first. Verify issue #72, branch `audit-phase4/catalog-api-integration-v2`, and starting SHA `d90099c201d3012c090b6f73dda604bd5b143c95` before editing.

## Restrictions

Do not modify accepted profile-contract, adapter, parser, fixture, or Worker 2 result-contract paths. Do not touch Phase 5, Phase 6, workflows, deployment, or CurveYield Lite. No dependency installation, compilation, external tools, submitted projects, containers, deployment, production secrets, execution enablement, or merge to `main`.

## Completion

Use focused red/green direct Node tests. Commit only to the assigned branch and post the complete final report to issue #72 with pinned SHA, changed files, capability/auth truth table, test and boundary evidence, blocked checks, residual risks, and a final recommendation.