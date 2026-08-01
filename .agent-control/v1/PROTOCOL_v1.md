# CurveYield GitHub Mailbox Orchestration Protocol v1

## Purpose

GitHub is the durable mailbox between the orchestrator chat and independent worker chats. The connected GitHub App is storage and transport only. ChatGPT Scheduled Tasks perform hourly polling. This protocol creates no GitHub Actions, webhooks, bots, servers, cron workflows, or external infrastructure.

The control plane lives only on branch `agent-control-plane-v1` under `.agent-control/v1/`. It must never be merged into `main` or an implementation branch.

## Operating capacity

The current Plus-compatible configuration uses five active hourly Scheduled Tasks:

1. orchestrator;
2. worker-0;
3. worker-1;
4. worker-2;
5. worker-3.

Worker-4 retains its current Phase 6 assignment but receives no later assignment. After its current workload completes, the orchestrator records it as retired in global state. It is not part of the recurring Plus polling set.

Full six-agent autonomous polling requires a plan supporting at least six active Scheduled Tasks. Polling may never be more frequent than hourly.

## Ownership

Only the orchestrator may write:

- `GLOBAL_STATE_v1.json`;
- each worker's `CURRENT_v1.json`;
- each worker's `ASSIGNMENTS/` files;
- `orchestrator/STATUS_v1.json`;
- `orchestrator/EVENTS/` files.

Each worker may write only:

- its own `ACKS/` files;
- its own `STATUS_v1.json`;
- its own `EVENTS/` files;
- its assigned implementation branch, issue, or pull request.

No agent may overwrite another agent's status, acknowledgement, event, assignment, or implementation files. During bootstrap, the orchestrator records migration state only in `GLOBAL_STATE_v1.json`; each participating worker creates its own initial `STATUS_v1.json`.

## Immutable assignments

An assignment is a create-only Markdown file:

`workers/<worker-id>/ASSIGNMENTS/<zero-padded-sequence>_<message-slug>_v1.md`

It must contain YAML front matter with:

- `protocol_version: 1`;
- `message_id`;
- monotonically increasing `sequence`;
- exact `worker_id`;
- UTC `issued_at`;
- `issued_by: orchestrator`;
- repository;
- issue number;
- implementation branch;
- exact 40-character starting SHA;
- `supersedes_message_id` or null;
- `assignment_state: ready`.

The instruction body must include enough GitHub-resident bootstrap material to run safely without Project files, uploaded ZIPs, or hidden chat context.

After the immutable assignment exists, the orchestrator updates that worker's `CURRENT_v1.json` as the final publication step. `CURRENT_v1.json` is only a pointer with protocol version, worker ID, sequence, message ID, assignment path, exact assignment blob SHA, and issue time. Workers must never depend on directory listing order.

Cancellation, retirement, or supersession requires a new higher-sequence immutable control assignment. Existing assignments are never edited.

## Worker state machine

Each scheduled worker runs hourly:

1. Read its own `CURRENT_v1.json` and `STATUS_v1.json` from `agent-control-plane-v1`.
2. If its status file is absent, create the exact initial status from the worker's migration record in `GLOBAL_STATE_v1.json`. This initialization does not consume or execute an assignment.
3. If the pointer sequence is absent, unchanged, or not greater than `lastConsumedSequence`, make no further writes and end quietly.
4. For a new sequence, verify protocol version, exact worker ID, pointer integrity, assignment blob SHA, sequence, message ID, issue, branch, and starting SHA.
5. Reject malformed, stale, cross-worker, or mismatched instructions without consuming them.
6. Create `ACKS/<sequence>_<message-id>_accepted_v1.json` before implementation.
7. Update its own status to `acknowledged`, then `working`.
8. Execute or resume the assignment while preserving every issue, path-ownership, phase-order, and security restriction.
9. Commit and push only to the assigned implementation branch.
10. Post the required report to the assigned GitHub issue.
11. Update status to `completed`, `blocked`, or `rejected`, including immutable final SHA and report reference when applicable.
12. Set `lastConsumedSequence` only after validating the immutable assignment.
13. Write a create-only completion or blocker event.

