# CurveYield GitHub Mailbox Orchestration Protocol v2

## Status

This protocol supersedes `PROTOCOL_v1.md` for all orchestration after 2026-08-02. Existing mailbox JSON files keep `protocolVersion: 1`; v2 changes operating rules, not the record schema.

## Durable source of truth

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Mailbox root: `.agent-control/v1/`
- Continuity issue: #63
- Round 4 master issue: #119

GitHub issues, exact commit SHAs, immutable assignment files, current pointers, worker-owned statuses and committed manifests are authoritative. Chat memory, Project files, local worktrees and uploaded files are not.

## Operating mode

All five original browser worker chats are active: Workers 0, 1, 2, 3 and 4. Scheduled Tasks are not required and are currently disabled because task conversations did not resume the original worker chats. The user may manually wake a worker chat; each worker then polls its GitHub mailbox and resumes from durable state.

No worker is retired merely because v1 named it a legacy worker. Worker 4 is an active Round 4 reviewer.

## Ownership

Only the orchestrator writes:

- `GLOBAL_STATE_v1.json`;
- worker `CURRENT_v1.json` pointers;
- worker `ASSIGNMENTS/` files;
- orchestrator `STATUS_v1.json`;
- orchestrator `EVENTS/` files;
- orchestrator handoff files.

Each worker writes only:

- its own `ACKS/` files;
- its own `STATUS_v1.json`;
- its own `EVENTS/` files;
- its assigned implementation branch and issue reports.

A one-time orchestrator reconciliation on 2026-08-02 moved stale Worker 0–4 status records to the newly published Round 4 assignments. Future orchestrators must not edit worker statuses; workers own all subsequent transitions and completion records.

## Assignment publication

1. Confirm no active overlapping writer.
2. Create a new immutable assignment Markdown file with the next exact sequence.
3. Fetch and record its Git blob SHA.
4. Create the assigned branch at the exact approved starting SHA.
5. Update `CURRENT_v1.json` only after the assignment and branch exist.
6. Post the activation notice to the assigned issue.
7. Write an append-only orchestrator event.
8. Update global/orchestrator state last.

Assignments are never silently edited after a worker acknowledges them. Before acknowledgement, a corrected higher blob pin may replace the assignment and current pointer only when the message ID and sequence remain unconsumed; the correction must be documented in the issue/event.

## Worker state machine

1. Read `CURRENT_v1.json` and own `STATUS_v1.json`.
2. For a sequence greater than `lastConsumedSequence`, validate worker ID, sequence, message ID, issue, branch, starting SHA and assignment blob.
3. Create one acknowledgement before implementation.
4. Move own status through `acknowledged` to `working`.
5. Resume from GitHub state across browser sessions; never restart blindly.
6. Commit only to the assigned branch and report only to the assigned issue.
7. Complete with exact final SHA, recommendation and durable report comment ID/URL.
8. Write a create-only completion/blocker event.

Completion is never inferred from branch movement alone.

## Orchestrator review state machine

1. Refresh all five current pointers, statuses, issues and branch heads.
2. Pin reported final SHAs and verify branch-head equality.
3. Inspect changed paths, ownership, tests, manifests, protected blobs and issue reports independently.
4. Accept, request repair, reject, integrate or reassign.
5. Never issue two active assignments to one worker.
6. Never integrate mutable heads or broad stale ancestry.
7. Record every material decision as an append-only event.
8. Update global state last.

## Round 4 activation

- Worker 0 sequence 6, issue #120, branch `audit-round4/review-integration-spine-v1`, base `5914b03382422ea714346625a601b5dbda3aa0cd`.
- Worker 1 sequence 5, issue #121, branch `audit-round4/review-phase78-api-compat-v1`, base `4d7513b7eabd2e2217b1e3fed43d999df828a93f`.
- Worker 2 sequence 8, issue #122, branch `audit-round4/full-platform-integration-v1`, base `5914b03382422ea714346625a601b5dbda3aa0cd`.
- Worker 3 sequence 8, issue #123, branch `audit-round4/review-api-auth-security-v1`, base `6d877e2d87f1a91380a6c5d1efc47550527d8729`.
- Worker 4 sequence 3, issue #124, branch `audit-round4/review-web-direct-e2e-v1`, base `fdc55d684be2cd5053c1e617aa09399fdfcf60c2`.

Stage A reviewers may repair only proven defects test-first. Worker 2 may perform Stage 0 preparation immediately but may not transplant subsystem production paths until #120, #121, #123 and #124 publish accepted/repaired Stage A heads and complete manifests.

## Stage B

Worker 2 publishes one exact assembled SHA on issue #119. Workers 0, 1, 3 and 4 independently accept or reject that same SHA. Any new integration commit invalidates prior acceptance and requires affected gates to rerun.

## Frozen simulation addon

The GitHub-native contract simulation/App/RPC addon remains frozen during Round 4:

- `.github/workflows/github-native-simulate.yml`;
- `packages/github-native-sim/**`;
- shared runner RPC-policy/guard/run-job paths, tests and docs.

Only current approved `main` blobs may enter Stage B, byte-for-byte. Repair of that addon remains separately paused unless the user explicitly resumes it.

## Standing restrictions

- no production secret values in source, issues, fixtures, logs or reports;
- no submitted-project execution;
- no wallet private keys, signing or transaction broadcasting;
- no live production deployment in Round 4;
- no unreviewed broad branch merge;
- no direct merge to `main` before exact-SHA specialist acceptance and orchestrator verification;
- keep execution disabled unless a later explicit production-test contract authorizes a bounded inert test;
- no CurveYield Lite modification;
- no AWS.

## Handoff

The replacement orchestrator must read:

1. `orchestrator/HANDOFF/READ_FIRST_v1.md`;
2. this protocol;
3. `GLOBAL_STATE_v1.json`;
4. the current snapshot/bootstrap prompt;
5. all five worker current/status files;
6. issues #119–#125 and every active worker issue.

Live validated records win over dated snapshot text. Internal inconsistency blocks integration and new overlapping assignments until resolved.
