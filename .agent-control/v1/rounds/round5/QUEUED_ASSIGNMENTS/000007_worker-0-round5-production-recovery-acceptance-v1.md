# Queued Assignment Template — Worker 0 Round 5

## Template state

`QUEUED / INACTIVE / NOT CONSUMABLE`

Do not acknowledge or execute this template. It becomes an assignment only after the orchestrator resolves every activation placeholder, writes an immutable copy into Worker 0's `ASSIGNMENTS/` directory, updates `CURRENT_v1.json`, and posts the activation comment on issue #128.

## Identity

- Worker: `worker-0`
- Planned sequence: `7`
- Master issue: `#125`
- Worker issue: `#128`
- Planned branch: `audit-round5/production-recovery-acceptance-v1`
- Starting SHA: `<ROUND4_ACCEPTED_SHA_RESOLVE_AT_ACTIVATION>`

## Preconditions

- Current Round 4 assignment is durably completed and Worker 0 status has no active sequence.
- Issue #119 records one exact accepted release SHA and complete production-test/rollback/observability manifests.
- The orchestrator independently verifies the release SHA, approved release branch, protected blobs, and external RPC reconciliation.
- Required secret and variable names are confirmed by the account owner; values are never read or printed.

## Objective

Independently verify production configuration, Cloudflare/R2 resource truth, observability/redaction, safe recovery/rollback, and final cross-specialist semantic acceptance.

## Required work

1. Re-fetch issue #128 and the compiled assignment; verify exact blob and starting SHA.
2. Verify accepted release/workflow provenance and production resource/configuration manifests.
3. Verify secret/variable presence by name only.
4. Review Cloudflare Worker, Pages, domains, TLS, R2, bindings, CORS, lifecycle, and retention.
5. Verify logs, correlation IDs, recursive redaction, bounded retention, and safe failure semantics.
6. Witness idempotent redeploy, rollback, non-production key rotation, R2 partial-publication recovery, and GitHub duplicate-publication reconciliation.
7. Independently reconcile Worker 1/2/3/4 reports against one exact production SHA/configuration digest.
8. Publish exact evidence manifests, residual risks, final recommendation, final SHA, and report reference.

## Prohibitions

- No secret values, raw RPC URLs, tokens, signed URLs, wallet keys, signing, transactions, or broadcasts.
- No destructive recovery against irreplaceable data.
- No silent waiver of identity, isolation, workflow-trust, credential, rollback, or data-loss failures.

## Completion gate

Worker-owned status must be `completed`, `activeSequence: null`, and bind an exact final SHA, recommendation, final report ID/URL, complete changed-path/blob manifest, production configuration digest, and specialist report index.
