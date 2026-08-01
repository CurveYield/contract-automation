# Phase 5 Result-Contract Congruence, Replay, and Adversarial Hardening v2

## Disposition

**ACCEPT WITH REPAIR**

The owned Phase 5 result-contract and catalog packages now strictly validate every accepted normal, malformed, parser-error, timeout, and cancellation envelope; enforce exact evidence and summaries; reject adversarial object graphs; prove catalog/publication congruence; and retain the execution-disabled boundary. One accepted upstream parser mismatch remains: `resource_exhaustion` currently preserves process `exitCode: 137`, while the authoritative lifecycle contract requires `exitCode: null`. The mismatch is pinned by compatibility tests without modifying the accepted parser or fixture.

## Repository state

- Assignment issue: `#76`
- Branch: `audit-phase5/result-contract-hardening-v2`
- Starting SHA: `613e829bc16384307d4b30e87a0cd3e7377b4386`
- Final reviewed implementation SHA: `40b5ad7e60ed255ad7723592d91967ca3b05513d`
- Review generated UTC: `2026-08-01T14:58:54Z`
- Review generated America/Los_Angeles: `2026-08-01T07:58:54-07:00`

This document is committed after the reviewed implementation, so the final review-only branch commit cannot self-reference its own Git SHA. The exact final branch SHA is pinned in the issue #76 final report and Worker 3 completion status/event.

## Path ownership and changed files

All implementation changes are confined to the assignment-owned packages and focused test prefixes.

### Result-contract package

- `packages/audit-phase5-result-contracts/src/errors.mjs` — stable bounded validation errors with exact codes and paths.
- `packages/audit-phase5-result-contracts/src/contracts.mjs` — canonical schema, profile, evidence, classification, record-key, and bound constants.
- `packages/audit-phase5-result-contracts/src/boundary.mjs` — strict ordinary-object/Array gates, accessor/proxy rejection, bounded scalars, safe paths, recursive defensive cloning/freezing.
- `packages/audit-phase5-result-contracts/src/records.mjs` — exact four-profile record validation, canonical ordering, duplicate/conflict handling, and summary derivation.
- `packages/audit-phase5-result-contracts/src/index.mjs` — lifecycle, evidence, summary, artifact, parser-error, profile-plan, and result validation.

### Catalog package

- `packages/audit-phase5-tool-catalog/src/index.mjs` — exact sorted membership, immutable tool/profile identity, publication validation, truthful digest requirements, inert state enforcement, defensive output, and package compatibility mapping.

### Focused tests

- `test/audit-phase5-result-lifecycle-hardening-v2.test.mjs`
- `test/audit-phase5-result-evidence-summary-v2.test.mjs`
- `test/audit-phase5-result-boundary-ordering-v2.test.mjs`
- `test/audit-phase5-catalog-hardening-v2.test.mjs`
- `test/audit-phase5-compatibility-fixture-replay-v2.test.mjs`
- `test/audit-phase5-compatibility-mutation-vectors-v2.test.mjs`
- `test/audit-phase5-compatibility-static-boundary-v2.test.mjs`
- `test/audit-phase5-compatibility-helpers-v2.mjs`

No accepted Phase 5 parser/profile/fixture, Phase 4, Phase 6, API, web, workflow, deployment, executor, integration, or CurveYield Lite path changed.

## Initial red evidence

Command:

```text
node --test \
  test/audit-phase5-result-lifecycle-hardening-v2.test.mjs \
  test/audit-phase5-result-evidence-summary-v2.test.mjs \
  test/audit-phase5-result-boundary-ordering-v2.test.mjs \
  test/audit-phase5-compatibility-fixture-replay-v2.test.mjs \
  test/audit-phase5-catalog-hardening-v2.test.mjs \
  test/audit-phase5-compatibility-static-boundary-v2.test.mjs
```

Result against the pinned sequence-1 implementation:

```text
23 tests
7 passed
16 failed
0 cancelled
0 skipped
TAP duration: 129.106047 ms
```

The failures reproduced lifecycle ordering, evidence/summary permissiveness, canonical ordering/duplicate gaps, defensive-boundary gaps, incomplete fixture replay acceptance, catalog truthfulness, and static-boundary deficiencies.

Additional focused red gates were preserved for transparent/revoked proxy rejection and nested published-contract prototype rejection before their minimal fixes.

