# Worker 4 Round 4 Stage A Compatibility Repair v1

## Candidate identity

- Assignment: `worker-4-round4-web-direct-e2e-review-v1`
- Issue: `#124`
- Starting SHA: `fdc55d684be2cd5053c1e617aa09399fdfcf60c2`
- Focused implementation candidate SHA: `8413a9d79e11a4848dc105e9c945824feaff4db3`
- Worker 3 reviewed code/workflow SHA: `46873f805199e2212af3902c8525c0f3e4501721`
- Worker 3 public result schema: `github-direct-service-result-v2`
- Worker 3 public error schema: `github-direct-service-error-v1`
- Worker 4 Round 4 output schema: `audit-web-compat/v2`

## Repair rule

Every production change below corresponds to an observed Checkpoint 1 RED failure. No Worker 3 ledger, auth, adapter, runner, reporting, CLI or workflow internal was modified.

## Repair matrix

| Finding | Minimal repair | Proof |
|---|---|---|
| F-01 missing Direct v2 boundary | Added `packages/audit-web-compat/src/github-direct-v2.mjs`; version locks in `ROUND4_COMPATIBILITY_VERSIONS`; strict result/error adapters | result/error fixture and mutation tests |
| F-02 incomplete lifecycle truth | Added explicit labels and terminality for Worker 3, Phase 7–8 and assembled UI states | complete state-label matrix test |
| F-03 ambiguous report references | Identical same-ID records deduplicate; any conflicting same-ID group is omitted fail-closed | duplicate/conflict test |
| F-04 hidden report leakage | Added optional `visible`; `visible:false` projects no identifier/content and is excluded before counts/pagination | hidden-versus-absent equality test |
| F-05 GitHub token leakage | Redacts raw GitHub token prefixes and `x-access-token` assignments | diagnostic corpus test |
| F-06 lost Direct result identity | Extended the Direct status projection conditionally with source schema, command/state, result ID/digest, execution/outcome, report digest, retry/error truth | adapter and accessible-render tests |

## Strict GitHub Direct adapter contract

### Accepted inputs

Result record exact keys:

- `schemaVersion`
- `modeId`
- `commandKind`
- `jobId`
- `targetCommitSha`
- `state`
- `data`
- `completedAt`
- `cloudflareFallback`
- `resultId`
- `resultDigest`

Required fixed identities:

- schema: `github-direct-service-result-v2`
- mode: `github-direct-audit-v1`
- 40-character lowercase target SHA
- `sha256:` plus 64 lowercase hex digest
- `resultId == direct-service-result-<first 24 digest hex characters>`
- `cloudflareFallback == false`

Error record exact keys:

- `schemaVersion`
- `modeId`
- `code`
- `retryable`
- `message`
- `at`

Required fixed identities:

- schema: `github-direct-service-error-v1`
- mode: `github-direct-audit-v1`
- canonical generic message only: `GitHub Direct service operation failed`
- stable allowlisted error code and boolean retryability

### Command/state truth table

| Command | Public service states accepted |
|---|---|
| submit | accepted, completed, execution-plane-unavailable |
| status | completed |
| cancel | cancelled |
| report | completed, cancelled, execution-plane-unavailable |
| capabilities | completed |
| verify-fixture | completed, execution-plane-unavailable |

Nested current state must be one of Worker 3’s eleven documented `DIRECT_STATES`. Cross-bound job ID and target SHA mismatches fail closed. Submit/report/cancel state contradictions fail closed.

### Defensive boundary

- own enumerable data descriptors only;
- no getter execution;
- revoked/unreadable records fail closed;
- recursive credential-shaped field rejection;
- bounded depth and field count;
- maximum one immutable report reference;
- report/result/bundle identity cross-binding;
- no import from Worker 3 internals;
- no network, storage, credential or mutation authority.

## Canonical view output

Round 4 Direct models expose only bounded, frozen UI facts:

- source schema;
- command kind;
- service result state;
- canonical lifecycle state;
- result identifier and digest;
- repository and target revision when present in the public state;
- execution state and outcome;
- one report identifier and digest;
- canonical retryability and error code;
- `executionAvailable:false` always.

The renderer provides explicit `<dt>/<dd>` accessible labels for each of these facts. It adds no Run, Retry, Cancel, Delete, Execute or progress control.

## Legacy compatibility

Round 3 behavior remains available through the original frozen `COMPATIBILITY_VERSIONS` object and `audit-web-compat/v1`. Legacy generic GitHub Direct status is accepted only by a strict exact-key adapter. Unknown keys and any supplied unsupported `schemaVersion` fail closed.

Round 4 consumers should call `composeRound4WebCompatibility()` and require `audit-web-compat/v2`.

## Deterministic fixture inventory

`test/fixtures/audit-round4/worker4/github-direct-public-v2.json` contains:

1. accepted submit result with nested `awaiting_executor` and `not-executed` truth;
2. completed report result with one immutable report reference and trusted fixture-modeled outcome;
3. canonical retryable transport error.

It pins all three public schema names and contains no credential or live transport data.

## Test-first evidence

### Starting RED

`test/audit-round4-worker4-source-review-v1.test.mjs`

```text
6 tests
0 passed
6 failed
```

### Focused GREEN

Commands executed against an exact local mirror of the accepted repair files:

```text
node --test test/audit-round4-worker4-*.test.mjs
node --check packages/audit-web-compat/src/github-direct-v2.mjs
python -m json.tool test/fixtures/audit-round4/worker4/github-direct-public-v2.json
```

Result:

```text
16 tests passed
0 failed
0 cancelled
0 skipped
GitHub Direct adapter syntax: valid
public fixture JSON: valid
```

Test groups:

- original finding regressions: 6;
- strict result/error compatibility: 5;
- accessible Direct rendering: 2;
- deterministic fixture/schema replay: 3.

Mutation/hostile cases include schema skew, fallback enabled, result ID/digest mismatch, cross-job identity, contradictory nested state, credential-shaped top-level field, undocumented lifecycle state, unknown legacy field, duplicate references, conflicting references, hidden records and token-prefix diagnostics.

## Changed implementation paths

- `packages/audit-ui-contracts/src/index.mjs`
- `packages/audit-report-view-model/src/lifecycle-v1.mjs`
- `packages/audit-report-view-model/src/safety-v1.mjs`
- `packages/audit-report-view-model/src/models-core-v1.mjs`
- `packages/audit-report-view-model/src/models-operator-v1.mjs`
- `packages/audit-web-compat/src/index-v1.mjs`
- `packages/audit-web-compat/src/github-direct-v2.mjs`
- `apps/audit-web/src/pages-round3-v1.mjs`

## Current verdict

The six observed compatibility defects are repaired within Worker 4-owned paths. No current evidence justifies a Worker 3 production repair. Stage A hostile, accessibility, cancellation/cache and inert E2E acceptance remains for Checkpoint 3.
