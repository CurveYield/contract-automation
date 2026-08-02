# Round 4 Full-Platform Integration — Stage 0 Review v1

## Scope and containment

This document records Worker 2 sequence 8 Stage 0 work for issue #122. The assignment branch started at `5914b03382422ea714346625a601b5dbda3aa0cd` and was identical to the pinned starting SHA before edits.

Stage 0 does not authorize candidate intake or full-platform assembly. Issues #120, #121, #123 and #124 remain active and unresolved. No reviewed subsystem path, shared file, API path, web path, GitHub Direct path, Phase 7–8 path or protected simulation/RPC path has been transplanted or modified.

## Delivered preparatory package

Package: `packages/audit-integration-round4`

The package provides dependency-free, in-memory validators and frozen registries for:

- four unresolved Stage A candidate slots;
- exact completed-status, branch-head, report and manifest evidence;
- preliminary path ownership and overlap rejection;
- protected path/blob identity;
- deterministic shared-file union inputs;
- four waiting intake-wave templates;
- names-only Round 5 production inputs, rate/spend/retention caps, rollback and observability.

Production source imports no filesystem, process, network, VM, credential, wallet, signing, transaction, deployment or workflow module. It cannot perform intake or deployment; it validates inert values only.

## Candidate-resolution state

| Candidate | Worker | Issue | Branch | Starting SHA | State |
|---|---|---:|---|---|---|
| Phase 1–6 + integration review | Worker 0 | #120 | `audit-round4/review-integration-spine-v1` | `5914b03382422ea714346625a601b5dbda3aa0cd` | working / unresolved |
| Phase 7–8 review | Worker 1 | #121 | `audit-round4/review-phase78-api-compat-v1` | `4d7513b7eabd2e2217b1e3fed43d999df828a93f` | working / unresolved |
| API/auth security review | Worker 3 | #123 | `audit-round4/review-api-auth-security-v1` | `6d877e2d87f1a91380a6c5d1efc47550527d8729` | working / unresolved |
| GitHub Direct/web E2E review | Worker 4 | #124 | `audit-round4/review-web-direct-e2e-v1` | `fdc55d684be2cd5053c1e617aa09399fdfcf60c2` | working / unresolved |

No final candidate SHA is recorded until all of the following agree: completed control-plane status, exact branch head, durable issue-comment URL/ID, final SHA, recommendation, empty blockers and all required manifests.

## Test-first evidence

### RED

The initial test was committed before the preparatory package existed:

```text
node --test test/audit-round4-integration-stage0-red.test.mjs
```

The expected failure was module resolution for the missing `packages/audit-integration-round4/src/index.mjs` implementation.

### GREEN

The exact committed production and test Git blobs were reconstructed locally after normal Git/raw transport remained unavailable.

- production blob: `8fd316be7ce2073c7b4290443a7fe5ceee292721`
- test blob: `4a0b5769c9fbe7dd387aab3b7c2670cbf344b527`
- syntax checks: passed
- tests: 8
- passed: 8
- failed: 0

The tests cover:

1. unresolved/frozen candidate slots;
2. exact accepted candidate evidence;
3. stale, incomplete, wrong-branch, wrong-report and missing-manifest rejection;
4. complete preliminary ownership and protected-path inventory;
5. exact/nested overlap and protected mutation rejection;
6. canonical shared-union ordering, field ownership and rerun tests;
7. waiting intake waves and premature-ready rejection;
8. names-only production inputs and writable-RPC/secret-value rejection.

## Preliminary ownership

Domains:

- `phase1-6-integration`
- `phase7-8`
- `api`
- `github-direct`
- `web`

`package.json` is the only currently declared shared file. A future union must bind the exact base blob, sorted owner set, candidate destination blobs, non-overlapping fields, predetermined output blob and required rerun tests. Whole-side conflict resolution is forbidden.

## Protected approved-main blobs

| Path | Blob SHA |
|---|---|
| `.github/workflows/github-native-simulate.yml` | `54e446d4a715ca9678ed4d7434f7ba90b2c67c96` |
| `packages/runner/src/rpc-method-policy.mjs` | `59dfa72f41a697d533720a4d8f939a81aeba6736` |
| `packages/runner/src/fork-rpc-guard.mjs` | `73690f16b506baa50ca471ce5b5566ccb601e765` |
| `packages/runner/src/run-job.mjs` | `e6489c756d43a2f294120ac3c84687030fb919db` |
| `packages/github-native-sim/src/fork-rpc-proxy.mjs` | `4d7e2bd1114f5a37914b26447c9c79a1e40a58e6` |
| `packages/github-native-sim/src/run-job-file.mjs` | `8c4c82d76e249b74efc630c8cbf0d7707d25b5f2` |

Any exact or nested ownership claim touching these paths blocks intake.

## Round 5 preparation

`docs/audit/round4/integration/round5-production-input-v1.json` contains only names and bounded configuration. It does not contain secret values or usable RPC URLs.

The draft requires:

- Cloudflare account/token names;
- client/GPT/GitHub bridge/runner API key names;
- R2 credential names and `AUDIT_R2` binding;
- seven read-only RPC secret names;
- Worker/Pages project/domain/CORS expectations;
- request, spend, artifact and retention caps;
- previous-release preservation and rollback health checks;
- structured correlation/status/duration fields and credential/RPC redactions.

The planned production workflow is a required future input. It was not created or executed during Stage 0.

## Next action

Remain contained until all four Stage A reviewers complete. Then re-fetch all statuses and branches, validate each candidate through `validateCompletedCandidateEvidence`, regenerate the ownership registry from accepted manifests, and publish Checkpoint 1 before any path transplant.
