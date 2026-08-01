# GitHub Mailbox Work-Package Policy v1

## Purpose

Hourly Scheduled Tasks are the minimum supported polling cadence. To reduce idle time, every new implementation assignment should be a coherent **30–60 minute work package**, not a single microtask.

This policy supplements `PROTOCOL_v1.md`. The immutable assignment and ownership rules remain unchanged.

## Required work-package shape

Each new assignment should contain 3–7 ordered subtasks that:

- share one implementation branch and one ownership boundary;
- can be completed and reported together;
- have explicit dependencies and completion gates;
- include focused red/green tests where behavior changes;
- include static verification and documentation where appropriate;
- avoid dependency installation, compilation, deployment, submitted execution, and forbidden paths;
- normally require approximately 30–60 minutes of active agent work.

Do not pad work with redundant checks. The duration target must come from useful adjacent work that would otherwise require another handoff.

## Execution state machine

A worker must:

1. Validate and acknowledge the immutable assignment exactly once.
2. Execute all ordered subtasks in the same assignment before declaring completion.
3. Keep status `working` when one or more required subtasks remain.
4. Resume from GitHub state on later runs rather than restarting completed subtasks.
5. Post one consolidated issue report covering every subtask.
6. Mark `completed` only when the entire package is complete.

## Assignment publication rule

- Never publish a second active assignment to a worker.
- Future work packages may be prepared under `.agent-control/v1/orchestrator/HANDOFF/QUEUED_WORK/`, but they are not executable instructions.
- A queued package becomes active only after independent review of the prior final SHA and publication as a new immutable assignment under the worker's `ASSIGNMENTS/` directory followed by a `CURRENT_v1.json` pointer update.

## Cadence optimization

- Worker polls: hourly at minute `00` America/Los_Angeles.
- Orchestrator poll: hourly at minute `55` America/Los_Angeles.

This gives workers most of the hour for a 30–55 minute package and gives the orchestrator a five-minute publication window before the next worker poll when review completes in the same cycle.

The platform still cannot guarantee zero idle time. The purpose of this policy is to reduce the number of handoffs, not to claim sub-hour automation.
