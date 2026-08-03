# Round 5 Production-Test Preparation Design v1

## Status

Approved by the existing Round 5 acceptance contract in issue #125 and the user's sole-orchestrator directive. This design covers static preparation only. It does not authorize promotion, secret access, deployment, workflow dispatch, live simulation, or production testing.

## Source binding

All preparation begins from exact accepted Round 4 SHA `3da6b10f240e2abd031195f440c7cd80b72b691b` on isolated branch `orchestrator/round5-production-test-prep-v1`.

The accepted source is bound to:

- PR #139;
- base SHA `bbb4cac794865f84b65ee78a2fc78d391421c759`;
- merge ref `311311768f3e0465d0583f2be0a0f7d67215fa52`;
- 202 changed paths;
- 198-path exact-tree attestation;
- attestation SHA-256 `22ee6ee759c027189b9e8887e584c976e378a6de917a20acb0e5275e3a1afc16`;
- successful exact-head CI runs `30788571549` and `30788571507`.

Any source-SHA change invalidates this preparation package.

## Architecture

The package uses focused versioned JSON manifests under `docs/audit/round5/` plus one Node test that validates schemas, exact cross-references, stage ordering, secret-name-only handling, resource expectations, rollback coverage, observability/redaction requirements, RPC safety, V27 live-regression evidence requirements, and explicit authorization gates.

Each manifest has one responsibility:

1. `release-source-binding-v1.json` — exact immutable source and CI evidence.
2. `production-test-manifest-v1.json` — ordered stages, owners, prerequisites, evidence, and acceptance rules.
3. `secret-variable-binding-manifest-v1.json` — required secret/variable names and non-disclosure rules, never values.
4. `production-resource-manifest-v1.json` — expected Cloudflare, Pages, R2, domains, GitHub and seven-network RPC resources.
5. `deployment-preflight-manifest-v1.json` — trusted source, workflow, permissions, action pins, concurrency, artifact and idempotency gates.
6. `rollback-recovery-manifest-v1.json` — last-known-good binding, rollback, redeploy, partial-publication recovery, duplicate reconciliation and test-key rotation.
7. `observability-redaction-manifest-v1.json` — structured logs, correlation IDs, recursive redaction, retention and prohibited output.
8. `trusted-v27-live-regression-contract-v1.json` — exact dispatch prerequisites, artifact digest binding, assertions and no-broadcast requirements.
9. `production-authorization-gate-v1.json` — promotion, credential-name readiness, deployment and live-test gates.
10. `README_v1.md` — operator ordering and interpretation.

## Data flow

1. The release-source manifest pins the accepted Round 4 SHA and tree digest.
2. All other manifests reference its `releaseBindingId`.
3. The production-test manifest orders configuration preflight before deployment and gates live API/R2/GitHub/RPC/UI testing on a verified deployment checkpoint.
4. Rollback, observability and recovery requirements apply to every live stage.
5. The V27 contract can be satisfied only by a trusted workflow run against the promoted exact SHA with a downloaded artifact digest and complete validation record.
6. The authorization gate remains closed until the account owner performs each external action explicitly.

## Security boundaries

- No secret values, endpoint URLs, wallet keys, seed phrases, signing, or transaction broadcasting.
- Required credentials are represented by names and expected scopes only.
- RPC endpoints are read-only fork sources guarded by the accepted fail-closed method policy.
- Pull-request workflows remain secretless and read-only.
- Deployment and live workflows must run only against an explicitly reviewed trusted SHA.
- Third-party actions must remain pinned to full immutable SHAs.
- Test resources and data must be bounded, reversible, isolated and disposable.
- Destructive recovery cannot target irreplaceable production data.

## Error handling

Every production stage has fail-closed acceptance:

- missing or mismatched source SHA: reject;
- missing credential/variable name: block without retrieving values;
- action pin, permission or workflow-source mismatch: reject;
- deployment resource mismatch: rollback and reject;
- identity, tenant isolation, credential, transaction capability or redaction failure: critical reject;
- RPC unsupported method forwarding or transaction method exposure: critical reject;
- rollback or recovery failure: reject and preserve last-known-good state;
- evidence missing exact run/SHA/artifact identifiers: incomplete, never accepted.

## Testing strategy

`test/audit-round5-production-readiness-v1.test.mjs` performs deterministic source-only validation:

- all required manifests exist and parse;
- schema versions and IDs are exact;
- every manifest binds the same accepted source;
- required secret and variable names match issue #125 exactly and contain no values;
- expected resources, domains, CORS and retention are exact;
- seven supported networks and read-only restrictions are complete;
- all eight production stages have prerequisites, evidence and reject conditions;
- rollback, observability, recovery and V27 gates are complete;
- authorization defaults remain closed;
- no manifest contains credential-like values, private-key material, raw RPC URLs or authorization bypasses.

The test is introduced RED before the manifests exist, then made GREEN by the minimum complete package. No dependency download or compilation is required locally.

## Completion condition

Static production-test readiness is established only when the full package passes exact-head secretless CI on one preparation SHA and the sole remaining blockers are explicit account-owner authorization, credential-name readiness, deployment and live-test execution.
