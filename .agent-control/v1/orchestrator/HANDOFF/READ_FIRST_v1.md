# Replacement Orchestrator — Read First v1

This is the durable entrypoint for any new orchestrator chat replacing an exhausted or unavailable predecessor.

## Identity

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Mailbox root: `.agent-control/v1/`
- Continuity issue: #63
- Timezone: `America/Los_Angeles`

Do not rely on ChatGPT Project files, uploaded ZIPs, hidden chat context, local worktrees, or the predecessor's memory. GitHub is the source of truth.

## Mandatory startup order

1. Read `.agent-control/v1/PROTOCOL_v1.md` in full.
2. Read `.agent-control/v1/GLOBAL_STATE_v1.json`.
3. Read this folder's `CURRENT_STATE_SNAPSHOT_v1.json`, but treat it only as a dated hint.
4. Read `.agent-control/v1/orchestrator/STATUS_v1.json` and all append-only orchestrator events.
5. Read every Worker 0–3 `CURRENT_v1.json` and available `STATUS_v1.json`.
6. Inspect issue #55 directly for Worker 4. Worker 4 finishes only the current workload and must then be retired with no new assignment.
7. List the active ChatGPT Scheduled Tasks. Confirm exactly one orchestrator poll and one poll for each active Worker 0–3. Do not create duplicates.
8. Refresh every referenced GitHub issue, branch, final SHA, PR, and report before acting.
9. Post one startup confirmation to issue #63 with the refreshed state and any discrepancy found.

## First decision rule

Never infer completion from a new branch commit. Completion requires:

- a valid worker-owned `STATUS_v1.json` in `completed` state;
- a pinned 40-character final SHA;
- the required GitHub issue report;
- independent review of the exact SHA and changed paths.

## Assignment publication rule

For any new assignment:

1. Confirm the worker has no active assignment and no potentially overlapping writer.
2. Create a new immutable assignment Markdown file with the next sequence.
3. Fetch and record its exact blob SHA.
4. Update that worker's `CURRENT_v1.json` only after the assignment file exists.
5. Record an append-only orchestrator event.
6. Update `GLOBAL_STATE_v1.json` only after the publication sequence succeeds.

Never silently edit or cancel an old assignment. Supersede or cancel through a higher sequence.

## Phase ordering

- Phase 4 must be accepted before Phase 5 integration.
- Phase 5 must be accepted before Phase 6 integration.
- Worker 4 receives no future work after issue #55.
- Never integrate a mutable branch head; pin and review the reported final SHA.

## Standing restrictions

Do not install or download dependencies, compile, deploy, execute submitted projects or external audit tools, add production secrets, use AWS, modify CurveYield Lite, enable submitted execution, approve deployment workflows, or merge to `main`.

Keep `AUDIT_EXECUTION_ENABLED=false`.

## Files in this handoff package

- `READ_FIRST_v1.md` — this entrypoint.
- `CURRENT_STATE_SNAPSHOT_v1.json` — dated state at handoff creation.
- `RESTART_RUNBOOK_v1.md` — exact recovery and polling workflow.
- `AUTOMATION_RECOVERY_v1.md` — Scheduled Task verification and recreation rules.
- `CONTEXT_EXHAUSTION_CHECKLIST_v1.md` — what every orchestrator must write before replacement.
- `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` — copy-ready prompt for a fresh orchestrator chat.

## Conflict resolution

When this handoff package conflicts with live GitHub mailbox records, live validated records win. When mailbox records conflict internally, stop publication/integration, preserve the last valid state, record a blocker event, and report the discrepancy in issue #63.
