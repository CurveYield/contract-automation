# Phase 6 Result Contract and Compatibility Review v1

## Pinned state

- Starting SHA: `5b2575eb22b63773e24943f084a72d14f2565e1b`
- Final implementation SHA before this review document: `0d76434e7e03e3292085daffbcc6f92e7b3aa39d`
- Final branch SHA: pinned in issue #77 and Worker 2 mailbox status after this review file is committed. A file cannot truthfully contain the hash of the commit that contains that same file.
- Branch: `audit-phase6/result-contract-compatibility-v1`
- Ownership result: all implementation changes are under the two assigned packages or allowed `audit-phase6-*` focused tests.

## Delivered contracts

### Result envelope

`@curveyield/audit-phase6-result-contracts` exports:

- `PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION`
- `PHASE6_RESULT_CONTRACT_VERSION`
- `PHASE6_PROFILE_RESULT_IDENTITIES`
- `createPhase6ToolResultEnvelope(profileId, result)`
- `validatePhase6ToolResult(value)`
- deterministic result-contract documentation and serializer

The envelope has exactly 12 fields and binds the accepted profile ID, parser function, parser package/version, capture schema, `formal-result-v1`, exact tool version, trusted producer, outcome, normalized evidence, and nine derived summary values.

### Tool catalog and compatibility

`@curveyield/audit-phase6-tool-catalog` exports:

- `PHASE6_TOOL_CATALOG_VERSION`
- `createPhase6ToolCatalog(publishedProfiles?)`
- `validatePhase6ToolCatalog(value)`
- `PHASE6_PACKAGE_COMPATIBILITY_VERSION`
- `assertPhase6PackageCompatibility(options?)`

The catalog contains exactly the three accepted Phase 6 profiles in sorted order. It copies exact upstream tool/compiler/solver/release identities, admits publication only through `publishPhase6Profile`, requires a real immutable digest before publication is represented, fabricates no timestamp or digest, and always remains non-runnable, execution-disabled, and executor-unavailable.

## Outcome and evidence truth table

| Outcome | Required evidence behavior |
|---|---|
| `proved` | No error diagnostic and no counterexample |
| `disproved` | At least one referentially valid counterexample |
| `unknown` | No counterexample; bounded accepted evidence may remain |
| `timeout` | Proof evidence and source references empty; no error diagnostic |
| `cancelled` | Proof evidence and source references empty; no error diagnostic |
| `resource_exhausted` | Proof evidence and source references empty; no error diagnostic |
| `parser_error` | Exactly one bounded error diagnostic, at least one bounded parser warning, no proof evidence, `truncated=false` |

Every summary count is derived from the validated normalized result. Truncation is true only when accepted parser output truthfully carries truncation state, including `collection_truncated` warnings.

## Identity congruence table

| Profile | Parser function | Capture schema | Tool version | Result schema |
|---|---|---|---|---|
| `solidity-smt-v1` | `parseSoliditySmtBytes` | `solidity-smt-capture-v1` | `0.8.30` | `formal-result-v1` |
| `halmos-v1` | `parseHalmosBytes` | `halmos-capture-v1` | `0.3.3` | `formal-result-v1` |
| `formal-obligations-v1` | `parseFormalObligationsBytes` | `formal-obligations-capture-v1` | `1.0.0` | `formal-result-v1` |

All three require trusted producer `curveyield-formal-capture-producer-v1` and parser package `@curveyield/audit-phase6-parsers` version `0.2.0`.

## Fixture replay

- Authoritative fixture count: **16**
- Inventory omissions: **0**
- Untracked fixture entries: **0**
- Repeated replay: byte-identical
- Permuted model entries / trace steps: byte-identical after accepted parser normalization
- Exact duplicate identities: deduplicated upstream
- Conflicting duplicate identities: stable `parser_error`
- Dangling references: stable `parser_error`
- Malformed JSON, invalid UTF-8, oversized bytes, and rejected capture keys: bounded `parser_error`
- Redaction markers: `[redacted]` and `[path]`
- Injected secret/path survival: none

## Adversarial and mutation coverage

The external boundary rejects without invoking caller accessors:

- getters/accessors and non-enumerable properties;
- symbols, class/custom prototypes, sparse/decorated arrays, cycles, and hostile reflection proxies;
- negative zero, NaN, infinity, unsafe integers, forbidden control characters, and oversized accepted fields;
- noncanonical accepted results and cross-profile identity substitution.

Mutation corpus: **59 invalid one-field variants**, comprising all public result-envelope fields, all `formal-result-v1` fields, all summary fields, all catalog fields, all catalog-entry fields, and identity/lifecycle/evidence/publication substitutions. Every rejection has a stable bounded code/path.

## TDD evidence

- Initial missing-module run: 10 tests, 1 passed, 9 failed.
- Malformed creation regression: 6 tests, 5 passed, 1 failed before repair.
- Full mutation regression: 5 tests, 1 passed, 4 failed before ordering/explicit-catalog repairs.
- Static boundary regression: 4 tests, 3 passed, 1 failed before excluding the scanner's own token vocabulary.

Final command:

```text
node --test packages/audit-phase6-result-contracts/test/*.test.mjs packages/audit-phase6-tool-catalog/test/*.test.mjs test/audit-phase6-result-*.test.mjs test/audit-phase6-catalog-*.test.mjs test/audit-phase6-compatibility-*.test.mjs test/audit-phase6-replay-*.test.mjs
```

Final result:

```text
37 tests, 37 passed, 0 failed
16 JavaScript syntax checks passed
static capability boundary: PASS
```

## Capability boundary

Production code has no filesystem, process, worker, network, HTTP/RPC, dynamic-code, package-manager, container, external-tool, credential, wallet, signing, transaction, broadcast, deployment, Lite, or execution-enablement capability. Filesystem use exists only in focused tests and is read-only against repository-owned Phase 6 fixtures or owned source files for static analysis.

No Solidity, SMTChecker, Halmos, Z3, Foundry, submitted project, container, workflow, deployment, or external formal tool was executed.

## Changed files and purpose

- `packages/audit-phase6-result-contracts/**`: strict result identities, hostile-value sanitizer, envelope validator, documentation, package tests, fixture replay, and static boundary.
- `packages/audit-phase6-tool-catalog/**`: read-only catalog, publication validation, cross-package compatibility assertion, catalog tests, and 59-vector mutation corpus.
- `test/audit-phase6-result-contract.test.mjs`: parser-to-envelope integration.
- `test/audit-phase6-result-boundary.test.mjs`: repository-level static capability gate.
- `test/audit-phase6-catalog-contract.test.mjs`: disabled catalog integration.
- `test/audit-phase6-compatibility-contract.test.mjs`: default package compatibility integration.
- `test/audit-phase6-replay-contract.test.mjs`: exact 16-fixture inventory gate.
- This review document: durable acceptance evidence.

## Blocked checks and residual risks

Blocked by assignment restrictions: dependency installation, repository builds, compilation, GitHub Actions execution, external formal tools, submitted-project execution, containers, deployment, and main integration.

Residual integration risks:

1. The orchestrator must independently run repository-wide tests in its accepted environment.
2. The package intentionally records parser function/package identity rather than inventing an upstream parser-version field.
3. No invocation-plan binding was invented because the accepted Phase 6 upstream exposes no invocation-plan contract.
4. The runtime validator remains authoritative; documentation is descriptive and deterministic.

## Recommendation

**ACCEPT** — the Phase 6 result-contract, fixture replay, catalog, publication, compatibility, mutation, and static-boundary requirements are satisfied without enabling execution or modifying upstream packages.
