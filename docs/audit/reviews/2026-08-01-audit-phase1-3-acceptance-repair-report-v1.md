# CurveYield Audit Phase 1–3 Acceptance Repair Report v1

## Determination

**ACCEPT WITH REPAIR**

A-01 through A-04 are repaired on the assigned branch with focused test-first evidence. Full repository, build, dependency-install, and Wrangler dry-run checks remain blocked by the task restrictions and the connector-only runtime; they must run in an approved GitHub Actions review after workflow approval by an administrator. No workflow was triggered or approved by this worker.

## Identity and repository state

- Worker ID: `worker-0-phase1-3-acceptance-repair`
- Runtime/session ID: `0ed888c2dabd`
- Assigned branch: `audit-repair/phases-1-3-acceptance-fixes-v1`
- Unique workspace: `/mnt/data/contract-automation-worker-0-phase1-3-acceptance-repair`
- Starting SHA: `6d26ef2fa73d04acb732e1ed1ab2ef385791f724`
- Final implementation SHA: `1c73659d2cf45cee292209c0be92d19bc312ae4b`
- Start comparison: identical, zero branch drift
- Final comparison: branch is 24 commits ahead and zero commits behind the starting SHA

## Changed files and purpose

1. `apps/audit-api/src/entry.mjs` — applies approved identity aliases before authentication, capabilities, readiness, and upload-grant derivation.
2. `apps/audit-api/src/index.mjs` — removes caller-authored `tenantIndex` and `layerIndex` API fields and forwarding.
3. `apps/audit-api/src/runtime.mjs` — maps approved client/GPT/edge identities with least-privilege scopes and canonical readiness fields.
4. `apps/audit-api/test/phase2.test.mjs` — tests rejection and non-forwarding of caller index snapshots.
5. `apps/audit-api/wrangler.toml` — documents approved persistent secret names only and preserves `AUDIT_EXECUTION_ENABLED=false`.
6. `docs/audit/specifications-v2/05_PHASE_2_R2_WORKSPACES_AND_PROFILE_REGISTRY_v2.md` — specifies server-owned index behavior, ETags, retries, and corrected R2 costs.
7. `docs/audit/specifications-v2/13_R2_FUNCTION_USAGE_AND_FREE_TIER_CAPACITY_v2.md` — updates per-function and aggregate Class B counts.
8. `docs/audit/specifications-v2/14_SECRETS_AND_IDENTITIES_CURRENT_STACK_v2.md` — defines approved identity-to-scope and compatibility mapping.
9. `docs/audit/specifications-v2/16_TESTING_AND_ACCEPTANCE_v2.md` — updates the conservative Class B acceptance budget.
10. `docs/audit/specifications-v2/18_R2_FUNCTION_USAGE_TABLE_v2.csv` — records authoritative index reads for imports and layers.
11. `docs/audit/specifications-v2/20_R2_AGGREGATE_SCENARIOS_v2.csv` — updates aggregate Class B totals.
12. `docs/audit/specifications-v2/MANIFEST_v2.json` — canonical deterministic schema, ordered 22-file inventory, hashes, and byte sizes.
13. `package.json` — adds `audit:test`, `audit:lint`, and `audit:build`; retains compatibility aliases.
14. `packages/audit-workspace-protocol/src/index.mjs` — updates operation budgets for server-owned index reads.
15. `packages/audit-workspaces/src/index.mjs` — reads and merges tenant/layer indexes server-side; initializes empty indexes; rejects stale ETags before immutable writes; preserves entries; supports exact partial retries and idempotent duplicate recovery.
16. `packages/audit-workspaces/test/acceptance-index-ownership-v1.test.mjs` — focused A-03 regressions.
17. `packages/audit-workspaces/test/workspaces.test.mjs` — aligns service contracts and measured operation counts.
18. `scripts/rebuild-audit-spec-manifest.mjs` — exports a deterministic canonical manifest builder with a frozen inventory and inventory-drift rejection.
19. `test/audit-acceptance-fixes-v1.test.mjs` — cross-cutting A-01 through A-04 regressions.
20. `test/audit-infra.test.mjs` — enforces the canonical manifest schema, ordering, hashes, and byte sizes.
21. `test/audit-repair-end-to-end.test.mjs` — removes caller index fixtures and updates measured Class B usage.
22. `test/audit-repair-production-readiness.test.mjs` — tests approved identities and least-privilege readiness/authentication.
23. `test/audit-repair-workspace-sealing.test.mjs` — removes caller tenant snapshots from sealing fixtures.
24. `test/boundary/audit-phase2-boundary.test.mjs` — enforces server-owned indexes and corrected operation budgets.

No CurveYield Lite path and no Worker 1–4 Phase 4–6 path changed.

## A-01 — Canonical specification manifest

Resolved by defining one contract:

- `schemaVersion = curveyield-audit-specification-manifest-v2`;
- package name and integer version are retained;
- exactly 22 explicitly ordered files;
- each entry is `{ file, sha256, bytes }`;
- no generated timestamp, so regeneration is byte-stable;
- unexpected or missing files fail the generator;
- committed hashes and byte sizes were regenerated for all changed specifications.

## A-02 — Approved identities and least privilege

Canonical persistent identities:

