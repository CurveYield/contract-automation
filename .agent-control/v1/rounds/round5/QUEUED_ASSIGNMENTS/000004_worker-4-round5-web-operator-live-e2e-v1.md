# Queued Assignment Template — Worker 4 Round 5

## Template state

`QUEUED / INACTIVE / NOT CONSUMABLE`

Do not acknowledge or execute this template. It becomes an assignment only after the orchestrator resolves every activation placeholder, writes an immutable copy into Worker 4's `ASSIGNMENTS/` directory, updates `CURRENT_v1.json`, and posts the activation comment on issue #132.

## Identity

- Worker: `worker-4`
- Planned sequence: `4`
- Master issue: `#125`
- Worker issue: `#132`
- Planned branch: `audit-round5/web-operator-live-e2e-v1`
- Starting SHA: `<ROUND4_ACCEPTED_SHA_RESOLVE_AT_ACTIVATION>`

## Preconditions

- Current Round 4 assignment is durably completed and Worker 4 status has no active sequence.
- Issue #119 records one exact accepted release SHA and production-test manifest.
- The orchestrator verifies the approved release branch and production API/Pages deployment readiness.
- Required secret/variable names are confirmed by the account owner; values are never read or printed.

## Objective

Independently prove or reject the production web/operator UI, accessibility, safe rendering, version/origin integrity, and live end-to-end state truth.

## Required work

1. Verify compiled assignment blob, exact starting SHA, production deployment identifiers, and issue #132 activation.
2. Verify production domain, TLS, routing, deep links, refresh, assets, cache, API origin, CORS, and stale/mixed-version rejection.
3. Exercise API-backed workspace, campaign, job, evidence, report, fork, clean-room, catalog, capability, diagnostic, and GitHub Direct views.
4. Test loading, empty, unauthorized, forbidden, not-found, stale, retry, cancellation, timeout, partial-result, and upstream-failure states.
5. Verify keyboard operation, focus, landmarks, headings, labels, tables, dialogs, live regions, error association, and screen-reader semantics.
6. Test mobile/tablet/desktop and long, hostile, malformed, bidi, Unicode, and oversized content.
7. Prove no secrets, tokens, signed URLs, raw RPC URLs, host paths, stack traces, or hidden-resource metadata appear in UI/logs/evidence.
8. Publish sanitized screenshots/DOM evidence, lifecycle consistency matrix, final recommendation, final SHA, report reference, and exact production configuration digest binding.

## Prohibitions

- No secret values, raw RPC URLs, tokens, signed URLs, sensitive identifiers, wallet keys, signing, transactions, or broadcasts.
- No deployment ownership, direct storage enumeration, or destructive production data changes.
- No misleading or silently degraded acceptance of mixed-version or inaccessible behavior.

## Completion gate

Worker-owned status must be `completed`, `activeSequence: null`, and bind an exact final SHA, recommendation, final report ID/URL, complete changed-path/blob manifest, route/version/origin matrix, accessibility/hostile-content evidence, lifecycle consistency report, and exact production configuration digest.
