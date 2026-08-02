# Round 4 Full-Platform Integration — Stage 0 Review v1

## Scope and containment

Worker 2 sequence 8 is limited to Stage 0 preparation on branch `audit-round4/full-platform-integration-v1`, starting from exact SHA `5914b03382422ea714346625a601b5dbda3aa0cd`.

No Stage A candidate has completed. No Phase 1–8, API, GitHub Direct, web, workflow, shared-file or simulation-addon production path has been transplanted.

Draft PR #126 is a separate active live-fork/simulation workstream. Its 20 changed paths are quarantined from this assignment. No Stage 0 or later intake may modify, restore, union, cherry-pick or overwrite those paths until James declares the PR complete, the exact final head is independently reviewed and an explicit integration authorization replaces the quarantine event.

## Delivered package

Package: `packages/audit-integration-round4`

Exports from the main entrypoint:

- unresolved Stage A candidate slots;
- completed-status/branch-head/report/manifest validation;
- preliminary ownership and protected approved-main blob registries;
- shared-file union validation;
- waiting intake-wave templates;
- names-only Round 5 production-input validation.

Additional quarantine entrypoint: `@curveyield/audit-integration-round4/quarantine`

- `ROUND4_EXTERNAL_QUARANTINE` pins PR #126, base `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`, current head `bc3b94c5a48192f5c1cc6e167794a5460ac661ec`, draft state and all 20 changed paths;
- `ROUND4_STAGE0_OWNERSHIP` combines preliminary ownership, approved-main protected paths and external quarantine;
- `validateStage0PathOwnershipRegistry()` rejects exact or nested claims touching quarantined paths.

Both production modules are dependency-free, in-memory validation only and import no filesystem, process, network, VM, credential, wallet, signing, transaction, deployment or workflow capability.

## Candidate state

| Candidate | Worker | Issue | State | Final SHA |
|---|---|---:|---|---|
| Phase 1–6 + integration | Worker 0 | #120 | working | null |
| Phase 7–8 | Worker 1 | #121 | working | null |
| API/auth | Worker 3 | #123 | working | null |
| GitHub Direct/web | Worker 4 | #124 | working | null |

Candidate intake requires completed status, null active sequence/message, exact slot identity, exact branch head, final report URL/comment ID/SHA/recommendation, empty blockers and all required manifest schemas.

## RED / GREEN evidence

RED was committed before the package existed. The initial test failed at module resolution.

Final quarantine-aware exact-blob verification:

- main production blob: `8fd316be7ce2073c7b4290443a7fe5ceee292721`
- quarantine production blob: `b233bfcad4bdb3be560874b354fc5d4abd101ef3`
- test blob: `5a517622217da9d336347c26b43a180d1da870c6`
- syntax checks: passed
- tests: 9
- passed: 9
- failed: 0

Coverage:

1. unresolved frozen candidate slots;
2. exact completed evidence;
3. stale/malformed/wrong-branch/wrong-report/missing-manifest rejection;
4. exact active PR #126 metadata and 20-path quarantine;
5. ownership/protected/quarantine inventory;
6. overlap, protected mutation and quarantined mutation rejection;
7. canonical shared unions and field ownership;
8. waiting waves and premature-ready rejection;
9. names-only production inputs and writable-RPC/secret-value rejection.

## Protected approved-main blobs

- `.github/workflows/github-native-simulate.yml` — `54e446d4a715ca9678ed4d7434f7ba90b2c67c96`
- `packages/runner/src/rpc-method-policy.mjs` — `59dfa72f41a697d533720a4d8f939a81aeba6736`
- `packages/runner/src/fork-rpc-guard.mjs` — `73690f16b506baa50ca471ce5b5566ccb601e765`
- `packages/runner/src/run-job.mjs` — `e6489c756d43a2f294120ac3c84687030fb919db`
- `packages/github-native-sim/src/fork-rpc-proxy.mjs` — `4d7e2bd1114f5a37914b26447c9c79a1e40a58e6`
- `packages/github-native-sim/src/run-job-file.mjs` — `8c4c82d76e249b74efc630c8cbf0d7707d25b5f2`

PR #126 currently changes two of those protected paths (`run-job.mjs` and `run-job-file.mjs`); its quarantine supersedes any restoration or verification action until independent review is authorized.

## Round 5 preparation

The names-only production input records Cloudflare/GitHub/R2/RPC secret and variable names, Worker/Pages/domain/CORS/R2 binding names, seven read-only RPC networks, bounded request/spend/artifact/retention caps, rollback checks and observability/redaction fields.

No secret value, RPC URL, deployment workflow, workflow run, RPC request, wallet, signature or transaction was created or executed.

## Next action

Remain contained until issues #120, #121, #123 and #124 complete and PR #126 is released from quarantine. Then re-fetch exact statuses, reports, branches, manifests and PR state; validate all inputs; regenerate ownership/protected/quarantine baselines; and post Checkpoint 1 before any path transplant.