A worker never executes the same sequence twice. If one hourly run cannot finish the work, status remains `working`; the next run resumes from GitHub state rather than restarting blindly.

Allowed worker states are:

- `uninitialized`;
- `idle`;
- `acknowledged`;
- `working`;
- `blocked`;
- `completed`;
- `rejected`;
- `retired`.

Completion is valid only when both a worker status record and the required issue report exist. Branch movement alone is not completion.

## Orchestrator state machine

The orchestrator runs hourly:

1. Read `GLOBAL_STATE_v1.json`, every worker pointer, and every available worker status file.
2. Treat a missing Worker 0-3 status as uninitialized pending that worker's bootstrap. Worker-4 is a legacy current-workload-only worker; monitor issue #55 and its pinned final report directly until retirement rather than requiring a recurring mailbox status.
3. Detect newly completed, blocked, rejected, stale, or retired workers.
4. Pin each reported final SHA before review.
5. Inspect changed paths, issue report, ownership, tests, security boundaries, and governing acceptance gates.
6. Accept, request repair, reject, integrate, or reassign under the existing orchestration plan.
7. Never issue two active assignments to one worker.
8. Publish each new immutable assignment first, then update `CURRENT_v1.json`.
9. Record every decision as a create-only orchestrator event.
10. Update global state last.

The orchestrator must perform the review and authorized follow-up publication itself. It must not merely notify James that a worker finished.

## Idempotency and race protection

- Assignment, acknowledgement, and event files are create-only.
- Sequences increase by exactly one per worker.
- Workers process only sequences greater than `lastConsumedSequence`.
- Status files are writable only by their owner.
- Reads or writes that fail leave the prior valid state intact.
- The orchestrator reviews immutable final SHAs, never an unpinned mutable branch head.
- No assignment is marked consumed before all pointer and blob integrity checks succeed.
- Overlapping ownership is never reassigned while a prior worker may still be writing.

## Stale handling

With hourly polling:

- `working` with no status update for 3 hours is potentially stale;
- no update for 6 hours is blocked pending review;
- the orchestrator may not transfer overlapping paths automatically;
- cancellation or retirement must be a higher-sequence control assignment before ownership transfer.

## Standing restrictions

The mailbox does not authorize dependency installation, downloads, compilation, deployment, submitted-project execution, external audit-tool execution, production secrets, AWS, merges to `main`, CurveYield Lite changes, execution enablement, or modifications outside each worker's assigned paths.

## Migration and activation

Existing assignments active at migration are represented in the orchestrator-owned worker records inside `GLOBAL_STATE_v1.json`, with mailbox pointer sequence `0`. Sequence `0` is not work and must never be acknowledged or executed. During bootstrap, each worker creates its own status describing the already-active issue and branch, then finishes that assignment normally. Its first mailbox-issued follow-up is sequence `1`.

Worker-2 had completed its prior issue before migration and had not received the proposed follow-up manually. Therefore issue #57 is validly published as its immutable sequence-1 mailbox assignment.

Worker-4 does not join recurring mailbox polling. It finishes issue #55 under the prior workflow, receives no future assignment, and is then retired in global state.

The migration is not considered fully active until:

1. control-plane files exist;
2. the orchestrator and Workers 0-3 each have an active hourly Scheduled Task;
3. every participating chat completes one read-only polling cycle;
4. every participating chat validates or writes its initial status;
5. one harmless end-to-end test assignment is acknowledged exactly once.

## Rollback

Disable the five Scheduled Tasks. Preserve `agent-control-plane-v1` unchanged as an audit log. Resume manual issue comments and copy/paste prompts using each worker's latest valid status, issue, branch, starting SHA, and final SHA. Do not delete mailbox records, rewrite sequences, or reset implementation branches.