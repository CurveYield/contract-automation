# Round 4 Activation Runbook v1

## Purpose

This runbook converts completed Round 3 worker outputs into authoritative Round 4 assignments without manual rescoping. It must be followed in order. Never use an intermediate branch head.

## Gate 1 — resolve completed Round 3 candidates

For Workers 0–4, fetch:

- `.agent-control/v1/workers/worker-N/CURRENT_v1.json`
- `.agent-control/v1/workers/worker-N/STATUS_v1.json`
- the completed issue thread (#112–#116)
- the assigned Round 3 branch head
- the committed Round 4 handoff manifest named in the final report

A candidate is eligible only when:

1. `state` is `completed`;
2. `activeSequence` and `activeMessageId` are null;
3. `lastConsumedSequence` equals the current Round 3 sequence;
4. `finalSha` is exactly 40 lowercase hex characters;
5. the branch head equals `finalSha`;
6. `recommendation` is `ACCEPT` or `ACCEPT WITH REPAIR`;
7. the final report URL/comment ID is durable and resolvable;
8. changed paths/blobs in status, report and committed manifest agree;
9. all issue checkpoints exist;
10. no blocker remains unresolved.

Any mismatch blocks that worker’s Round 4 activation.

## Gate 2 — instantiate Stage A branches

Create branches only after their exact starting SHA is resolved:

- Worker 0: `audit-round4/review-integration-spine-v1` from Worker 2 Round 3 final SHA.
- Worker 1: `audit-round4/review-phase78-api-compat-v1` from Worker 0 Round 3 final SHA.
- Worker 3: `audit-round4/review-api-auth-security-v1` from Worker 1 Round 3 final SHA.
- Worker 4: `audit-round4/review-web-direct-e2e-v1` from Worker 4 Round 3 final SHA; Worker 3 final SHA is a read-only external input.

Worker 2’s integration branch is not created until Stage A verdicts are available.

## Gate 3 — publish immutable assignments

For each Stage A worker:

1. read `.agent-control/v1/rounds/round4/PENDING_REGISTRY_v1.json`;
2. render the worker’s pending template into `workers/<worker-id>/ASSIGNMENTS/<zero-padded-sequence>_<message-id>_v1.md`;
3. replace the starting-SHA source rule with the exact resolved SHA;
4. include exact source report URL/comment ID and source manifest path/blob;
5. create the assignment file before changing `CURRENT_v1.json`;
6. fetch the created assignment and record its blob SHA;
7. update `CURRENT_v1.json` to the new sequence/message/path/blob;
8. update owner-only `STATUS_v1.json` to `ready`, keeping the prior completion record fields under `prior*` keys;
9. add a wake comment to the Round 4 worker issue;
10. do not issue another assignment until this one completes.

Next sequences are fixed:

- Worker 0: 6
- Worker 1: 5
- Worker 2: 8
- Worker 3: 8
- Worker 4: 3

## Gate 4 — Stage A completion

Do not create Worker 2’s integration branch until issues #120, #121, #123 and #124 publish accepted Stage A reviewed/repaired SHAs and deterministic intake instructions.

Reject a Stage A output when:

- it reviewed an intermediate SHA;
- it lacks observed RED evidence for a repair;
- it changed unowned paths without a documented finding;
- its path/blob manifest disagrees with its final branch;
- it modifies protected GitHub-native simulation-addon blobs;
- it prints or persists secret values.

## Gate 5 — instantiate Worker 2 integration assignment

Resolve the accepted/repaired Phase 1–6 base from issue #120. Create `audit-round4/full-platform-integration-v1` from that SHA. Render Worker 2 sequence 8 assignment from the pending registry/template, including exact accepted/repaired heads from issues #120, #121, #123 and #124.

Worker 2 must intake by exact path/blob in this order:

1. Phase 1–6 and integration spine;
2. Phase 7–8 core/service/reporting;
3. API/GPT/auth;
4. GitHub Direct Audit and trusted workflow;
5. Web/operator UI;
6. explicit field-level shared-file unions;
7. protected simulation addon from current approved `main` byte-for-byte;
8. release metadata and Round 5 production-test manifest.

## Gate 6 — assembled candidate acceptance

Worker 2 publishes one exact assembled SHA to issue #119. Workers 0, 1, 3 and 4 test that same SHA under their active Round 4 assignments.

- Worker 0: core semantic acceptance.
- Worker 1: API/GPT/auth acceptance.
- Worker 3: trust/security/workflow acceptance.
- Worker 4: UI/accessibility/E2E acceptance.

Any new integration commit invalidates earlier affected acceptances.

## Gate 7 — merge and Round 5 handoff

The orchestrator independently verifies:

- all Stage A and Stage B reports;
- exact candidate SHA and branch head;
- combined tests/static gates;
- path/blob provenance and protected blobs;
- no secret values in source/logs/artifacts;
- complete issue #125 production-test manifest.

Only then may the release candidate be merged to the approved release branch and subsequently to `main`. Round 5 issue #125 owns live production deployment and acceptance.
