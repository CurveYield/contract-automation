# Scheduled Task Recovery v1

## Expected active task set

Under the current Plus-compatible plan, the expected active recurring tasks are exactly:

1. `CurveYield Orchestrator Poll`
2. `CurveYield Worker 0 Poll`
3. `CurveYield Worker 1 Poll`
4. `CurveYield Worker 2 Poll`
5. `CurveYield Worker 3 Poll`

Worker 4 is not a recurring participant after its current issue #55 workload.

## Verification procedure

1. List all Scheduled Tasks.
2. Match by exact title and inspect `is_enabled`, cadence, prompt, timezone, and `last_run_time`.
3. Confirm each expected task exists exactly once.
4. Do not count disabled tasks.
5. Do not claim a task has polled until `last_run_time` or mailbox evidence proves execution.
6. If a duplicate exists, keep the correctly scoped enabled task and disable the duplicate only after comparing prompts and schedules.
7. If a task is missing, recreate only that missing task.

## Cadence

- Recurring polling cannot run more frequently than hourly.
- Use `exact_schedule`.
- Stagger workers and orchestrator when practical so worker status writes can precede orchestrator review.
- At handoff creation, workers were intended to run around `:30` and the orchestrator around `:55` each hour in `America/Los_Angeles`.
- Refresh the actual schedules; this document does not override the live registry.

## Orchestrator task requirements

The orchestrator task must:

- read the protocol, global state, orchestrator status/events, Worker 0–3 current/status records, and issue #55;
- independently review completed workers at pinned SHAs;
- enforce phase ordering and path ownership;
- publish immutable assignments before current pointers;
- update only orchestrator-owned records;
- issue no future work to Worker 4;
- perform no install, compile, deploy, external tool execution, secret addition, AWS use, Lite modification, execution enablement, or main merge.

## Worker task requirements

Each worker task must:

- read only its own current/status plus protocol/global state;
- process only a strictly greater valid sequence;
- create one acknowledgement per assignment;
- resume `working` state rather than duplicate work;
- write only its own ACKS, STATUS, EVENTS, and assigned implementation branch/issue;
- end quietly when idle;
- preserve all no-install/no-compile/no-deploy/security restrictions.

## Failure handling

- Missing status: the owning worker may bootstrap it; the orchestrator may not.
- Task exists but has never run: do not recreate it automatically; inspect the next scheduled time first.
- Task run failed: inspect the mailbox and task output, preserve prior valid state, and record a blocker.
- Scheduled Tasks unavailable: disable claims of unattended operation and fall back to the rollback/manual workflow without deleting mailbox state.

## Replacement warning

Scheduled Tasks are account-level resources, not GitHub files. A replacement chat must list the live registry. Never trust remembered task IDs or assume tasks transfer because the handoff folder exists.
