# GitHub Direct Ledger Boundary Repair Review v1

## Verdict

`ACCEPT` for the ledger path and partial-write recovery repairs tracked by issue #108.

This verdict applies only to the repaired GitHub Direct Audit ledger package. It does not accept the active service/CLI/workflow package in issue #104, the adapter/runner boundary findings discovered during this review, or the separately paused GitHub-native simulation/RPC addon.

## Lineage

- Parent protocol-repair SHA: `1ba6ec492813375aaa867ef0e35ee6cc185c253a`
- Repair branch: `audit-repair/github-direct-ledger-boundaries-v1`
- Production repair candidate: `183dbf0ac8934949b0146f99ea2d0e28a6e9e87a`
- Issue: #108

## Root causes

### Prefix-only ledger path acceptance

The accepted core used a prefix check for `.audit-direct/v1/**`. Public mutation planners could therefore target arbitrary caller-authored namespaces below that prefix rather than a closed set of server-owned request/current/event/result/report/manifest/index paths.

### Operation/path mismatch

CAS mutation plans were not restricted to mutable current pointers and indexes. Create-only plans could also target the mutable jobs index.

### Ambiguous recovery observations

`planPartialWriteRecovery()` constructed a `Map` directly from observations. Duplicate paths silently used last-write-wins behavior. Observations and current-blob entries unrelated to supplied plans were accepted as inert input.

## Test-first evidence

The regression suite was committed before production changes:

- file: `test/audit-github-direct-ledger-boundaries-repair-v1.test.mjs`
- RED commit: `36fbdd3f8d2717fd99ffc6b49123d03162fd2cf9`

Observed RED against the parent source:

- tests: 10;
- passed: 2;
- failed: 8;
- failures covered arbitrary in-root paths, suffix aliases, malformed/control-character/overlong paths, CAS/create path-class mismatches, duplicate observations, unrelated observations and unrelated current-blob entries.

## Repairs

### Closed canonical path parser

`ledgerPathInfo()` now recognizes only:

- `.audit-direct/v1/requests/<job-id>.json`;
- `.audit-direct/v1/current/<job-id>.json`;
- `.audit-direct/v1/events/<job-id>/<event-id>.json`;
- `.audit-direct/v1/results/<job-id>/<result-id>.json`;
- `.audit-direct/v1/reports/<job-id>/<report-id>.json`;
- `.audit-direct/v1/manifests/<job-id>.json`;
- `.audit-direct/v1/indexes/jobs-v1.json`.

It rejects aliases, traversal markers, repeated separators, backslashes, control characters, overlong paths and invalid reserved identities.

### Operation/path compatibility

- `update-cas` is limited to `current` and `job-index` paths.
- `create-immutable` cannot target the jobs index.
- first creation of a current pointer remains valid.
- validators repeat the same compatibility checks rather than trusting planner output.

### Recovery uniqueness and relevance

- duplicate observed paths are rejected before map creation;
- conflicting and identical duplicates receive the same bounded `duplicate_identity` error;
- immutable observations must correspond to an immutable supplied plan;
- current-blob entries must correspond to a CAS supplied plan;
- unrelated records are rejected with `unrelated_observation`;
- valid partial-write convergence behavior is preserved.

## Fresh verification

Command set:

```text
node --test \
  test/audit-github-direct-core-protocol-v1.test.mjs \
  test/audit-github-direct-core-validation-repair-v1.test.mjs \
  test/audit-github-direct-core-ledger-v1.test.mjs \
  test/audit-github-direct-ledger-boundaries-repair-v1.test.mjs \
  test/audit-github-direct-core-runner-v1.test.mjs
```

Result:

- tests: 54;
- passed: 54;
- failed: 0;
- skipped: 0;
- cancelled: 0.

Syntax checks succeeded for:

- `packages/audit-github-direct-ledger/src/paths.mjs`;
- `packages/audit-github-direct-ledger/src/mutations.mjs`;
- `packages/audit-github-direct-ledger/src/recovery.mjs`.

The dependent runner-publication suite confirms that request publication, state transitions, result/report immutable records, current/index CAS plans and publication planning still compose with the stricter path classes.

## Changed files

- `docs/superpowers/plans/2026-08-01-github-direct-ledger-boundaries-repair.md`;
- `packages/audit-github-direct-ledger/src/paths.mjs`;
- `packages/audit-github-direct-ledger/src/mutations.mjs`;
- `packages/audit-github-direct-ledger/src/recovery.mjs`;
- `test/audit-github-direct-ledger-boundaries-repair-v1.test.mjs`;
- this review document.

## Preservation

No file under the paused GitHub-native simulation/RPC addon was modified. The branch does not touch:

- `packages/github-native-sim/**`;
- `.github/workflows/github-native-simulate.yml`;
- `packages/runner/src/rpc-method-policy.mjs`;
- Cloudflare mode;
- CurveYield Lite;
- submitted-project execution.

## Residual work

Independent review found separate adapter and runner trust-boundary defects. They require a distinct test-first repair before issue #104 can be accepted. Those findings include validating publication plans before transport lookup, avoiding pre-boundary getter/proxy invocation, validating transport return values, and strengthening admission/outcome/publication cross-record truth constraints.