## Final green evidence

Command:

```text
node --test \
  test/audit-phase5-result-contract-compatibility-v1.test.mjs \
  test/audit-phase5-result-lifecycle-hardening-v2.test.mjs \
  test/audit-phase5-result-evidence-summary-v2.test.mjs \
  test/audit-phase5-result-boundary-ordering-v2.test.mjs \
  test/audit-phase5-compatibility-fixture-replay-v2.test.mjs \
  test/audit-phase5-catalog-hardening-v2.test.mjs \
  test/audit-phase5-compatibility-mutation-vectors-v2.test.mjs \
  test/audit-phase5-compatibility-static-boundary-v2.test.mjs
```

Fresh final result:

```text
36 tests
36 passed
0 failed
0 cancelled
0 skipped
TAP duration: 229.896515 ms
```

Additional verification:

```text
syntax_files=15
json_files=17
changed_files=14
owned_paths_only=true
diff_check=clean
execution_boundary_matches=0
```

The only untracked local file was `.expected-starting-sha`; it was never published.

## Authoritative fixture inventory and replay

- Fixture payloads: `16`
- JSON files, including manifests: `17`
- Fixture owner in both manifests: `CurveYield`
- Duplicate/omitted payloads: none
- All JSON payloads parse successfully.
- Production modules do not enumerate repository files; inventory reads occur only in focused tests.

### Normal replay

| Fixture | Profile | Classification | Replay byte-identical | Contract valid | Bytes |
|---|---|---:|---:|---:|---:|
| `hardhat-success-v1.json` | `hardhat-test-v1` | success | yes | yes | 704 |
| `hardhat-findings-v1.json` | `hardhat-test-v1` | findings | yes | yes | 731 |
| `echidna-success-v1.json` | `echidna-v1` | success | yes | yes | 719 |
| `echidna-findings-v1.json` | `echidna-v1` | findings | yes | yes | 831 |
| `mutation-success-v1.json` | `mutation-v1` | success | yes | yes | 765 |
| `mutation-findings-v1.json` | `mutation-v1` | findings | yes | yes | 899 |
| `dependency-success-v1.json` | `dependency-scan-v1` | success | yes | yes | 477 |
| `dependency-findings-v1.json` | `dependency-scan-v1` | findings | yes | yes | 974 |

Record-order permutations are byte-identical for all four parsers. Mutation and dependency conflicting-duplicate fixtures return stable `conflicting_duplicate` parser-error envelopes under reversal. Sensitive-message replay contains `[redacted]` and `[path]` and does not retain the fixture private key, mnemonic, API/access token, Windows path, or POSIX path.

## Lifecycle truth table

| Classification | Exit code | Profile arrays | Evidence/artifacts | Parser errors | Summary | Result |
|---|---|---|---|---|---|---|
| `success` | non-null | exact profile array | exactly one matching evidence; artifacts empty | empty | exact profile summary | accepted only when all clean/finding predicates agree |
| `findings` | non-null | exact profile array | exactly one matching evidence; artifacts empty | empty | exact profile summary | accepted only when records/exit imply findings |
| `timeout` | `null` | all empty | empty | empty | empty | accepted |
| `cancelled` | `null` | all empty | empty | empty | empty | accepted |
| `resource_exhaustion` | `null` required | all empty | empty | empty | empty | accepted contract; current parser fixture rejected at `$.exitCode` because it emits `137` |
| `malformed_output` | bounded parser-produced value | all empty | empty | exactly one bounded error | empty | accepted |
| `parser_error` | bounded parser-produced value | all empty | empty | exactly one bounded error | empty | accepted |
| invalid-profile sentinel | bounded fixed sentinel | all empty | empty | one stable validation error | empty | accepted only as `parser_error` with `invalid-profile-v1` / `unknown-parser-v1` |

## Evidence and summary truth table

| Profile | Record key | Evidence type | Exact summary |
|---|---|---|---|
| `hardhat-test-v1` | `hardhatTests` | `hardhat-test-summary` | passed, failed, skipped, total |
| `echidna-v1` | `echidnaProperties` | `echidna-campaign-summary` | passed, failed, total, uint32 seed |
| `mutation-v1` | `mutationResults` | `mutation-summary` | killed, survived, timedOut, invalid, total, deterministic mutationScore |
| `dependency-scan-v1` | `dependencyFindings` | `dependency-scan-summary` | critical, high, moderate, low, unknown, total |

