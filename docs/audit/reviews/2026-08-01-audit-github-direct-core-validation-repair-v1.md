# GitHub Direct Core Validation Repair Review v1

## Verdict

`ACCEPT` for the protocol-validation repair tracked by issue #106.

This verdict applies only to the GitHub Direct Audit protocol validators repaired here. It does not accept the remaining ledger-boundary findings tracked by issue #108, the active service/workflow package in issue #104, or the separately paused GitHub-native simulation/RPC addon.

## Lineage

- Parent accepted-core candidate: `2df9cbfd534ab97da9aa26077879433a7fc4a8a4`
- Repair branch: `audit-repair/github-direct-core-validation-v1`
- Production repair candidate: `2f98a03e5946f02e718015356c378c93a64451b6`
- Issue: #106

## Root cause

The builders validated fields before hashing, but several exported validators only checked that an input was self-consistent with its caller-supplied digest and derived ID. Invalid field values could therefore be accepted after recomputing the digest.

Affected boundaries:

- direct state repository identity;
- authorization capability manifests;
- result outcome/execution truth and summary contracts;
- report-index identity, entry and hostile-container validation.

## Test-first evidence

The regression suite was committed before production changes as:

- `test/audit-github-direct-core-validation-repair-v1.test.mjs`
- RED commit: `87b518fd2defc52d935e6430c8ff101ed18e0e54`

Observed RED against the accepted source:

- tests: 11;
- passed: 1;
- failed: 10;
- failures reproduced self-hashed invalid repository names, auth kinds, modes, expiry relationships, capability values, result truth combinations, malformed summaries, invalid SHAs/report versions/entry kinds, and hostile iterator/accessor invocation.

## Repairs

### State validation

`validateDirectState()` now validates and canonicalizes every body field, including `repositoryFullName`, before checking `stateDigest`.

### Capability validation

`validateCapabilityManifest()` now validates:

- exact mode and schema;
- job/repository/installation identities;
- canonical repository name and target SHA;
- closed authorization kind;
- closed, unique and canonical capability list;
- canonical timestamps and strict expiry ordering;
- digest and derived capability ID.

### Result validation

`validateResultManifest()` now validates:

- mode/job/SHA and profile/parser/result-contract versions;
- outcome and execution-state enums;
- nullable result digest;
- bounded exact summary;
- execution-plane-unavailable and fixture-modeled truth constraints;
- canonical timestamp, digest and derived manifest ID.

The prior no-op `createResultManifest;` statement was removed.

### Report-index validation

`validateReportIndex()` now:

- validates entries through bounded dense-array and exact-object boundaries before iteration/sorting;
- rejects symbol-backed iterators, sparse arrays and accessor-backed fields without invoking attacker code;
- validates report IDs, digests and kinds;
- rejects duplicate and noncanonical ordering;
- validates mode/job/SHA/report-contract version/timestamp/digest/derived ID.

## Fresh GREEN verification

Command:

```text
node --test test/audit-github-direct-core-protocol-v1.test.mjs test/audit-github-direct-core-validation-repair-v1.test.mjs
```

Result:

- tests: 22;
- passed: 22;
- failed: 0;
- skipped: 0;
- cancelled: 0.

Syntax verification:

```text
node --check packages/audit-github-direct-protocol/src/lifecycle.mjs
node --check packages/audit-github-direct-protocol/src/publication.mjs
```

Both commands exited successfully.

## Changed files

- `docs/superpowers/plans/2026-08-01-github-direct-core-validation-repair.md`
- `packages/audit-github-direct-protocol/src/lifecycle.mjs`
- `packages/audit-github-direct-protocol/src/publication.mjs`
- `test/audit-github-direct-core-validation-repair-v1.test.mjs`
- this review document.

## Scope and preservation

No file under the paused GitHub-native simulation/RPC addon was changed. The repair does not touch:

- `packages/github-native-sim/**`;
- `.github/workflows/github-native-simulate.yml`;
- `packages/runner/src/rpc-method-policy.mjs`;
- Cloudflare mode;
- CurveYield Lite;
- submitted-project execution.

Existing valid protocol vectors remained byte-equivalent under validation, and the original protocol suite passed unchanged.

## Residual work

The accepted issue #98 candidate still has separate ledger path/recovery defects tracked by issue #108. Issue #104 must consume both this protocol repair and the later accepted ledger repair before its service/workflow candidate can be accepted.
