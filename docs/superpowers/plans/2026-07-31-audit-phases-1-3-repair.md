# Audit Phases 1–3 Integration Repair Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the completed Phase 1–3 Audit control-plane implementation so the live integrated workflow is internally consistent, deployable on the approved GitHub + Cloudflare/R2 stack, accurately represented by its specifications, and independently verified before Phase 4 resumes.

**Architecture:** All repair work is orchestrator-owned on `audit-repair/phases-1-3-v1`. Tests are written first, then minimal production changes are made. No submitted project execution is introduced. After the repair branch passes the full suite, changes are split/backported into a clean Phase 1 → Phase 2 → Phase 3 branch chain so each phase retains one consolidated submission.

**Tech Stack:** Node.js 22 ESM, Cloudflare Workers, Cloudflare R2 Standard, GitHub Actions, Web Crypto, dependency-free application modules unless a reviewed pinned dependency is necessary.

## Global Constraints

- AWS infrastructure and every unselected provider remain outside scope.
- `AUDIT_EXECUTION_ENABLED=false` remains mandatory.
- No submitted source execution, shell commands, arbitrary URLs/RPCs, keys, wallets, signing, broadcasting, custom images, privileged mode, package hooks, or ListObjects hot paths.
- Existing Lite runtime, UI, workflows, runner, protocol, secrets, bucket, and lifecycle remain unchanged.
- One orchestrator-owned integration result per phase; workstream branches are not phase submissions.
- Every behavior change requires a failing regression test first.
- R2 Class A/Class B quotes and free-tier calculations must be updated whenever an operation path changes.

---

### Task 1: Configuration truth, secret alignment, and reproducible CI

**Files:**
- Modify: `.github/workflows/audit-test.yml`
- Modify: `.github/workflows/audit-deploy-dry-run.yml`
- Create: `package-lock.json`
- Modify: `apps/audit-api/src/index.mjs`
- Modify: `apps/audit-api/src/phase3.mjs`
- Modify: `apps/audit-api/wrangler.toml`
- Modify: `docs/audit/specifications-v2/14_SECRETS_AND_IDENTITIES_CURRENT_STACK_v2.md`
- Test: `test/audit-infra.test.mjs`
- Test: `test/boundary/audit-boundary.test.mjs`

**Interfaces:**
- Consumes approved secrets: `AUDIT_CLIENT_API_KEY`, `AUDIT_GPT_API_KEY`, `AUDIT_EDGE_CONTROL_PLANE_TOKEN`, Cloudflare/R2 credentials, and the single GitHub App master key.
- Produces scoped runtime identities without adding undocumented persistent secrets.

- [ ] Write failing tests proving CI uses a committed lockfile with `npm ci --ignore-scripts`, Actions are commit-pinned, and every runtime secret name is present in the approved secret specification.
- [ ] Run the focused tests and verify the expected failures.
- [ ] Align runtime credential mapping: client key receives read/submit/admin for the human-operated UI, GPT key receives read/submit, and the edge-control token authenticates internal control-plane calls.
- [ ] Derive upload-grant signing material from the edge-control token with a versioned WebCrypto KDF rather than requiring another persistent secret.
- [ ] Generate and commit the lockfile from the exact existing dependency set; switch both Audit workflows to `npm ci --ignore-scripts --no-audit --no-fund`.
- [ ] Pin GitHub Actions to immutable commit SHAs and include `package-lock.json` in workflow path filters.
- [ ] Run focused tests and the complete repository suite.

### Task 2: R2 key lifecycle, CORS, and retention truth

**Files:**
- Modify: `infra/audit-cloudflare/r2-lifecycle.json`
- Modify: `infra/audit-cloudflare/r2-cors.json`
- Modify: `docs/audit/specifications-v2/05_PHASE_2_R2_WORKSPACES_AND_PROFILE_REGISTRY_v2.md`
- Modify: `docs/audit/specifications-v2/06_PHASE_3_R2_CAMPAIGNS_JOBS_LOGS_EVIDENCE_v2.md`
- Modify: `docs/audit/specifications-v2/12_R2_OBJECT_MODEL_AND_OPERATION_RULES_v2.md`
- Test: `test/audit-infra.test.mjs`
- Test: `test/boundary/audit-phase2-boundary.test.mjs`
- Test: `test/boundary/audit-phase3-boundary.test.mjs`

**Interfaces:**
- Consumes the deterministic key functions from workspace, profile, campaign, and evidence packages.
- Produces lifecycle rules whose prefixes actually match stored keys and browser CORS that permits signed PUT uploads.

- [ ] Write failing tests mapping every current object family to exactly one intended lifecycle rule and proving the R2 CORS policy permits `PUT`, `GET`, and `HEAD` only from the Audit origin.
- [ ] Run tests and verify failures against the current `audit/...` prefix mismatch and missing PUT method.
- [ ] Replace lifecycle prefixes with the actual key families used by code.
- [ ] Restrict Phase 1–3 runtime retention to the implemented `free-development` policy; reject or clearly feature-gate 90/365-day policies until retention-class keying exists.
- [ ] Add lifecycle assertions preventing profile metadata and immutable revocation history from being accidentally expired with workspace/job data.
- [ ] Run focused tests and update the R2 usage assumptions if retention changed.

