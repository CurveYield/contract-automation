# Round 5 Production-Test Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one machine-verifiable static production-test readiness package bound to exact accepted Round 4 SHA `3da6b10f240e2abd031195f440c7cd80b72b691b` without merging, deploying, reading secrets, dispatching workflows, or running live tests.

**Architecture:** Store focused versioned JSON contracts in `docs/audit/round5/` and enforce their existence, cross-file source binding, completeness, closed authorization defaults, and secret-free content with one deterministic Node test. Keep all live actions behind explicit account-owner gates.

**Tech Stack:** Markdown, JSON, Node.js built-in test runner, `node:assert`, `node:fs`, `node:path`.

## Global Constraints

- Source branch: `orchestrator/round5-production-test-prep-v1`.
- Exact starting SHA: `3da6b10f240e2abd031195f440c7cd80b72b691b`.
- Do not modify the accepted Round 4 branch.
- Do not download dependencies or compile locally.
- Do not manually dispatch or rerun GitHub workflows.
- Do not read, copy, echo or commit secret values or endpoint URLs.
- Do not merge, deploy, sign, broadcast transactions, modify CurveYield Lite or perform AWS work.
- Every created file uses a `v1` version suffix.

---

### Task 1: RED readiness contract

**Files:**
- Create: `test/audit-round5-production-readiness-v1.test.mjs`

**Interfaces:**
- Consumes: accepted source constants and issue #125 requirements embedded as exact test constants.
- Produces: deterministic failure listing absent Round 5 manifest paths.

- [ ] **Step 1: Write the failing test**

Create constants for all nine required JSON manifests and `README_v1.md`. Assert every path exists before parsing. Include exact accepted SHA, attestation digest, required secret names, required variable names, supported networks and expected domains as immutable test constants.

- [ ] **Step 2: Observe RED through natural PR CI**

Open a draft PR from the preparation branch to `orchestrator/round4-final-integration-takeover-v1`. Do not manually dispatch or rerun. Expected result: existing tests remain green and only the new readiness test fails because the manifest set is absent.

- [ ] **Step 3: Record exact RED evidence**

Capture the preparation SHA, naturally triggered run IDs, first failing assertion and unaffected test count without downloading artifacts or exposing secrets.

- [ ] **Step 4: Commit**

Commit message: `test: require Round 5 production readiness manifests v1`.

### Task 2: Exact release-source binding

**Files:**
- Create: `docs/audit/round5/release-source-binding-v1.json`
- Create: `docs/audit/round5/README_v1.md`

**Interfaces:**
- Produces `releaseBindingId: "round5-release-source-3da6b10-v1"` consumed by every later manifest.

- [ ] **Step 1: Add exact immutable source evidence**

Record PR #139, base/head branches and SHAs, merge ref, 202 changed paths, 198 attested paths, tree digest, final CI run IDs, test counts, draft state and no-merge authorization.

- [ ] **Step 2: Add operator ordering**

Document static preparation order, cross-file binding rule, closed authorization defaults and prohibition on interpreting readiness as merge/deployment authority.

- [ ] **Step 3: Run the focused test**

Expected result: failure advances from missing release binding to the next absent manifest.

- [ ] **Step 4: Commit**

Commit message: `evidence: bind Round 5 preparation to accepted source v1`.

### Task 3: Credential-name and resource contracts

**Files:**
- Create: `docs/audit/round5/secret-variable-binding-manifest-v1.json`
- Create: `docs/audit/round5/production-resource-manifest-v1.json`

**Interfaces:**
- Both consume `releaseBindingId`.
- Secret manifest produces exact required names and expected purpose/scope metadata without values.
- Resource manifest produces exact Cloudflare, Pages, R2, GitHub, domain and RPC expectations.

- [ ] **Step 1: Encode required secret names**

Include the 15 names from issue #125 exactly. Mark every entry `valueRecorded: false`, `presenceConfirmed: false`, and assign a bounded purpose.

- [ ] **Step 2: Encode required repository variable names**

Include `PREFLIGHTSIM_API_URL`, `PAGES_PROJECT_NAME`, and `PREFLIGHTSIM_ALLOWED_GITHUB_USERS`, all unconfirmed and without values.

- [ ] **Step 3: Encode resource expectations**

Record zone `curveyield.online`, API domain `api.preflight.curveyield.online`, Pages project `curveyield-preflight`, Pages domain `preflight.curveyield.online`, R2 bucket `curveyield-preflight`, exact CORS origin, lifecycle requirement, GitHub issue-label/workflow expectations and all seven network names/chain IDs.

- [ ] **Step 4: Validate secret-free content**

The test scans serialized JSON for private-key markers, seed phrases, bearer tokens, raw RPC URLs, credential-like assignments and non-empty `value` properties.

- [ ] **Step 5: Commit**

Commit message: `evidence: define Round 5 credential names and resources v1`.

### Task 4: Production stage and deployment contracts

**Files:**
- Create: `docs/audit/round5/production-test-manifest-v1.json`
- Create: `docs/audit/round5/deployment-preflight-manifest-v1.json`

