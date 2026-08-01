---
protocol_version: 1
message_id: worker-3-phase5-parser-lifecycle-repair-v1-000003
sequence: 3
worker_id: worker-3
issued_at: 2026-08-01T15:20:45Z
issued_by: orchestrator
repository: CurveYield/contract-automation
issue_number: 79
branch: audit-phase5/parser-lifecycle-repair-v1
starting_sha: dd78a76f9546c85e79357a617b219067704c1616
supersedes_message_id: worker-3-phase5-result-contract-hardening-v2-000002
assignment_state: ready
---

# Worker 3 — Phase 5 parser lifecycle normalization and terminal-envelope repair v1

Read GitHub issue #79 in full. Its body is the authoritative implementation, ownership, verification, and reporting contract.

## Objective

Repair the accepted Phase 5 parser mismatch where `resource_exhaustion` preserves a raw process exit code instead of emitting the terminal-contract value `exitCode: null`. Then prove all four Phase 5 parsers are congruent with the accepted result contract across completed, timeout, cancelled, resource-exhausted, malformed, parser-error, and invalid-profile cases.

This is a long, bounded 60–120 minute package. Complete all nine ordered sections in issue #79.

## Bootstrap

Re-fetch this immutable assignment, Worker 3 `CURRENT_v1.json`, issue #79, and branch state before editing. Verify:

- sequence `3`;
- message ID `worker-3-phase5-parser-lifecycle-repair-v1-000003`;
- issue `#79`;
- branch `audit-phase5/parser-lifecycle-repair-v1`;
- starting SHA `dd78a76f9546c85e79357a617b219067704c1616`;
- assignment blob SHA from `CURRENT_v1.json`.

Attempt an isolated clone first. If Git transport fails, continue connector-first in a unique writable directory. Do not install or download dependencies.

## Exclusive ownership

Writable paths are limited to:

- `packages/audit-phase5-parsers/**`;
- focused tests beginning `test/audit-phase5-parser-lifecycle-`, `test/audit-phase5-parser-contract-`, or `test/audit-phase5-terminal-`;
- one durable review beginning `docs/audit/reviews/2026-08-01-audit-phase5-parser-lifecycle-repair-`.

Phase 5 result-contract, catalog, profile-contract, and fixture production files are read-only compatibility inputs. Do not modify Phase 1–4, Phase 6, API, web, workflow, deployment, executor, integration, GitHub Direct, or CurveYield Lite paths.

This assignment has no writable overlap with Worker 0 issue #70 / queued #80, Worker 1 issue #72, Worker 2 completed issue #77, or orchestrator planning issue #81.

## Restrictions

No dependency installation/download, package manager, compilation, build, external audit tool, submitted project, container, live RPC, wallet, signing, transaction, broadcast, deployment, workflow approval, production secret, AWS, execution enablement, or merge to `main`.

## Reporting destination

Read `.agent-control/v1/REPORT_DESTINATION_POLICY_v1.md`.

Post startup, progress, blocker, and final reports only to issue #79. Immediately before final reporting:

1. Re-fetch `CURRENT_v1.json`.
2. Re-fetch this assignment and verify its blob SHA and `issue_number: 79`.
3. Post only to issue #79.
4. Re-fetch issue #79 and verify the report exists.
5. Record the exact issue-comment URL and numeric comment ID in completed `STATUS_v1.json` and the completion event.

Completion is invalid without those durable records.

## Completion

Use test-first direct Node work and preserve initial red evidence. Commit only to `audit-phase5/parser-lifecycle-repair-v1`. The final report must include exact starting/final SHAs, every changed file, red/green commands and counts, the all-profile lifecycle truth table, exit-code normalization rules, parser/result-contract congruence results, permutation and adversarial totals, static boundary results, blocked checks, residual risks, and `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT`.