# GitHub Mailbox Orchestration Activation Checklist v1

The control plane is installed but must not be described as fully active until every required item is complete.

## Installed

- [x] Dedicated branch `agent-control-plane-v1` exists.
- [x] Protocol is stored at `.agent-control/v1/PROTOCOL_v1.md`.
- [x] Initial orchestrator and Worker 0–4 status/pointer records exist.
- [x] Current sequence-0 work is represented as a snapshot and is not republished.
- [x] Worker 2's not-yet-started issue #57 follow-up is published as immutable sequence 1.
- [x] Worker 4 is designated current-workload-only and receives no future assignment.

## Required before activation claim

- [ ] Orchestrator hourly Scheduled Task is enabled.
- [ ] Worker 0 hourly Scheduled Task is enabled.
- [ ] Worker 1 hourly Scheduled Task is enabled.
- [ ] Worker 2 hourly Scheduled Task is enabled.
- [ ] Worker 3 hourly Scheduled Task is enabled.
- [ ] Orchestrator completes one read-only polling cycle.
- [ ] Workers 0–3 each complete one read-only polling cycle.
- [ ] Each scheduled agent validates or writes its initial owned status.
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

Requires at least six active Scheduled Task slots. Do not enable until the account plan supports that capacity and Worker-4 has not been retired by project decision.