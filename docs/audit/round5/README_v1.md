# Round 5 Static Production-Test Readiness Package v1

## Scope

This directory is a **static-only** production-test preparation package for `CurveYield/contract-automation`.

It is bound to accepted Round 4 source SHA `3da6b10f240e2abd031195f440c7cd80b72b691b` through release binding `round5-release-source-3da6b10-v1`.

Static readiness does **not** authorize a merge, promotion, credential access, secret or variable changes, deployment, workflow dispatch, live simulation, signing, transaction broadcasting, or production testing.

## Required reading order

1. `release-source-binding-v1.json`
2. `secret-variable-binding-manifest-v1.json`
3. `production-resource-manifest-v1.json`
4. `production-test-manifest-v1.json`
5. `deployment-preflight-manifest-v1.json`
6. `rollback-recovery-manifest-v1.json`
7. `observability-redaction-manifest-v1.json`
8. `trusted-v27-live-regression-contract-v1.json`
9. `production-authorization-gate-v1.json`

Every JSON manifest must use the same `releaseBindingId`. Any source-SHA change invalidates the whole package.

## Closed-by-default gates

The account owner must separately authorize:

- candidate promotion or merge;
- confirmation that required secret and repository-variable names exist, without revealing values;
- deployment;
- trusted V27 and other live production tests.

All four gates remain closed in this package.

## Evidence rules

Evidence must identify the exact SHA, workflow run, artifact, resource and configuration digest involved. In-progress, missing, stale or partial evidence is not acceptance.

No secret values, raw RPC endpoint URLs, private keys, seed phrases, authorization headers, submitted source, host paths or public stack traces may be stored in these records.

## Completion condition

Static production-test readiness is established only after this complete package passes naturally triggered secretless CI on one exact preparation SHA. The next step must still be an explicit account-owner authorization gate.
