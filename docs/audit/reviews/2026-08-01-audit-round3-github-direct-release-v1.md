# GitHub Direct Audit Round 3 Release Review v1

## Recommendation

**ACCEPT** the Round 3 GitHub Direct audit release candidate for Round 4 integration, subject to the final remote equality, protected-blob, changed-path, and mailbox completion gates recorded on issue #115.

## Reviewed candidate

- Starting SHA: `66c3060da74ba79a780847eb86307d0b5641b20a`
- Approved repaired core SHA: `22c22dd9de0e21b066ac29c9e0d9422a73724a31`
- Code/test candidate SHA: `f6e3ce63b18aed898d6458685026d313feb47440`
- Branch: `audit-round3/github-direct-audit-release-v1`
- Issue: `#115`

The final documentation SHA is recorded separately in the issue report and mailbox to avoid self-referential release metadata.

## Scope

The review covered:

- protocol identity canonicalization;
- ledger paths, mutation classes, state transitions, request publication, CAS and recovery;
- capability and permission manifests;
- GitHub adapter response boundaries and publication reconciliation;
- inert runner admission/outcome/publication truth;
- reporting and artifact metadata contracts;
- service command/result/error contracts;
- trusted CLI serialization and exit behavior;
- trusted workflow source, inputs, permissions, concurrency, action pins and artifacts;
- deterministic compatibility/release manifests and Round 4 handoff;
- frozen GitHub-native simulation/RPC paths.

## Method

- Test-first boundary work with an initial 12-test RED gate: 0 passed, 12 failed.
- A second nested-contract RED matrix before public permission/reporting/result validation.
- A final pagination RED gate proving first-page-only reconciliation could duplicate an older side effect.
- Hostile object tests for accessors, symbols, custom prototypes and revoked proxies.
- One-field mutation matrices across commands, results, errors and release manifests.
- Identity substitution for repository, installation, requester, job and target SHA.
- Partial-write, immutable conflict, stale CAS, cancellation, report replay and publication conflict scenarios.
- Static trusted-workflow attack tests and YAML parsing.
- No dependency installation, submitted execution, live RPC, live workflow execution, deployment or secret use.

## Findings resolved

### R3-01 — Noncanonical GitHub repository identity

Mixed-case GitHub full names now normalize to lowercase before request IDs and digests are built. Malformed names remain rejected.

### R3-02 — Request-publication child plans were not cross-bound

The validator now proves exact operation order, path classes, request/current identity, requested version/state, index entry, timestamp and deterministic blob-fingerprint linkage.

### R3-03 — Ledger transitions were not cross-bound

Transition validation now proves event/current/index order, job/event identity, state/version/timestamp truth, exact child content and jobs-index linkage.

### R3-04 — Publication journal path was outside the closed namespace

Publication records now use only `.audit-direct/v1/publications/<job>/<publication>.json`, derived by a server-owned builder and accepted by the closed path parser.

### R3-05 — Service results lacked a strict externally self-attesting contract

The public service facade emits `github-direct-service-result-v2` with deterministic `resultId` and `resultDigest`. Nested data remains validated by the strict command/state-specific v1 body validator. Public APIs consume v2; the trusted CLI alone contains a command-bound v1 migration adapter for the private legacy service implementation.

### R3-06 — Permission manifests lacked a public validator

Permission records now validate exact fields, identities, canonical ordering, duplicate absence, allowed resource/access pairs, digest and derived ID.

### R3-07 — Reporting bundles and artifact indexes lacked complete nested binding

Submission, terminal, fixture and cancellation reporting validators now bind job/SHA, result/report identity, immutable ledger order/content, timestamps and publications. Artifact indexes validate job/SHA and duplicate artifact IDs.

### R3-08 — CLI could serialize malformed service output

The CLI validates errors and v2 results before output. Malformed output yields a redacted stable service-failure record and no raw credential-bearing content.

### R3-09 — Missing publication journal could duplicate side effects

Before creating a Check, status or comment, the transport searches bounded GitHub pages for the exact reconciliation identity. Tests inject a journal-write failure after each side effect and prove retry creates one side effect total. Search is bounded to ten pages of 100 records.

### R3-10 — Artifact metadata was repository-wide rather than exact-target scoped

The transport sends the exact target artifact name to GitHub and filters returned records again locally. Only metadata is returned.

### R3-11 — Workflow scope and permissions were broader or caller-selected

Only operation and exact target SHA are caller inputs. Installation and report issue are repository-owned variables. Permissions are split per operation. Trusted code is pinned to `github.workflow_sha`; target code remains inert. All actions are pinned to full SHAs. Same-target operations serialize without auto-cancellation.

### R3-12 — Compatibility and release handoff were absent

Deterministic compatibility and release manifests now describe command/result/error schemas, candidate/core/workflow SHAs, protected-path digest, integration order, no submitted execution and no Cloudflare fallback. A dedicated Round 4 handoff is included.

### R3-13 — First-page-only reconciliation window

Final broad review identified that a missing journal could leave an older marker beyond page one. Reconciliation now walks up to ten bounded pages for comments, statuses and Checks. The artifact query also includes the exact name server-side and filters again client-side.

## Verification evidence

Fresh local exact/source-equivalent gate after R3-13:

```text
100 tests passed
0 tests failed
0 tests skipped
0 tests cancelled
```

Additional gates:

- all owned production `.mjs` modules passed `node --check`;
- trusted workflow YAML parsed successfully;
- Round 3 JSON manifests parsed and validated through public constructors/validators;
- whitespace gate passed;
- critical remote candidate blobs were compared with locally tested Git object hashes before documentation publication;
- protected simulation/RPC paths are subject to final exact-blob comparison and changed-path exclusion.

## Security invariants retained

- no submitted project execution;
- no Cloudflare/R2 fallback;
- no arbitrary commands, paths, URLs, runner labels or images;
- no credential fields in commands, results, reports, artifacts or release records;
- exact commit SHA identity throughout;
- server-derived ledger and publication paths;
- immutable records and explicit CAS only;
- no prefix listing for ledger recovery;
- allowlisted inert fixtures only;
- no workflow, deployment, package, administration, security-event or identity-token permissions.

## Frozen simulation/RPC boundary

Round 3 does not own or modify:

- `.github/workflows/github-native-simulate.yml`
- `packages/github-native-sim/**`
- `packages/runner/src/rpc-method-policy.mjs`
- `packages/runner/src/fork-rpc-guard.mjs`
- `packages/runner/src/run-job.mjs`

The final gate must verify the five recorded starting blobs remain byte-identical and the three absent runner paths remain absent.

## Residual risks and operational prerequisites

1. The trusted workflow was not approved or executed during this audit. Repository variables and branch protection must be configured and independently reviewed before a real run.
2. Publication recovery is deliberately bounded to 1,000 records per type. If the exact side effect falls outside that window, an operator must reconcile it rather than automatically recreate it.
3. Artifact bytes and submitted analysis execution remain outside this release. Only exact-target metadata and inert target binding are handled.
4. Direct external consumers must adopt service-result v2. Importing private `service.mjs` bypasses the public v2 facade and is unsupported.
5. GitHub API semantics and permissions should be revalidated during Round 4’s authorized integration test because no live network calls were permitted in Round 3.

## Final disposition

No unresolved High, Medium or Low implementation finding remains within issue #115’s owned static/inert scope. The residual items above are explicit operational prerequisites or intentionally excluded execution capabilities, not hidden fallbacks.
