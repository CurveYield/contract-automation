# Queued Assignment Template — Worker 1 Round 5

## Template state

`QUEUED / INACTIVE / NOT CONSUMABLE`

Do not acknowledge or execute this template. It becomes an assignment only after the orchestrator resolves every activation placeholder, writes an immutable copy into Worker 1's `ASSIGNMENTS/` directory, updates `CURRENT_v1.json`, and posts the activation comment on issue #129.

## Identity

- Worker: `worker-1`
- Planned sequence: `6`
- Master issue: `#125`
- Worker issue: `#129`
- Planned branch: `audit-round5/live-api-auth-gpt-r2-v1`
- Starting SHA: `<ROUND4_ACCEPTED_SHA_RESOLVE_AT_ACTIVATION>`

## Preconditions

- Current Round 4 assignment is durably completed and Worker 1 status has no active sequence.
- Issue #119 records one exact accepted release SHA and production-test manifest.
- The orchestrator verifies the approved release branch, production deployment readiness, and protected boundaries.
- Required secret/variable names are confirmed by the account owner; values are never read or printed.

## Objective

Independently prove or reject the live API, identity/authentication, GPT boundary, pagination/cache/lifecycle behavior, and R2 data plane.

## Required work

1. Verify compiled assignment blob, exact starting SHA, and issue #129 activation.
2. Exercise health/version/capability/catalog and all accepted public resource routes.
3. Test client, GPT, GitHub bridge, runner, operator, and unauthorized identities separately.
4. Prove tenant and hidden-resource non-interference across success/error/pagination states.
5. Test cursor, ETag/CAS, cache, retry, cancellation, stale-state, timeout, and bounded failure behavior.
6. Validate private GPT action schema and credential separation only after account-owner configuration.
7. Run bounded disposable R2 presign/upload/download/HEAD/indexed-list/CORS/expiry/replay/oversize/isolation/retention/cleanup tests.
8. Publish exact sanitized evidence, production configuration digest binding, final recommendation, final SHA, and report reference.

## Prohibitions

- No secret values, raw RPC URLs, tokens, signed URLs, credentials, wallet keys, signing, transactions, or broadcasts.
- No direct private storage enumeration outside accepted public/index contracts.
- No submitted-project execution or deployment ownership.

## Completion gate

Worker-owned status must be `completed`, `activeSequence: null`, and bind an exact final SHA, recommendation, final report ID/URL, complete changed-path/blob manifest, live route/R2 evidence manifests, and the exact production configuration digest.
