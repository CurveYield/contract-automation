# GitHub Direct Adapter and Runner Boundary Repair Review v1

## Verdict

`ACCEPT` for the adapter and runner boundary repairs tracked by issue #109.

This branch is the current consolidated repaired GitHub Direct Audit core. It includes the accepted protocol repair from issue #106 and ledger repair from issue #108. It does not accept the active service/CLI/workflow package in issue #104 or the separately paused GitHub-native simulation/RPC addon.

## Lineage

- Parent consolidated protocol/ledger SHA: `412e5bdf7ee70cd55348885928685c1455937d5e`
- Repair branch: `audit-repair/github-direct-adapter-runner-boundaries-v1`
- Production and test candidate before this review: `c678c8ba5cc35644de7326585315723f46a25491`
- Issue: #109

## Root causes

### Adapter validation occurred after transport access

`publish()` read publication fields and called `getPublication` before validating the publication plan. A malformed plan could therefore cross an injected transport boundary before rejection.

### Hostile property reads occurred before exact boundaries

`validatePublicationPlan()` read `input?.kind`, and artifact normalization read `item?.schemaVersion`, before hostile-safe descriptor validation. Accessor properties and revoked proxies could throw uncontrolled errors or execute attacker-controlled code.

### Transport return values were trusted

Repository, commit, blob, contents, ledger mutation and publication results were returned without exact shape, bound identity and size validation.

### Runner validators checked digests without complete cross-record truth

Admissions, outcomes and publication plans could be self-hashed around contradictory fixture/reason/state/summary or individually valid but collectively unrelated child records.

### Submitted adapter test source was corrupted

The committed blob for `test/audit-github-direct-core-adapter-v1.test.mjs` contained invalid UTF-8 bytes beginning in its later test body. Direct blob decoding failed and ranged text retrieval produced binary replacement/control data. The file could not serve as trustworthy executable acceptance evidence. It was replaced with a clean, equivalent-plus-stronger nine-test suite.

## Test-first evidence

The boundary regression suite was committed before production changes:

- file: `test/audit-github-direct-adapter-runner-boundaries-repair-v1.test.mjs`;
- RED commit: `9e35c28a1d95f75ee70cf9a4c37e6e3a7772edeb`.

Observed RED against the consolidated protocol/ledger parent:

- tests: 10;
- passed: 0;
- failed: 10;
- failures covered hostile publication/artifact reads, transport-before-validation, transport response drift, admission contradictions, outcome contradictions and publication child-binding substitutions.

## Repairs

### Publication and artifact boundaries

- publication kind is read through hostile-safe property descriptors;
- publication plans are validated before any transport lookup or mutation;
- artifact records are classified through descriptor inspection without invoking accessors;
- observed publication conflicts retain the stable `publication_conflict` contract;
- the asynchronous `publish()` API contract is preserved.

### Exact transport response contracts

The adapter now validates and freezes exact responses for:

- repository identity;
- target commit SHA;
- requested blob identity and bounded size;
- requested content path and blob SHA;
- applied ledger mutation and exact next blob SHA;
- published record and exact publication ID;
- bounded artifact metadata arrays.

Identity or result drift is rejected before the value reaches callers.

### Runner admission truth

Fixture admissions now require:

- `fixture_modeled`;
- `fixture_allowlisted`;
- a modeled result digest.

Non-fixture admissions now require:

- `awaiting_executor`;
- `execution_plane_unavailable`;
- no modeled digest;
- an exact empty summary.

### Runner outcome truth

Fixture outcomes must be modeled-fixture/completed records with a non-null result digest. Non-fixture outcomes must remain execution-unavailable with an exact empty summary and null result digest. Result production timestamps and transition sequences are bound to the outcome.

### Runner publication binding

The validator now proves:

- the first ledger record is the result and contains the exact result manifest;
- the second ledger record is the report and contains the exact report index;
- both paths belong to the same job;
- the sole report entry references the exact result manifest digest and path-derived report ID;
- Check and status records agree on repository identity, job, target SHA and publication time;
- conclusions, state, descriptions and context exactly reflect fixture versus execution-unavailable truth;
- outcome IDs use the canonical derived-ID shape.

## Clean adapter test replacement

The invalid UTF-8 adapter test blob was replaced with a valid UTF-8 suite covering:

- least-privilege permissions;
- expiry and broad-field rejection;
- bounded error redaction;
- exact read identity and transport response validation;
- hostile transport objects;
- ledger mutation dispatch;
- deterministic publication planning and replay;
- adapter publication idempotency/conflicts;
- artifact metadata validation and freezing.

## Fresh verification

Command set:

```text
node --test \
  test/audit-github-direct-core-protocol-v1.test.mjs \
  test/audit-github-direct-core-validation-repair-v1.test.mjs \
  test/audit-github-direct-core-ledger-v1.test.mjs \
  test/audit-github-direct-ledger-boundaries-repair-v1.test.mjs \
  test/audit-github-direct-core-adapter-v1.test.mjs \
  test/audit-github-direct-core-runner-v1.test.mjs \
  test/audit-github-direct-adapter-runner-boundaries-repair-v1.test.mjs
```

Result:

- tests: 74;
- passed: 74;
- failed: 0;
- skipped: 0;
- cancelled: 0.

Syntax checks succeeded for all five modified production modules and both modified/added test files.

## Changed files in this repair

- `docs/superpowers/plans/2026-08-01-github-direct-adapter-runner-boundaries-repair.md`;
- `packages/audit-github-direct-adapter/src/adapter.mjs`;
- `packages/audit-github-direct-adapter/src/publications.mjs`;
- `packages/audit-github-direct-runner/src/admission.mjs`;
- `packages/audit-github-direct-runner/src/orchestration.mjs`;
- `packages/audit-github-direct-runner/src/publication.mjs`;
- `test/audit-github-direct-adapter-runner-boundaries-repair-v1.test.mjs`;
- `test/audit-github-direct-core-adapter-v1.test.mjs`;
- this review document.

## Preservation

No paused GitHub-native simulation/RPC addon file was modified. The branch does not touch:

- `packages/github-native-sim/**`;
- `.github/workflows/github-native-simulate.yml`;
- `packages/runner/src/rpc-method-policy.mjs`;
- Cloudflare mode;
- CurveYield Lite;
- submitted-project execution.

## Integration requirement

Issue #104 must reconstruct or incorporate this branch's final SHA before final acceptance. Using the original issue #98 head alone is prohibited because it omits all three accepted repair packages and retains the corrupted adapter test blob.