### Task 3: Workspace ingestion safety and durable sealing

**Files:**
- Modify: `packages/audit-workspace-protocol/src/index.mjs`
- Modify: `packages/audit-workspaces/src/index.mjs`
- Modify: `apps/audit-api/src/index.mjs`
- Modify: `packages/audit-workspaces/test/workspaces.test.mjs`
- Modify: `apps/audit-api/test/phase2.test.mjs`

**Interfaces:**
- `createUploadGrant(request, options)` returns a grant with a maximum approved lifetime.
- `WorkspaceService.sealUploadedWorkspace(input)` reads server-owned indexes, copies the verified ingress bundle to durable workspace storage, and remains idempotent after partial writes.
- `WorkspaceService.importGitHubWorkspace(input)` and `attachLayer(input)` update server-owned indexes with ETag protection.

- [ ] Write failing tests for: grant expiration beyond the approved maximum; ZIP bombs/unsupported compression/symlink entries/local-header mismatch; sealing from an empty store; preserving earlier index entries; partial-write retry; and durable source availability after ingress expiry.
- [ ] Verify the tests fail for the current implementation.
- [ ] Add explicit compressed/uncompressed/file-count/path/symlink/compression-method limits and validate local ZIP headers without extracting files.
- [ ] Read and update tenant/workspace indexes inside the service; stop accepting caller-authored full index snapshots.
- [ ] Copy the verified upload from `ingress/` to `workspaces/{workspaceId}/source-v1.zip` before sealing so one-day ingress expiry cannot delete a sealed workspace.
- [ ] Make multi-object operations retry-safe by detecting matching immutable objects and completing missing writes/index updates rather than returning early.
- [ ] Update API request schemas to accept only IDs and ETags needed for concurrency, not entire mutable indexes.
- [ ] Run focused tests and update exact R2 operation budgets.

### Task 4: Profile registry consistency and publication idempotency

**Files:**
- Modify: `packages/audit-profile-registry/src/index.mjs`
- Modify: `packages/audit-profile-registry/test/profile-registry.test.mjs`
- Modify: `packages/audit-campaigns/src/index.mjs`

**Interfaces:**
- `ProfileRegistry.publish(bundle)` reads the current deterministic index itself, preserves all existing entries, and safely retries partial publication.
- Profile reads and job admission rely on the same immutable profile identity and revocation state.

- [ ] Write failing tests proving a caller cannot drop an existing profile from the index and a retry after three immutable writes plus an index conflict completes successfully.
- [ ] Verify red tests.
- [ ] Remove caller-supplied profile-index snapshots; read current index, merge server-side, and use its ETag or create-only condition.
- [ ] Verify existing manifest/SBOM/attestation references are byte-identical on retry before treating publication as idempotent.
- [ ] Run package and full tests; update operation budgets.

### Task 5: Campaign/job initialization and server-owned state transitions

**Files:**
- Modify: `packages/audit-campaign-protocol/src/index.mjs`
- Modify: `packages/audit-campaigns/src/index.mjs`
- Modify: `apps/audit-api/src/phase3.mjs`
- Modify: `packages/audit-campaigns/test/campaigns.test.mjs`
- Modify: `apps/audit-api/test/phase3.test.mjs`

**Interfaces:**
- Campaign and job indexes are created from an empty store and updated by the service.
- Heartbeats/completion accept minimal transition inputs; the service reads current status, validates identity/revision/attempt/log monotonicity, and produces the next status.

- [ ] Write failing tests for the complete empty-store sequence: sealed workspace → first campaign → first job, with no manually seeded campaign/job indexes.
- [ ] Write failing tests proving caller-supplied status/index data cannot change campaign identity, roll revisions backwards, reduce highest log sequence, or skip invalid transitions.
- [ ] Verify red tests.
- [ ] Treat missing deterministic indexes as empty create-only indexes while preserving ETag conflict protection.
- [ ] Remove full caller-supplied indexes from public campaign/job APIs.
- [ ] Replace caller-supplied heartbeat/current-status records with minimal patches and server-side status reads/transition construction.
- [ ] Enforce idempotency-key uniqueness within a campaign through the deterministic job index.
- [ ] Remove or normalize the obsolete Phase 1 `/audit/v1/jobs` POST schema so it cannot contradict slug-based Phase 3 profile IDs.
- [ ] Run focused and full tests; update R2 operation budgets.

### Task 6: Logs, artifact transport, evidence attestation, and report consistency

**Files:**
- Modify: `packages/audit-evidence/src/index.mjs`
- Modify: `packages/audit-evidence/test/evidence.test.mjs`
- Modify: `apps/audit-api/src/phase3.mjs`
- Modify: `apps/audit-api/test/phase3.test.mjs`
- Modify: `docs/audit/specifications-v2/15_EXTERNAL_HARDENED_COMPUTE_DEFERRED_INTERFACE_v2.md`