Every normal result requires exactly one `phase5-parser-evidence-v1` record. Evidence type and record count must exactly match the accepted parser contract and normalized array length.

## Catalog and publication truth table

| Property | Unpublished | Published |
|---|---|---|
| Membership | exact four sorted profiles | exact four sorted profiles |
| `digestRequired` | `true` | `true` |
| Digest | `null` | accepted immutable digest only |
| Publication timestamp | `null` | canonical accepted timestamp only |
| Tool/adapter/parser/repository identity | exact template | exact template, no drift |
| `runnable` | `false` | `false` |
| `executionEnabled` | `false` | `false` |
| `executorState` | `unavailable` | `unavailable` |

Duplicate, unknown, malformed, custom-prototype, proxy, nested hostile-prototype, cross-profile, and identity-drift publication inputs fail deterministically. Catalog and compatibility outputs are recursively frozen defensive clones.

## Exported interfaces

### Result package public API

- `PHASE5_RESULT_SCHEMA_VERSION`
- `PHASE5_EVIDENCE_SCHEMA_VERSION`
- `PHASE5_RESULT_CONTRACTS`
- `PHASE5_RESULT_PROFILE_IDS`
- `validatePhase5ToolResult(value)`
- `validatePhase5ResultForProfile(profileContract, result)`

### Catalog package public API

- `PHASE5_CATALOG_ENTRY_SCHEMA_VERSION`
- `createPhase5ToolCatalog(publishedProfiles?)`
- `validatePhase5Catalog(value)`
- `assertPhase5PackageCompatibility()`

## Defensive and mutation boundaries

Validation rejects:

- class instances, arbitrary/custom prototypes, transparent and revoked proxies;
- Array subclasses, sparse arrays, symbol keys, accessors/getters;
- negative zero, NaN, Infinity, unsafe integers;
- control characters, oversized strings/collections, unsafe paths;
- noncanonical record/alias ordering and exact duplicates;
- conflicting mutation/dependency logical identities;
- schema, profile, parser, plan/result, publication, evidence, summary, lifecycle, artifact, and catalog substitutions.

Validated output is recursively frozen, uses ordinary prototypes, and does not retain attacker-controlled source prototypes.

## Static execution boundary

Focused source audits found zero production matches for filesystem/repository enumeration, child process or worker execution, network/HTTP/RPC/DNS/socket/fetch capability, package-manager/install/container/dynamic-code capability, credential/key/wallet/signer/transaction/deployment capability, CurveYield Lite imports, or `executionEnabled: true`.

## Transport and publication

A normal Git push was attempted and failed only because the container could not resolve `github.com`. Connector Git-data publication created content-addressed blobs/trees, used the exact starting SHA as the sole parent, and fast-forwarded only the assigned branch with `force=false`. Remote test-file blob SHAs were read back and matched their local Git object IDs.

## Upstream defect and required repair

The accepted Phase 5 parser currently maps termination `resource_exhausted` to classification `resource_exhaustion` but retains the raw process `exitCode: 137`. The authoritative lifecycle rule requires terminal lifecycle classifications to use `exitCode: null`.

Required upstream repair, outside this assignment's ownership:

1. Change the accepted parser's resource-exhaustion terminal envelope to emit `exitCode: null`.
2. Update the accepted fixture expectation if needed.
3. Re-run this compatibility suite; the explicit rejection test should then become direct acceptance.

## Blocked and prohibited checks

Not run by explicit assignment restriction:

- npm or any package manager;
- dependency installation or downloads;
- compilation or builds;
- Hardhat, Echidna, Gambit, or OSV-Scanner;
- containers or submitted-project execution;
- deployment, AWS, workflows, API/web/executor integration, or execution enablement;
- merge to `main` or Phase 4 integration.

## Residual risks

- Validation is proven against CurveYield-owned inert fixtures, not live external-tool execution.
- Future upstream output variants require explicit schema/fixture review.
- Resource enforcement, cancellation delivery, executor images, and immutable real image publication remain future gated work.
- Phase 5 integration remains gated on accepted Phase 4.

## Final recommendation

**ACCEPT WITH REPAIR** — accept the owned result-contract/catalog hardening, while requiring the separately owned accepted parser to null `exitCode` for resource exhaustion before claiming complete lifecycle congruence.
