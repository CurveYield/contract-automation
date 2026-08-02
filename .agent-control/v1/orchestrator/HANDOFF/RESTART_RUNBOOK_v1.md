# Replacement Orchestrator Restart Runbook v1

## Objective

Resume Round 4 safely from GitHub without predecessor chat context.

## A. Establish live state

1. Fetch `agent-control-plane-v1` and record its exact head SHA.
2. Read `PROTOCOL_v2.md`, `GLOBAL_STATE_v1.json`, and the complete handoff package.
3. Read every Worker 0–4 `CURRENT_v1.json` and `STATUS_v1.json`.
4. Inspect each immutable assignment and verify its exact blob SHA.
5. Inspect issues #119–#125, active worker issues, branch heads, reports and manifests.
6. Confirm Worker 2 remains at Stage 0 until #120, #121, #123 and #124 have accepted/repaired Stage A heads.
7. Post refreshed state and discrepancies to continuity issue #63.

The current workflow uses manual wakes of the original browser worker chats. Scheduled Tasks are not required; do not create duplicates or claim unattended polling.

## B. Classify each worker

Use one of:

- `published-awaiting-acknowledgement`;
- `acknowledged`;
- `working-stage-a`;
- `working-stage-0-preparation`;
- `blocked` or `rejected`;
- `completed-unreviewed`;
- `accepted-awaiting-intake`;
- `integrated-awaiting-stage-b`;
- `stage-b-accepted`;
- `retired` only after an explicit current control assignment.

Do not infer completion from commits alone and do not treat Worker 4 as retired.

## C. Review Stage A completion

1. Read the worker-owned completed status.
2. Verify final SHA format and branch-head equality.
3. Fetch the exact issue report and numeric comment ID.
4. Verify the complete changed-path/blob/public-interface manifest.
5. Compare against the assigned starting SHA and ownership.
6. Inspect RED evidence, repairs, tests and residual risks independently.
7. Verify protected simulation-addon blobs are unchanged.
8. Decide `ACCEPT`, `ACCEPT WITH REPAIR` or `REJECT`.
9. Record the decision as an append-only orchestrator event.
10. Give Worker 2 exact intake authorization only after acceptance.

## D. Worker 2 Stage 0 and intake

Before all Stage A reviews finish, Worker 2 may only build validators, ownership/overlap registries, shared-file union contracts, rerun matrices and Round 5 production-input schemas.

After all four reviews are accepted:

1. resolve exact reviewed heads/reports/manifests;
2. reject stale or mismatched inputs;
3. intake exact owned paths in issue #119 order;
4. apply shared-file unions field by field;
5. restore approved `main` simulation-addon blobs byte-for-byte;
6. publish an exact checkpoint SHA after each wave;
7. run required post-wave gates.

Broad branch merges and stale ancestry are forbidden.

## E. Frozen assembled candidate

1. Worker 2 publishes one exact SHA on issue #119.
2. Workers 0, 1, 3 and 4 review that same SHA.
3. A newer SHA invalidates earlier acceptance.
4. Any rejection requires observed RED and the minimum proven repair.
5. After unanimous exact-SHA acceptance, independently verify combined tests, provenance, public schemas, overlaps, protected blobs, secret scans and residual risks.
6. Only then prepare release-branch/PR and Round 5 handoff actions.

Do not merge directly to `main` without explicit orchestrator verification and authority.

## F. Publish follow-up work

1. Confirm no active assignment and no overlapping writer.
2. Create the dedicated branch at the exact approved base.
3. Create the immutable assignment file.
4. Fetch its blob SHA.
5. Update `CURRENT_v1.json`.
6. Post the issue activation notice.
7. Append an orchestrator event.
8. Update global/orchestrator state last.

Do not write worker-owned statuses. A one-time 2026-08-02 reconciliation already occurred; workers own all later status transitions.

## G. Stale workers

- no progress/status for 3 hours: potentially stale;
- no progress for 6 hours: blocked pending review;
- do not transfer overlapping ownership automatically;
- use a higher-sequence cancellation/supersession control assignment before transfer.

## H. Frozen simulation addon

Round 4 cannot repair the GitHub-native simulation/App/RPC addon. Include only current approved `main` files byte-for-byte. Its separate repair remains paused until the user explicitly resumes it.

## I. Replacement startup report

Post to issue #63:

- replacement runtime/session identity when available;
- exact control-plane head;
- Worker 0–4 live sequence/state/branch/head;
- current Stage A checkpoint state;
- whether Worker 2 is Stage 0 blocked or authorized for intake;
- discrepancies and actions taken;
- next exact SHA requiring independent review;
- confirmation no forbidden operation occurred.
