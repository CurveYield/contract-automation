# CurveYield Local Wake Agent Protocol v1

## Purpose

This role supplements hourly ChatGPT Scheduled Tasks by waking the orchestrator or a worker chat when durable GitHub state shows that immediate action is available. It does not replace the mailbox, issue reports, immutable assignment protocol, or independent orchestrator review.

## Authority and ownership

The local wake agent may read all files on `agent-control-plane-v1` and relevant GitHub issues/branches. It may write only:

- `.agent-control/v1/local-wake-agent/STATUS_v1.json`;
- `.agent-control/v1/local-wake-agent/ACKS/`;
- `.agent-control/v1/local-wake-agent/EVENTS/`.

It must never write or edit:

- `GLOBAL_STATE_v1.json`;
- orchestrator status/events;
- any worker `CURRENT_v1.json`, assignment, acknowledgement, status, or event;
- implementation branches, issue reports, or pull requests.

Wake requests under `REQUESTS/` are immutable and orchestrator-owned.

## State-driven wake rules

1. Read every immutable request in `REQUESTS/` and its matching create-only acknowledgement, if any.
2. Re-read the target agent's live mailbox pointer/status and relevant issue/branch before waking it.
3. Wake the orchestrator first whenever:
   - a worker status becomes `completed`, `blocked`, or `rejected`;
   - a required final issue report appears;
   - a branch final SHA changes after the last orchestrator decision;
   - a mailbox/status mismatch is detected;
   - a worker claims completion but GitHub evidence is absent.
4. Wake a worker only when:
   - the orchestrator has published a new valid `CURRENT_v1.json` sequence greater than `lastConsumedSequence`; or
   - an orchestrator-owned wake request explicitly directs resumption/status repair of the current assignment.
5. Never wake a worker into a stale, missing, malformed, cross-worker, or already-consumed assignment.
6. Never execute or alter worker work itself. The wake agent only brings the correct chat to the foreground and supplies a short instruction to read its durable GitHub mailbox/current issue.
7. After a successful wake attempt, create one acknowledgement in `ACKS/` containing the request ID, target, timestamp, observed pointer/status, and wake result. Never edit the request.
8. If waking fails, record the failure in `EVENTS/` and leave the request unacknowledged or explicitly acknowledged as failed so it can be retried safely.

## Recommended local loop

This agent may check GitHub locally at a cadence faster than the ChatGPT hourly task limit, but it must remain a local user-controlled process. Do not create GitHub Actions, webhooks, hosted bots, servers, or cloud cron jobs. Use conditional wakeups rather than repeatedly messaging active chats.

## Idempotency

- Request IDs are unique and immutable.
- One successful acknowledgement closes one request.
- Re-read live state before every wake.
- A repeated wake must not cause duplicate assignment acknowledgement or duplicate execution.
- Any discrepancy wakes the orchestrator, not the worker.