- `AUDIT_CLIENT_API_KEY`: read, submit, admin;
- `AUDIT_GPT_API_KEY`: read, submit only;
- `AUDIT_EDGE_CONTROL_PLANE_TOKEN`: internal replay-protected HMAC identity and upload-grant KDF only;
- `AUDIT_ATTESTATION_PRIVATE_KEY`: attestation signing only.

Compatibility aliases are derived in memory. The edge token is not included in public bearer credentials. GPT requests cannot access admin readiness. Wrangler documents approved names without committing values.

## A-03 — Server-owned indexes

- Upload sealing no longer accepts or requires a tenant snapshot.
- GitHub imports read the authoritative tenant index, initialize it when absent, merge previous entries, and conditionally write using the stored ETag.
- Layer attachment does the same for the workspace-layer index.
- Caller-authored `tenantIndex` and `layerIndex` fields are rejected at API and service boundaries.
- A supplied stale `indexEtag` is rejected before immutable object writes.
- Immutable archives, manifests, seals, and event batches are verified byte-for-byte or identity-for-identity on retries.
- Exact retries complete missing index writes and return idempotent results.

Updated normal R2 costs:

- upload sealing: 4 Class A / 2 Class B;
- GitHub import: 4 Class A / 1 Class B;
- layer attachment: 4 Class A / 2 Class B.

## A-04 — Root scripts

Added:

```text
audit:test  = node --test apps/audit-*/test/*.test.mjs packages/audit-*/test/*.test.mjs test/audit-*.test.mjs
audit:lint  = node scripts/check.mjs
audit:build = node scripts/build-audit.mjs
```

`test:audit` and `build:audit` remain compatibility aliases to the canonical scripts.

## Cloudflare production deployment finding

The PR #43 deployment comment was authored by `cloudflare-workers-and-pages[bot]` and explicitly identifies Cloudflare Workers Git integration. The repository Audit workflow ends with `wrangler deploy --dry-run`; it cannot produce a production deployment. The repository production deployment workflow is manual (`workflow_dispatch`) and Lite-only.

The repository-controlled behavior therefore does not require a deployment-code change. A Cloudflare administrator must review the external project:

```text
Cloudflare dashboard → Workers & Pages → contract-automation → Settings → Builds & deployments / Git integration
```

Restrict the production branch to the approved release branch (normally `main`) or disconnect automatic production deployments for Audit and pull-request branches. Also review preview-deployment rules. This worker did not open Cloudflare, deploy, or change the external setting.

## Red evidence

Before implementation:

- A-01: 2 tests, 0 passed, 2 failed — manifest schema/generator contradiction.
- A-02: 3 tests, 0 passed, 3 failed — approved names did not satisfy runtime readiness/authentication.
- A-03: 7 tests, 0 passed, 7 failed — caller snapshots were required/trusted.
- A-04: 1 test, 0 passed, 1 failed — canonical root scripts absent.

## Green evidence

Fresh final permitted commands:

```text
node --test test/a01-manifest-contract.test.mjs test/a02-approved-identities.test.mjs test/a03-server-owned-indexes.test.mjs test/a04-root-audit-scripts.test.mjs packages/audit-workspaces/test/acceptance-index-ownership-v1.test.mjs packages/audit-workspaces/test/workspaces.test.mjs
```

Result: **26 passed, 0 failed**.

```text
node --test --test-name-pattern='manifest generator|approved identities|public Phase 2 schemas|root package|Wrangler documents' test/audit-acceptance-fixes-v1.test.mjs
```

Result: **5 passed, 0 failed**.

Syntax-only checks:

```text
node --check apps/audit-api/src/entry.mjs
node --check apps/audit-api/src/index.mjs
node --check apps/audit-api/src/runtime.mjs
node --check packages/audit-workspaces/src/index.mjs
node --check scripts/rebuild-audit-spec-manifest.mjs
```

Result: all exited 0 with no output.

A combined connector-mirror run reported 31 passes and one `ENOENT` because the isolated mirror intentionally omitted 16 unchanged specification files. The deterministic manifest builder test passed; complete hash verification requires the complete checkout and is listed below as blocked rather than represented as a product failure.

## Blocked checks

Not run because they require a complete checkout, dependency installation/download, compilation/build output, Wrangler, or workflow execution prohibited by this task:

- `npm ci --ignore-scripts --no-audit --no-fund`;
- full `npm test` / `npm run audit:test`;
- `npm run lint` / `npm run audit:lint` across the complete repository;
- `npm run audit:boundary` across all Lite baseline files;
- `npm run audit:build`;
- Wrangler dry run;
- GitHub Actions workflow execution/approval.

## Residual risks

1. Full repository integration remains to be confirmed by an approved CI run from the exact branch head.
2. The external Cloudflare Git integration can continue deploying pull-request commits until an administrator restricts or disconnects it.
3. Legacy runtime alias support remains temporarily available for migration; deployment configuration and readiness use the approved names.

## Security-boundary confirmation

- no dependencies installed or downloaded;
- no compilation or deployment;
- no workflow triggered or approved;
- no production secrets added;
- no AWS;
- no submitted project or external audit tool executed;
- no Lite modification;
- no Phase 4–6 modification;
- `AUDIT_EXECUTION_ENABLED=false` preserved;
- no merge and no phase PR opened.
