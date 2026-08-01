# Phase 5 Parser Lifecycle Repair v1 — Durable Review

## Disposition

**ACCEPT**

The Phase 5 parser lifecycle mismatch is repaired. Every non-completed terminal result now emits `exitCode: null`, preserves bounded duration and exact profile/parser identity, and contains no profile records, evidence, artifacts, parser errors, or summary data. The accepted Phase 5 result contract validates every tested terminal envelope for all four profiles.

## Repository state

- Assignment issue: `#79`
- Assigned branch: `audit-phase5/parser-lifecycle-repair-v1`
- Required starting SHA: `dd78a76f9546c85e79357a617b219067704c1616`
- Canonical implementation SHA: `c216692cf780871dc1f2701f4ecdbfa1c778c538`
- Final branch SHA after this review publication: recorded in the verified issue #79 report and Worker 3 completion status.
- Review timestamp UTC: `2026-08-01T15:37:47Z`
- Review timestamp America/Los_Angeles: `2026-08-01T08:37:47-07:00`

## Changed paths

Implementation:

- `packages/audit-phase5-parsers/src/lifecycle-boundary.mjs` — strict external input boundary, terminal normalization, bounded metadata extraction, and deterministic error redaction.
- `packages/audit-phase5-parsers/src/index.mjs` — routes the public parser entry point through the lifecycle boundary while preserving the public API and profile parsers.
- `test/audit-phase5-parser-lifecycle-normalization-v1.test.mjs` — all-profile lifecycle, result-contract congruence, replay, raw-process resistance, defensive input, proxy/accessor, and bounded-error regressions.
- `test/audit-phase5-parser-contract-static-boundary-v1.test.mjs` — static capability and import-boundary enforcement.

Documentation:

- `docs/audit/reviews/2026-08-01-audit-phase5-parser-lifecycle-repair-v1.md` — this durable review.

No result-contract, catalog, profile-contract, fixture, Phase 1–4, Phase 6, API, web, workflow, executor, deployment, integration, shared-protocol, GitHub Direct, or CurveYield Lite path changed.

## Initial red evidence

Focused command before production repair:

```text
node --test test/audit-phase5-parser-lifecycle-normalization-v1.test.mjs
```

Observed result:

```text
15 tests
8 passed
7 failed
0 cancelled
0 skipped
TAP duration: 79.956641 ms
```

The failures demonstrated that raw terminal process exit codes survived into `resource_exhaustion`, terminal output varied with raw metadata, accessors/custom boundaries were not fully rejected, negative zero survived, and control-character metadata was not consistently bounded.

A second focused regression for descriptor-trapping/revoked proxies was also demonstrated red before its fix:

```text
1 test
0 passed
1 failed
```

The failure was an uncaught proxy inspection error containing input-derived secret/path text.

## Green evidence

Focused lifecycle repair after the minimal fix:

```text
15 tests
15 passed
0 failed
TAP duration: 75.568896 ms
```

Descriptor-trap regression after bounded error extraction:

```text
1 test
1 passed
0 failed
TAP duration: 52.892138 ms
```

Accepted parser v1/v2 suites after the final transport-safe boundary refactor:

```text
12 tests
12 passed
0 failed
TAP duration: 79.754151 ms
```

Final compatibility matrix:

```text
48 tests
48 passed
0 failed
TAP duration: 218.657213 ms

4 tests
4 passed
0 failed
TAP duration: 75.654213 ms

4 tests
4 passed
0 failed
TAP duration: 77.76676 ms
```

Final aggregate:

```text
68 tests
68 passed
0 failed
0 cancelled
0 skipped
```

Two read-only issue-#76 diagnostic assertions intentionally expected the former `exitCode: 137` defect. They are superseded mismatch pins, were not modified under issue #79 ownership, and their remaining tests pass. The sequence-3 lifecycle tests replace those two negative assertions with the repaired accepted contract.

## Lifecycle and exit-code truth table

| Parser input state | Normalized classification | Normalized `exitCode` | Payload contract |
|---|---|---:|---|
| Completed, clean | `success` | Original bounded non-null code | Profile records, exact evidence, exact summary |
| Completed, findings | `findings` | Original bounded non-null code | Profile records, exact evidence, exact summary |
| Timeout | `timeout` | `null` | All profile arrays/evidence/artifacts/errors empty; summary `{}` |
| Cancelled | `cancelled` | `null` | All profile arrays/evidence/artifacts/errors empty; summary `{}` |
| Resource exhausted | `resource_exhaustion` | `null` | All profile arrays/evidence/artifacts/errors empty; summary `{}` |
| Malformed completed output | `malformed_output` | Original bounded completed code | Exactly one bounded parser error; other payload empty |
| Completed parser failure | `parser_error` | Original bounded completed code | Exactly one bounded parser error; other payload empty |
| Invalid/unknown profile | `parser_error` | Bounded safe fallback | `invalid-profile-v1` / `unknown-parser-v1`; one bounded error |