**Interfaces:**
- Production test manifest defines eight ordered stage IDs and their prerequisites/evidence/reject conditions.
- Deployment manifest defines trusted source, action pins, permissions, environment, concurrency, idempotency and artifact evidence.

- [ ] **Step 1: Encode all eight issue #125 stages**

Use IDs `configuration-preflight`, `deployment`, `live-api-auth-gpt`, `live-r2`, `live-github-direct`, `live-read-only-rpc`, `web-operator`, and `observability-recovery`. Each stage must have non-empty prerequisites, checks, evidence and rejection conditions.

- [ ] **Step 2: Gate live stages on deployment checkpoint**

Stages 3–7 require `verifiedDeploymentCheckpoint: true`; stage 8 requires the same exact deployed SHA/configuration digest.

- [ ] **Step 3: Encode trusted deployment requirements**

Require exact source SHA, protected/trusted event, immutable action pins, least privilege, no PR-controlled secrets, bounded concurrency, artifact IDs/digests, domain/resource verification and idempotent rerun evidence.

- [ ] **Step 4: Run focused validation**

Expected result: only rollback/observability/V27/authorization manifests remain absent.

- [ ] **Step 5: Commit**

Commit message: `evidence: define Round 5 stages and deployment preflight v1`.

### Task 5: Rollback, observability and recovery contracts

**Files:**
- Create: `docs/audit/round5/rollback-recovery-manifest-v1.json`
- Create: `docs/audit/round5/observability-redaction-manifest-v1.json`

**Interfaces:**
- Rollback manifest produces last-known-good, rollback, redeploy, partial-publication recovery, duplicate reconciliation and test-key rotation requirements.
- Observability manifest produces structured logging, correlation, redaction, retention and prohibited-output requirements.

- [ ] **Step 1: Encode reversible operations**

Require last-known-good SHA/config digest, pre-change snapshot, bounded test data, rollback command/workflow identity, post-rollback verification and no destructive test against irreplaceable data.

- [ ] **Step 2: Encode recovery drills**

Require R2 partial-publication repair, GitHub duplicate publication reconciliation, idempotent deployment rerun and rotation of one non-production application key with old-key rejection/new-key success.

- [ ] **Step 3: Encode observability**

Require structured events, correlation IDs, stage/run/SHA/resource identifiers, classified errors, recursive redaction, bounded retention and explicit prohibition of secrets, raw RPC URLs, host paths, stack traces and submitted source.

- [ ] **Step 4: Commit**

Commit message: `evidence: define Round 5 rollback observability recovery v1`.

### Task 6: Trusted V27 and authorization gates

**Files:**
- Create: `docs/audit/round5/trusted-v27-live-regression-contract-v1.json`
- Create: `docs/audit/round5/production-authorization-gate-v1.json`

**Interfaces:**
- V27 contract defines the required trusted run and artifact evidence.
- Authorization gate defines four independent externally controlled gates, all closed by default.

- [ ] **Step 1: Encode trusted V27 dispatch prerequisites**

Require promoted exact SHA, trusted workflow source, explicit account-owner authorization, secret-name readiness, no PR event, immutable actions and read-only RPC policy.

- [ ] **Step 2: Encode V27 acceptance evidence**

Require run ID, exact SHA, artifact ID/name/digest, downloaded digest match, fork identity, zero public broadcasts, full assertion counts, RPC failure/retry/quarantine counts and redaction checks.

- [ ] **Step 3: Encode closed authorization gates**

Define `promotion`, `credentialNameReadiness`, `deployment`, and `liveProductionTesting`, each with `authorized: false`, required evidence and authorizer `account-owner`.

- [ ] **Step 4: Run focused test**

Expected result: all manifest existence and consistency assertions pass.

- [ ] **Step 5: Commit**

Commit message: `evidence: gate Round 5 V27 and production authorization v1`.

### Task 7: Full exact-head verification and handoff

**Files:**
- Modify only if evidence requires correction: files created in Tasks 1–6.
- Create: `docs/audit/round5/production-test-static-readiness-receipt-v1.json`
- Extend test manifest list to include the receipt only after its non-self-referential inputs are stable.

**Interfaces:**
- Receipt binds one exact preparation SHA to the complete static package and naturally triggered CI.

- [ ] **Step 1: Observe natural draft-PR CI**

Do not dispatch or rerun. Require full repository tests, lint/build and syntax gates to pass on one exact preparation SHA.

- [ ] **Step 2: Add readiness receipt**

Record exact preparation head, draft PR, base SHA, run IDs, test counts, manifest paths/blob SHAs, residual warnings, and external gates. Mark `productionTestingReady: true` only when all static gates pass; keep every live authorization false.

- [ ] **Step 3: Re-run naturally through the receipt commit**

Observe naturally triggered CI on the receipt head. A changed preparation SHA invalidates the earlier result.

- [ ] **Step 4: Publish durable control evidence**

Update issue #125, issue #63, the control-plane queue/status/global state and newest handoff snapshot. Do not modify worker-owned ACK/STATUS files.

- [ ] **Step 5: Stop at the hard external gate**

Report the exact accepted preparation SHA and the first required account-owner action. Do not merge, access settings, change secrets, deploy or run live tests without explicit authorization.
