# GitHub Mailbox Work-Package Policy v2

## Status

This policy supersedes `WORK_PACKAGE_POLICY_v1.md` for all assignments published after 2026-08-01T13:51:00Z.

## Purpose

Manual original-chat coordination creates real handoff overhead. Each new assignment should therefore contain the **largest coherent, non-overlapping work package that is reasonably completable without exhausting the worker's context or sacrificing verification quality**.

The target is useful sustained work, not artificial padding.

## Default package duration

- Normal default: **60–120 minutes** of active worker work.
- Use 30–60 minutes only when ownership, phase ordering, or a hard dependency prevents a larger safe package.
- Do not exceed approximately 120 minutes unless the work is highly repetitive, mechanically verifiable, and has clear internal checkpoints.
- Split work when a package would require multiple unrelated branches, conflicting ownership, phase-gated integration, or too many files to review reliably in one context.

A package should be long because adjacent required work belongs together, not because checks are repeated or scope is broadened unnecessarily.

## Required work-package shape

Each assignment should contain 5–10 ordered sections that:

- share one implementation branch and one narrow ownership boundary;
- produce one independently reviewable result;
- include all immediately adjacent implementation, adversarial testing, fixture replay, static boundary, documentation, and exact-head verification work;
- identify explicit dependencies and phase gates;
- preserve test-first red/green evidence for every behavior change;
- end with a durable review/report and pinned final SHA;
- remain within standing no-install, no-download, no-compile, no-deploy, no-external-execution restrictions.

## Mandatory no-overlap gate

Before publishing any assignment, the orchestrator must compare its writable paths against every active worker assignment.

The assignment must explicitly list:

- its exact writable paths or filename prefixes;
- active workers checked;
- why no writable overlap exists;
- read-only paths that tests may inspect but never modify.

If any active worker may write the same file, directory wildcard, PR description, issue body, branch, generated artifact, or review document, the new assignment must be narrowed, delayed, or moved to a distinct path. Branch isolation alone does not make overlapping ownership safe.

## Execution state machine

A worker must:

1. Re-fetch and validate the immutable assignment exactly once before acknowledgement.
2. Execute every ordered section before declaring completion.
3. Keep status `working` while any required section remains.
4. Resume from exact GitHub branch state rather than restarting completed sections.
5. Stop and report an upstream defect instead of modifying forbidden or overlapping paths.
6. Post one consolidated final report to the exact current assignment issue.
7. Re-fetch that report and record its exact comment URL and numeric comment ID.
8. Mark `completed` only after all code, tests, documentation, report, status, and completion-event records are durable.

## Report destination

Every assignment is governed by `.agent-control/v1/REPORT_DESTINATION_POLICY_v1.md`.

The current immutable assignment's `issue_number` is the only valid report destination. Prior issues and remembered chat instructions are read-only references. A misplaced report does not satisfy completion.

## Assignment publication order

1. Confirm the worker has no unsuperseded active assignment and no overlapping writer.
2. Create the implementation issue with exact scope and sole report destination.
3. Create the implementation branch at the pinned starting SHA.
4. Create the immutable assignment file with the next exact sequence.
5. Fetch and record the assignment blob SHA.
6. Update `CURRENT_v1.json` as the final pointer-publication step.
7. Record an append-only orchestrator event.
8. Update `GLOBAL_STATE_v1.json` last.

Cancellation, rejection, repair, or supersession must be recorded explicitly. Existing assignment files are never edited.

## Package completion quality

A long package is incomplete unless the final report includes:

- starting and final 40-character SHAs;
- every changed file and path-ownership proof;
- exact initial red and final green commands/results;
- focused adversarial and boundary evidence;
- blocked checks and why they were not run;
- residual risks;
- a final `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT` recommendation;
- the exact verified issue-comment URL and numeric comment ID.

## Context-safety checkpoints

For packages approaching the upper duration bound, organize work into internal checkpoints:

1. contract/schema implementation;
2. adversarial and mutation tests;
3. fixture replay and inventory;
4. static boundary verification;
5. durable review and final report.

Commit reviewable progress at meaningful boundaries. Do not post a premature completion report merely to avoid context pressure. If context becomes unsafe, push completed work, post a blocker/progress report to the current assignment issue, update status accurately, and stop before inventing results.