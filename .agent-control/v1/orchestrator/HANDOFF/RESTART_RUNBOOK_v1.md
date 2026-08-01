# Replacement Orchestrator Restart Runbook v1

## Objective

Resume orchestration safely from GitHub without depending on predecessor chat context.

## A. Establish live state

1. Fetch `agent-control-plane-v1` and record its exact head SHA.
2. Read `PROTOCOL_v1.md`, `GLOBAL_STATE_v1.json`, and this handoff package.
3. Read every Worker 0–3 `CURRENT_v1.json`.
4. Read every available Worker 0–3 `STATUS_v1.json`.
5. Verify status ownership: the orchestrator must not create, repair, or overwrite worker status files.
6. Inspect the referenced immutable assignment and blob SHA for every sequence greater than zero.
7. Inspect the relevant issue and branch for every worker.
8. Inspect issue #55 directly for Worker 4.
9. List active Scheduled Tasks and verify the expected titles without creating duplicates.

## B. Classify each worker

For each worker, classify one of:

- `uninitialized`: required worker status absent;
- `idle`: no active work and no new sequence;
- `working`: valid current assignment or sequence-zero migration assignment is underway;
- `blocked` or `rejected`: inspect blocker/rejection event and issue report;
- `completed-unreviewed`: valid completed status and issue report exist, but exact final SHA is not independently accepted;
- `accepted-awaiting-integration`;
- `integrated`;
- `retired`.

Do not collapse `completed-unreviewed` into accepted.

## C. Review a completed worker

1. Read the worker-owned completed status.
2. Confirm the final SHA is exactly 40 lowercase hexadecimal characters.
3. Fetch the issue report and ensure it identifies the same final SHA, branch, issue, recommendation, changed files, commands, restrictions, and blockers.
4. Compare the final SHA against the assigned starting SHA.
5. Inspect every changed path against ownership and forbidden paths.
6. Inspect source and tests directly; do not rely only on the report.
7. Verify predecessor and phase-order gates.
8. Decide `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT`.
9. Record the decision as an append-only orchestrator event.
10. Integrate only if authorized and all gates are satisfied.
11. Publish the next mailbox assignment only after integration/review state is durable.

## D. Integrate accepted work

- Pin the exact reviewed worker SHA in the PR body.
- Target only the correct integration branch.
- Confirm the PR contains only accepted paths.
- Merge with the expected head SHA guard.
- Verify the resulting integration commit and branch state.
- Record the PR number, merge commit, source SHA, and decision in orchestrator events and global state.
- Never merge to `main` as part of this orchestration process.

## E. Publish follow-up work

1. Confirm no active assignment exists for that worker.
2. Confirm no overlapping worker may still write the target paths.
3. Create or verify the dedicated implementation branch and exact starting SHA.
4. Create/update the authoritative GitHub issue.
5. Determine the next per-worker sequence as current sequence plus exactly one.
6. Create a new immutable assignment file under that worker's `ASSIGNMENTS/` directory.
7. Fetch the assignment's blob SHA.
8. Update `CURRENT_v1.json` with only the pointer and integrity metadata.
9. Append an orchestrator publication event.
10. Update global state last.

## F. Stale workers

- `working` with no status update for 3 hours: record potentially stale.
- No update for 6 hours: classify blocked pending review.
- Do not reassign overlapping paths while the prior worker might still write.
- Publish a higher-sequence cancellation or retirement control assignment before transferring ownership.

## G. Worker 4 retirement

Worker 4 may finish issue #55. After its exact final SHA and report are reviewed:

1. record the acceptance/rejection decision;
2. do not issue follow-up work;
3. update global/orchestrator-owned state to `retired`;
4. preserve its branch, issue, report, and events;
5. do not create a Worker 4 Scheduled Task unless James explicitly changes the plan.

## H. Scheduled polling limitation

Hourly is the fastest supported recurring cadence. The scheduler does not visibly put a chat into a waiting state. A task may exist while `last_run_time` remains null until its first scheduled invocation.

Do not claim automation has run merely because a task exists. Verify `last_run_time` and mailbox writes.

## I. Replacement startup report

Post to continuity issue #63:

- replacement runtime/session identity when available;
- control-plane head SHA;
- active Scheduled Task titles and last-run observations;
- Worker 0–4 refreshed states;
- discrepancies from the dated snapshot;
- immediate actions taken;
- confirmation that no forbidden operation occurred.