Exact terminal rule:

> Raw process exit codes are validated at input but are never retained in a non-completed terminal result. `timeout`, `cancelled`, and `resource_exhaustion` always normalize to `exitCode: null`.

Completed-result exit-code behavior is unchanged.

## All-profile congruence

The matrix exercised:

- `hardhat-test-v1` / `hardhat-test-parser-v1`
- `echidna-v1` / `echidna-parser-v1`
- `mutation-v1` / `mutation-parser-v1`
- `dependency-scan-v1` / `dependency-scan-parser-v1`

For each profile, timeout, cancellation, and resource exhaustion validate through the accepted `validatePhase5ToolResult()` contract. Completed success/findings, malformed output, parser errors, and invalid-profile sentinel envelopes retain their accepted identity and lifecycle behavior.

## Replay, permutation, and raw-process resistance

- Repeated terminal parsing is byte-identical for all four profiles and all three terminal classifications.
- Terminal output is invariant across permitted raw exit codes, inert text/byte payloads, and ignored record order.
- Raw terminal bytes, secret-bearing strings, host paths, and process exit codes do not leak into normalized records, evidence, summaries, or parser errors.
- Existing normal parser outputs remain record-permutation invariant.
- Conflicting mutation/dependency duplicate envelopes remain deterministic and unchanged.

## Defensive corpus

Covered boundaries include:

- ordinary and null-prototype input objects accepted;
- class instances and custom prototypes rejected;
- accessor properties rejected without invoking getters;
- safely testable, descriptor-trapping, and revoked proxies return bounded errors;
- symbol/unknown fields and missing required data properties rejected;
- non-`Uint8Array` binary-like values and sparse arrays rejected;
- `Uint8Array` subclasses retained for accepted Buffer compatibility;
- invalid UTF-8 and oversized byte input rejected;
- negative zero, unsafe integers, out-of-range exit codes/durations, and control characters rejected;
- invalid/huge/structured profile identifiers use the fixed sentinel;
- input-derived credential/path material is replaced by `[redacted]` and `[path]`.

## Static boundary results

Production parser source was scanned for:

- filesystem access/enumeration;
- process spawning and worker threads;
- network, HTTP, RPC, DNS, sockets, or fetch;
- dynamic code evaluation;
- package-manager, dependency-install, container, image, or binary execution;
- credentials, wallets, signing, transactions, calldata, broadcast, or deployment;
- AWS;
- CurveYield Lite imports;
- execution enablement.

Result: **0 prohibited capability matches**.

Production imports remain local except for the stable `audit-protocol` primitive. `AUDIT_EXECUTION_ENABLED` was not changed and execution remains disabled.

## Additional verification

- Phase 5 fixture JSON files parsed successfully: `17`.
- Changed-path allowlist: passed.
- `git diff --check`: clean.
- Syntax checks for changed parser/test modules: passed.
- Normal `git push` was attempted and failed only because the container could not resolve `github.com`; connector-backed GitHub writes are canonical.

## Blocked and prohibited checks

Not run by assignment restriction:

- npm or any package manager;
- dependency installation/download;
- compilation or builds;
- Hardhat, Echidna, Gambit, or OSV-Scanner;
- submitted projects;
- containers;
- live RPC, wallets, signing, transactions, broadcasts, or deployment;
- workflow approval;
- main/integration merges.

## Residual risks

- Testing uses CurveYield-owned inert fixtures rather than live external-tool execution.
- Future upstream output variants may require explicitly reviewed fixture/schema additions.
- Real executor, resource enforcement, cancellation delivery, and container isolation remain later gated work.
- The historical issue-#76 mismatch-pin tests still encode the old defect by design; the new issue-#79 tests are the authoritative repaired lifecycle gate.

## Final recommendation

**ACCEPT**

The isolated parser mismatch is repaired without weakening completed-output behavior or modifying read-only upstream contracts/fixtures. All permissible lifecycle, compatibility, replay, defensive, and static-boundary checks pass.
