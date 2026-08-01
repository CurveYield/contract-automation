---
protocol_version: 1
message_id: worker-2-phase4-result-contract-compatibility-000001
sequence: 1
worker_id: worker-2
issued_at: 2026-08-01T11:27:00Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 57
branch: audit-phase4/result-contract-compatibility-v1
starting_sha: d90099c201d3012c090b6f73dda604bd5b143c95
supersedes_message_id: null
assignment_state: ready
---

# Worker 2 — Phase 4 result contract and compatibility gate v1

## Authoritative specification

Read GitHub issue #57 in `CurveYield/contract-automation` in full before editing. The issue body is the authoritative implementation, ownership, acceptance, and reporting contract.

## Bootstrap

Independent scheduled invocations do not inherit a checkout, ChatGPT Project files, uploaded ZIPs, `AGENTS.md`, `gh`, or hidden chat context. Attempt an isolated single-branch clone first. If Git transport cannot resolve GitHub, continue connector-first in a unique worker-owned directory.

Verify before editing:

- repository `CurveYield/contract-automation`;
- issue #57;
- branch `audit-phase4/result-contract-compatibility-v1`;
- exact starting SHA `d90099c201d3012c090b6f73dda604bd5b143c95`;
- no branch drift or cross-worker path ownership.

## Objective

Implement the strict normalized `tool-result-v1` JavaScript runtime contract and deterministic compatibility gates tying together the accepted Phase 4 profile templates, invocation plans, parser versions, parser results, schemas, and CurveYield-owned fixtures.

The implementation must remain non-executing and must not overlap Worker 1's catalog/API paths.

## Owned paths

- `packages/audit-tool-result-contracts/**`;
- focused tests inside that package;
- integration tests whose filenames begin `audit-phase4-result-` or `audit-phase4-compatibility-`.

Production code must not read files. Tests may read only repository-owned Phase 4 fixtures.

## Forbidden paths and actions

Do not modify profile contracts, adapters, parsers, Phase 4 fixtures, catalog/API paths, Phase 5 or 6 paths, workflows, deployment files, CurveYield Lite, or submitted-project execution code.

Do not install or download dependencies, compile, deploy, execute external audit tools, run submitted projects, use containers, add production secrets, enable execution, use AWS, or merge to `main`.

## Required method and completion

Use focused test-first development, record red then green evidence, commit and push only to the assigned branch, and post the complete final report to issue #57. The report must include starting and final SHAs, changed files, commands/results, interfaces, fixture replay evidence, security-boundary confirmation, blocked checks, discovered defects, residual risks, and an `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT` recommendation.

Do not open or merge a phase PR. The orchestrator performs independent review and integration.