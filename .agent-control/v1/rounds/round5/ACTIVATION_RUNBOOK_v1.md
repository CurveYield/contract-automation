# Round 5 Sole-Orchestrator Activation Runbook v1

## Purpose

Prepare the accepted Round 4 candidate for production testing without activating worker runtimes, changing worker-owned records, exposing credentials, merging, deploying, or running live workflows prematurely.

## Authority

The user directed the orchestrator to finish all remaining work alone until production-testing readiness or a hard external block requires account-owner assistance. The former Worker 0–4 Round 5 templates and issues #128–#132 remain historical lane definitions only. They are not consumable assignments and no worker runtime may acknowledge or execute them.

## Accepted source

- Round 4 PR: #139
- exact source SHA: `3da6b10f240e2abd031195f440c7cd80b72b691b`
- frozen base SHA: `bbb4cac794865f84b65ee78a2fc78d391421c759`
- exact-tree attestation SHA-256: `22ee6ee759c027189b9e8887e584c976e378a6de917a20acb0e5275e3a1afc16`
- static verdict: `ACCEPT`
- merge authorization: none

## Static preparation branch

Create `orchestrator/round5-production-test-prep-v1` from exact source SHA `3da6b10f240e2abd031195f440c7cd80b72b691b`.

Do not modify the accepted Round 4 branch. Every Round 5 static preparation change must remain isolated until independently reviewed.

## Required static contracts

Before requesting any account-owner action, commit mutually consistent versioned records for:

1. exact release-SHA and tree-attestation binding;
2. production-test stage plan and acceptance matrix;
3. required GitHub secret names and repository variable names without values;
4. Cloudflare account/zone, Worker, Pages, domain, R2, CORS and lifecycle resource expectations;
5. GitHub workflow source, action-pin, permission, concurrency and environment requirements;
6. seven-network read-only RPC names, chain IDs, allowed-method policy and bounded test expectations without endpoint values;
7. deployment preflight, idempotency and artifact-evidence contract;
8. rollback/redeploy and last-known-good configuration contract;
9. observability, correlation-ID, recursive-redaction and bounded-retention contract;
10. recovery, duplicate-publication reconciliation, partial-publication repair and test-key rotation contract;
11. trusted V27 live-regression exact-SHA/artifact-digest acceptance contract;
12. explicit promotion, credential-name readiness, deployment and live-test authorization gate.

## Static verification

- Use source-only tests and deterministic manifest validation.
- Do not download dependencies or compile locally.
- Naturally triggered secretless pull-request CI may be observed when a PR exists; do not manually dispatch or rerun workflows.
- Bind every result to one exact preparation SHA.
- Any preparation commit invalidates earlier acceptance for that preparation SHA and requires fresh static verification.

## External authorization gates

Static preparation must stop before each action below unless the account owner explicitly authorizes it:

1. promoting or merging PR #139 or the Round 5 preparation branch;
2. confirming required secret and variable names exist in repository/account settings;
3. changing production secrets, variables, DNS, Cloudflare resources, R2 settings, GitHub environments or workflow permissions;
4. dispatching deployment, V27 live-regression or production-test workflows;
5. deploying Worker/Pages/R2/GitHub integrations;
6. executing live API, R2, GitHub, UI or RPC tests.

Secret values must never be read, copied, echoed, logged, screenshotted, committed or posted to issues.

## Failure handling

- A stale SHA, manifest mismatch, missing rollback path, unpinned action, broad token permission, secret-bearing pull-request execution, transaction-capable RPC method, credential leak path or destructive recovery step blocks readiness.
- Any critical identity, tenant-isolation, workflow-trust, credential, RPC-policy, deployment-integrity, rollback or data-loss defect is `REJECT`.
- Preserve the accepted Round 4 candidate unchanged and record the exact failing preparation SHA and minimum repair.

## Completion condition

Round 5 is statically ready for production testing only when all preparation contracts are committed, mutually consistent, independently verified on one exact SHA, and the only remaining steps are explicit account-owner promotion/credential/deployment/live-test gates.
