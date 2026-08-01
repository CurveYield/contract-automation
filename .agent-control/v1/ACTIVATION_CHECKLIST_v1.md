# GitHub Mailbox Orchestration Activation Checklist v1

The control plane is installed but must not be described as fully active until every required item is complete.

## Installed

- [x] Dedicated branch `agent-control-plane-v1` exists.
- [x] Protocol is stored at `.agent-control/v1/PROTOCOL_v1.md`.
- [x] Orchestrator status and Worker 0–4 pointer records exist.
- [x] Current sequence-0 work is represented in `GLOBAL_STATE_v1.json` and is not republished.
- [x] Worker 2's not-yet-started issue #57 follow-up is published as immutable sequence 1.
- [x] Worker 4 is designated current-workload-only and receives no future assignment.
- [x] Worker status files remain owner-created; the orchestrator has not retained worker-authored status records.

## Required before activation claim

- [x] Orchestrator hourly Scheduled Task is enabled.
- [ ] Worker 0 hourly Scheduled Task is enabled.
- [ ] Worker 1 hourly Scheduled Task is enabled.
- [ ] Worker 2 hourly Scheduled Task is enabled.
- [ ] Worker 3 hourly Scheduled Task is enabled.
- [x] Orchestrator completes one read-only polling cycle.
- [ ] Workers 0–3 each complete one read-only polling cycle.
- [ ] Workers 0–3 each create and validate their initial owned status.
- [ ] Worker 2 validates the sequence-1 pointer and assignment blob SHA.
- [ ] Worker 2 creates exactly one sequence-1 acknowledgement.
- [ ] Repeated Worker 2 polling proves sequence 1 is not acknowledged twice.
- [ ] Orchestrator observes the acknowledgement/status transition from GitHub.
- [ ] A harmless end-to-end mailbox test is recorded as complete.

## Plus-compatible active set

- orchestrator;
- worker-0;
- worker-1;
- worker-2;
- worker-3.

This is five active Scheduled Tasks. Worker-4 is not scheduled and retires after issue #55 is reviewed.

## Full six-agent mode

Requires at least six active Scheduled Task slots. The project has chosen not to retain Worker-4 after its current workload, so the six-agent configuration is documented only as a capacity model and is not the intended operating mode.