**Interfaces:**
- Log append validates current job/attempt and monotonically commits sequence/status.
- Large bundles use short-lived object grants/references instead of base64 Worker bodies.
- Evidence attestations are generated or cryptographically verified by the control plane, never trusted as unsigned caller metadata.

- [ ] Write failing tests for out-of-order/orphan log chunks, JSON-safe log retrieval, >1 MiB artifact/evidence/report ingestion by object reference, caller-forged attestations, and report-index clobbering.
- [ ] Verify red tests.
- [ ] Make log append read current status, enforce `sequence = highest + 1`, write the chunk, and ETag-update status; return logs as bounded UTF-8 text or explicit encoded chunks.
- [ ] Add deterministic ingress keys and short-lived upload/read grants for raw artifacts, evidence, and reports; internal callbacks submit object references and digests, not base64 payloads.
- [ ] Sign evidence attestations using the approved current-stack attestation key or verify a versioned signature produced by the approved service signer.
- [ ] Read/merge report indexes server-side and make publication retry-safe.
- [ ] Keep untrusted execution disabled and preserve quarantine-before-acceptance.
- [ ] Run focused and full tests; update operation budgets and storage scenarios.

### Task 7: Production integration readiness and honest capabilities

**Files:**
- Modify: `apps/audit-api/src/index.mjs`
- Modify: `apps/audit-api/src/phase3.mjs`
- Modify: `apps/audit-api/wrangler.toml`
- Modify: `apps/audit-api/test/api.test.mjs`
- Modify: `apps/audit-api/test/phase2.test.mjs`
- Modify: `apps/audit-api/test/phase3.test.mjs`

**Interfaces:**
- Health remains public.
- Readiness reports booleans for every required binding/integration without exposing values.
- Capabilities distinguish implemented storage/schema features from currently operational external integration paths.

- [ ] Write failing tests showing readiness is false when control storage, R2 signing credentials, GitHub App identity, or required fixture validators are unavailable.
- [ ] Verify red tests.
- [ ] Implement the Cloudflare-R2 presigned URL signer using reviewed R2 S3-compatible SigV4 code and the approved R2 credentials; do not add an AWS service dependency.
- [ ] Feature-gate GitHub import until the GitHub App archive resolver is fully implemented and tested; do not advertise it operational merely because a test-injected function exists.
- [ ] Feature-gate evidence fixture ingestion when no attestation/validation integration exists.
- [ ] Ensure capabilities and readiness never claim an unavailable route is operational.
- [ ] Run API and full tests plus Wrangler dry run.

### Task 8: Integrated acceptance, R2 quotes, and phase-chain reconstruction

**Files:**
- Create: `test/audit-phase1-3-integration.test.mjs`
- Modify: `scripts/check-audit-boundary.mjs`
- Modify: `test/audit-infra.test.mjs`
- Modify: `test/boundary/audit-phase2-boundary.test.mjs`
- Modify: `test/boundary/audit-phase3-boundary.test.mjs`
- Modify: `docs/audit/specifications-v2/13_R2_FUNCTION_USAGE_AND_FREE_TIER_CAPACITY_v2.md`
- Modify: `docs/audit/specifications-v2/18_R2_FUNCTION_USAGE_TABLE_v2.csv`
- Modify: `docs/audit/specifications-v2/19_R2_USAGE_ASSUMPTIONS_v2.json`
- Modify: `docs/audit/specifications-v2/20_R2_AGGREGATE_SCENARIOS_v2.csv`
- Modify: `docs/audit/specifications-v2/MANIFEST_v2.json`

**Interfaces:**
- Produces one fresh verification record for the complete Phase 1–3 tree.
- Produces corrected per-function and aggregate R2 free-tier estimates.

- [ ] Add an end-to-end in-memory test beginning with no Audit objects and completing upload grant, upload, seal, profile publication, campaign creation, job submission, fixture attempt, logs, evidence, report, and terminal state without manual index seeding.
- [ ] Add negative tests for tenant crossover, stale ETags, lifecycle-prefix drift, unavailable integrations, and every repaired partial-write scenario.
- [ ] Extend the standalone boundary checker to enforce actual lifecycle/key agreement, CORS PUT support, documented secret names, lockfile CI, server-owned indexes, server-read status transitions, and no base64 large-bundle routes.
- [ ] Recalculate every changed R2 operation path and the complete-stack free-tier scenarios.
- [ ] Regenerate the specification manifest hashes.
- [ ] Run fresh: `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, `npm run lint`, `npm run audit:boundary`, `npm run build:audit`, and `npm run dry-run:audit` in GitHub Actions.
- [ ] Review the complete live diff against `audit-phase3/integration-v2`.
- [ ] Reconstruct and verify a clean Phase 1 → Phase 2 → Phase 3 branch chain, update the existing single draft PR for each phase, and close obsolete workstream PRs.
