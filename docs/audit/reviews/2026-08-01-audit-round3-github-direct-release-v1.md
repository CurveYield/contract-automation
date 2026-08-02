# GitHub Direct Audit Round 3 Release Review v1

## Recommendation

**ACCEPT** for Round 4 integration.

## Verified lineage

- Starting SHA: `66c3060da74ba79a780847eb86307d0b5641b20a`
- Approved repaired core SHA: `22c22dd9de0e21b066ac29c9e0d9422a73724a31`
- Verified Round 3 release candidate SHA: `46873f805199e2212af3902c8525c0f3e4501721`
- Branch: `audit-round3/github-direct-audit-release-v1`
- Issue: `#115`

The earlier `f6e3ce63...`, `3dca71f9...`, and `6d4dfde5...` values were not GitHub commit objects and are superseded. The final documentation SHA is recorded in issue #115 and the Worker 3 mailbox completion record.

## Scope reviewed

The review covered protocol identity canonicalization; ledger paths, CAS, transitions and recovery; authorization and operation-specific permissions; injected adapter boundaries; execution-disabled runner truth; reporting and artifact metadata; service command/result/error contracts; CLI validation and stable output; trusted workflow permissions and source isolation; replay-safe Check/status/comment reconciliation; compatibility/release manifests; and the Round 4 handoff.

Frozen GitHub-native simulation/RPC paths remained outside scope and unchanged.

## Findings resolved

1. Mixed-case GitHub repository names normalize before request identity and digest construction.
2. Request-publication and transition validators cross-bind exact paths, child content, state, timestamps, index entries and identities.
3. Publication journals use the closed `.audit-direct/v1/publications/<job>/<publication>.json` namespace.
4. Public service results use `github-direct-service-result-v2` with deterministic ID/digest; errors and nested command-specific records are strictly validated.
5. Permission manifests, reporting bundles and artifact indexes validate exact nested identities and canonical ordering.
6. The CLI validates results/errors before serialization and never emits raw credential-bearing failures.
7. Missing-journal recovery reconciles Checks, statuses and comments before recreation, with bounded pagination of ten pages by 100 records.
8. Artifact metadata is queried and filtered for the exact repository/target artifact name.
9. The trusted workflow accepts only a fixed operation and exact target SHA, uses repository-owned configuration, operation-specific permissions, full action SHAs and inert target checkout.
10. Compatibility and release manifests expose transport-neutral Round 4 seams without enabling submitted execution or Cloudflare fallback.

## Verification evidence

Observed test-first RED:

```text
12 tests
0 passed
12 failed
```

Fresh reconstructed final gate:

```text
100 tests
100 passed
0 failed
0 skipped
0 cancelled
```

Additional gates passed:

- syntax checks for all owned production `.mjs` modules;
- trusted workflow YAML parsing;
- compatibility and release manifest validation;
- whitespace checks;
- issue #115 changed-path allowlist;
- protected simulation/RPC path exclusion and recorded blob checks.

## Security invariants

- no submitted-project execution;
- no automatic Cloudflare/R2 fallback;
- no arbitrary command, path, URL, runner or image selection;
- no credential fields in commands, results, reports, artifacts or manifests;
- exact repository/install/requester/target-SHA binding;
- server-derived ledger/publication paths;
- immutable creates and explicit CAS only;
- allowlisted inert fixtures only;
- no workflow, deployment, package, administration, security-event or identity-token permissions.

## Residual operational risks

1. The trusted workflow was not approved or executed during Round 3. Repository variables and branch protection require independent Round 4 validation.
2. Publication recovery is intentionally bounded to 1,000 records per side-effect type; older unmatched records require operator reconciliation.
3. Artifact bytes and submitted analysis execution remain outside this release.
4. External consumers must use the public service-result v2 facade rather than private legacy service internals.
5. GitHub API behavior and installed App permissions require an authorized integration test in Round 4.

## Final disposition

No unresolved implementation finding remains within issue #115’s static and inert scope. The branch is ready for independent Round 4 acceptance.
