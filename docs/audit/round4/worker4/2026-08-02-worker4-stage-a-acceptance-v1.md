# Worker 4 Round 4 Stage A Acceptance v1

## Decision

**ACCEPT** Worker 4 candidate `11823bb8150debcf65b87aec27a20325546f864e` for deterministic Worker 2 intake and subsequent Stage B assembled UI/E2E acceptance.

This decision is limited to the reviewed static/inert compatibility, view-model, rendering, client-state and accessibility boundary. It does not authorize live deployment, submitted-project execution, workflow approval, credentials, RPC, wallets, signing or transactions.

## Authoritative identities

- Worker 4 starting SHA: `fdc55d684be2cd5053c1e617aa09399fdfcf60c2`
- Worker 4 Stage A candidate: `11823bb8150debcf65b87aec27a20325546f864e`
- Worker 3 documentation head: `1672b31a71674dd78eddc3bf5fc2fbe39d4ae07d`
- Worker 3 code/workflow candidate: `46873f805199e2212af3902c8525c0f3e4501721`
- Worker 0 candidate: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`
- Worker 1 candidate: `6d877e2d87f1a91380a6c5d1efc47550527d8729`
- Worker 3 compatibility manifest: `direct-compatibility-2a7b937fd31fac897e936414`
- Worker 3 release manifest: `direct-round3-release-418edd6cf9b65dbd77032a08`

## Source review disposition

Seven compatibility defects were supported by observed RED evidence and repaired:

1. no explicit GitHub Direct result/error version adapter;
2. incomplete lifecycle labels;
3. duplicate/conflicting report references;
4. hidden-report count/content leakage;
5. GitHub credential-prefix diagnostic leakage;
6. loss of immutable GitHub Direct result identity and execution truth;
7. acceptance of an unrecognized reporting-bundle schema and arbitrary execution/outcome strings.

No evidence justified changing Worker 3 ledger, auth, adapter, runner, reporting, CLI or workflow internals.

## Public compatibility result

The UI now validates and projects:

- `github-direct-service-result-v2`;
- `github-direct-service-error-v1`;
- `github-direct-audit-v1`;
- exact command/state combinations;
- documented Worker 3 lifecycle states only;
- command-appropriate submission/reporting/cancellation bundle schemas;
- exact job ID and target-SHA binding through nested public records;
- exact result ID/digest binding;
- allowlisted execution states and outcomes;
- at most one immutable report reference;
- canonical generic error text, retryability and stable code;
- `executionAvailable:false` in every projection.

Worker 4 imports no Worker 3 internal package. The compatibility adapter consumes transport-neutral public records only.

## Hidden-resource and reference result

- `visible:false` report records do not contribute identifiers, titles, totals, pagination or rendered content.
- hidden and absent report collections are observationally identical at the view-model boundary.
- identical same-ID report references deduplicate.
- any conflicting same-ID reference group is omitted fail-closed.
- no attacker destination is selected from a conflict.

## Hostile input result

Covered and accepted:

- XSS markup and event attributes;
- unsafe URL text;
- bidi and Unicode control characters;
- prototype inheritance;
- accessor descriptors without getter invocation;
- revoked proxies;
- cycles;
- oversized records;
- schema/version skew;
- undocumented states;
- cross-job identity substitution;
- result ID/digest mismatch;
- bundle-schema substitution;
- execution-state/outcome substitution;
- credential-shaped fields;
- GitHub token prefixes;
- visual-state substitution and false progress claims.

## Client-state result

The existing injected read-only client was re-reviewed without production modification. Fresh tests prove:

- identical in-flight requests deduplicate;
- a different request in the same slot cancels the prior request;
- a transport ignoring abort cannot publish a stale response;
- ETag entries are scoped by caller-provided non-secret scope and path;
- a 304 without a matching scoped cache entry fails closed;
- offline stale recovery returns only the matching frozen cache value;
- secret-bearing paths and scopes are rejected before transport invocation;
- returned credential-shaped fields are stripped;
- no browser persistence or direct network client is introduced.

## Accessibility and responsive result

Fresh source/DOM assertions prove:

- English document language;
- skip link;
- labeled primary navigation;
- focusable main landmark;
- one primary heading;
- section heading association;
- definition-list labels for immutable Direct fields;
- keyboard-focusable, copy-safe identifiers;
- truthful awaiting-executor and execution-unavailable text;
- no execution or invented-progress control;
- visible focus styles;
- narrow/mobile layout rule;
- overflow wrapping and bounded graphics;
- forced-colors behavior;
- reduced-motion behavior.

Browser-only manual screen-reader, zoom and visual contrast testing remains a Stage B/deployment acceptance requirement and is not claimed as executed here.

## Inert E2E result

The versioned public fixture traverses:

1. accepted submit -> awaiting executor -> not executed;
2. completed report -> trusted fixture-modeled execution state -> one immutable report reference;
3. transport failure -> stable generic message -> retryable truth.

All three render without mutation controls, credentials, raw provider text or false submitted-project execution claims.

## Fresh verification

Focused Stage A suite:

```text
30 tests
30 passed
0 failed
0 cancelled
0 skipped
```

The suite comprises:

- 6 original finding regressions;
- 5 strict compatibility tests;
- 2 Direct rendering tests;
- 3 public fixture replay tests;
- 5 hostile/XSS/non-interference tests;
- 4 client race/cache tests;
- 5 static/accessibility/inert-flow tests.

Additional checks:

- changed production JavaScript syntax: valid;
- test JavaScript syntax: valid;
- public fixture JSON: valid;
- changed-path allowlist: all paths Worker 4-owned;
- direct/internal import scan: clean;
- execution/network/persistence/dynamic-code scan: clean;
- 11 protected simulation/RPC blobs: unchanged;
- no dependency install;
- no compilation/build;
- no live network/RPC, submitted execution or deployment.

## Deterministic Worker 2 intake

Use:

`test/fixtures/audit-round4/worker4/stage-a-intake-v1.json`

The manifest pins:

- exact candidate SHA;
- all 18 candidate paths and Git blobs;
- three required unchanged base blobs;
- compatibility versions;
- transplant order;
- acceptance commands;
- protected simulation/RPC hashes;
- Stage B invalidation rule.

Worker 2 must reject a missing path, blob mismatch, stale candidate SHA, undocumented adaptation or newer assembled SHA not separately published and frozen on issue #119.

## Residual risks

1. Stage A used inert fixtures and direct Node/static checks only.
2. Worker 0 entered Round 4 with an `ACCEPT WITH REPAIR` disposition; Worker 2 must prove the final assembled Phase 7–8 interface matches its frozen accepted input.
3. Actual assembled routing, imports and full-system E2E cannot be accepted before Worker 2 publishes one exact frozen SHA.
4. Manual browser, screen-reader, zoom and contrast checks remain required before production deployment.

None of these residual risks enables execution, leaks credentials or weakens hidden-resource behavior in the Stage A candidate.

## Stage B rule

Accept or reject only the exact assembled SHA published and frozen by Worker 2 on issue #119. A newer SHA invalidates all prior Stage B evidence and requires a fresh review.
