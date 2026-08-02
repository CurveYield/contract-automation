# Queued Assignment Template — Worker 3 Round 5

## Template state

`QUEUED / INACTIVE / NOT CONSUMABLE`

Do not acknowledge or execute this template. It becomes an assignment only after the orchestrator resolves every activation placeholder, writes an immutable copy into Worker 3's `ASSIGNMENTS/` directory, updates `CURRENT_v1.json`, and posts the activation comment on issue #131.

## Identity

- Worker: `worker-3`
- Planned sequence: `9`
- Master issue: `#125`
- Worker issue: `#131`
- Planned branch: `audit-round5/github-direct-actions-security-v1`
- Starting SHA: `<ROUND4_ACCEPTED_SHA_RESOLVE_AT_ACTIVATION>`

## Preconditions

- Current Round 4 assignment is durably completed and Worker 3 status has no active sequence.
- Issue #119 records one exact accepted release SHA and production-test manifest.
- The orchestrator verifies the approved release branch, trusted workflow source, and deployment readiness.
- Required GitHub secret/variable names are confirmed by the account owner; values are never read or printed.

## Objective

Independently prove or reject live GitHub Direct behavior, Actions workflow trust, permissions, identity binding, publication recovery, and credential non-persistence.

## Required work

1. Verify compiled assignment blob, exact starting SHA, workflow SHA, and issue #131 activation.
2. Review action pins, permissions, environment protections, concurrency, input bounds, target-as-data separation, and rollback behavior.
3. Run bounded authorized issue/label/check/status/comment flows and unauthorized rejection cases.
4. Verify repository, installation, requester, target SHA, request, ledger, result, report, manifest, and artifact identity binding.
5. Test idempotency, duplicate/replay handling, cancellation, stale state, bounded journal search, partial publication recovery, and artifact metadata limits.
6. Prove submitted source remains inert and no credential persists in ledger, reports, artifacts, logs, or diagnostics.
7. Publish sanitized evidence, incident template, final recommendation, final SHA, report reference, and exact production configuration digest binding.

## Prohibitions

- No secret values, raw RPC URLs, tokens, installation credentials, signed URLs, wallet keys, signing, transactions, or broadcasts.
- No submitted-project execution, broad repository mutation, mutable action refs, or branch-supplied authority.
- No destructive recovery against irreplaceable records.

## Completion gate

Worker-owned status must be `completed`, `activeSequence: null`, and bind an exact final SHA, recommendation, final report ID/URL, complete changed-path/blob manifest, workflow trust matrix, GitHub identity/recovery evidence, credential non-persistence report, and exact production configuration digest.
