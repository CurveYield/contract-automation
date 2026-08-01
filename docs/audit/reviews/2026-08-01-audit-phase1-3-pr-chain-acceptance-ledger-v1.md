# Phase 1–3 PR Chain Acceptance Ledger v1

## Status

**BLOCKED — exact replacement commits are ready, but the external Cloudflare Git integration is still deploying draft PR branch heads to production.**

No branch ref or PR head has been moved. The three exact replacement commits exist as detached Git objects and can be published immediately after the external integration is restricted to the approved release branch or disconnected.

## Assignment

- Worker: `worker-0`
- Issue: `#70`
- Mailbox sequence: `1`
- Assigned ledger branch: `audit-repair/phases-1-3-pr-chain-v1`
- Starting SHA: `4a236915ed14920e77603af1c49e3d370f0b2200`
- Accepted issue #51 repair head: `4a236915ed14920e77603af1c49e3d370f0b2200`
- Current `main`: `2d80c92551fd9547798cdab1c6a91359be0af221`

## Existing published chain

| PR | Base branch | Existing head branch | Existing head SHA |
|---|---|---|---|
| #13 | `main` | `audit-phase1/integration-v2` | `7287320c318c7237cb55040519d04f4d1b2889c3` |
| #24 | `audit-phase1/integration-v2` | `audit-phase2/integration-v2` | `2e7f59ab43164f61c42c64a1ecf8cfb5f124ab4f` |
| #35 | `audit-phase2/integration-v2` | `audit-phase3/integration-v2` | `eea324abc11cce640005cdd83ef1822698e0b9d1` |

PR #13's old merge base is `922d86d6a229523163ae0a7d49f1908e3ec483b4`. Current `main` is 11 commits newer, but those commits have no net tree delta against that old base. The replacement Phase-1 commit therefore preserves current-main history without introducing unrelated content into the PR diff.

## Exact detached replacement chain v2

| Layer | Tree SHA | Detached commit SHA | First parent | Preserved-history second parent | Exact diff paths |
|---|---|---|---|---|---:|
| Phase 1 | `0ed911af0612f78126ffb1cba334e89b638c7f77` | `67a898da0b1c222481253abcc70fdf3bc3d428ce` | current `main` `2d80c925...` | old Phase-1 head `7287320c...` | 56 |
| Phase 2 | `aeb297a984df3f804f8538fa3b0026d5d78ec13b` | `d95319c027995d4ba53afb88e6d17fe262a2e585` | replacement Phase 1 | old Phase-2 head `2e7f59ab...` | 26 |
| Phase 3 | `35eb2268131a058d89cfcf50ce7d09555d73b957` | `680a667f8f3e76f1aa78014d55cecbc8b3e64266` | replacement Phase 2 | old Phase-3 head `eea324ab...` | 30 |

The merge-style parent strategy preserves every old phase branch as ancestry while establishing a clean current-main-based first-parent chain.

## Accepted-tree equivalence proof

Verification commit `8a1c758425d5bb7493661cf1c38a9887bb54e027` uses the replacement Phase-3 tree with accepted issue #51 SHA `4a236915...` as its parent. Its exact comparison contains only four paths:

1. remove temporary repair workflow `.github/workflows/audit-repair-spec-manifest.yml`;
2. remove historical issue #51 report `docs/audit/reviews/2026-08-01-audit-phase1-3-acceptance-repair-report-v1.md`;
3. remove historical repair plan `docs/superpowers/plans/2026-07-31-audit-phases-1-3-repair.md`;
4. add Phase-1-local regression `test/audit-phase1-acceptance-contract-v1.test.mjs`.

Therefore every accepted runtime, specification, infrastructure, and integration file from `4a236915...` is present unchanged in the cumulative replacement tree, except for the three intentional non-runtime omissions. The one extra file is a phase-local non-executing Node test.

## Test ownership correction

The original cross-cutting file `test/audit-acceptance-fixes-v1.test.mjs` imports `apps/audit-api/src/runtime.mjs` at module load. Runtime is introduced in Phase 3, so placing that test in Phase 1 made the Phase-1 exact head untestable.

Correct ownership:

- Phase 1 adds `test/audit-phase1-acceptance-contract-v1.test.mjs`, covering canonical manifest identity and hashes, deterministic generator and inventory drift, required root Audit scripts, approved persistent identity names, and `AUDIT_EXECUTION_ENABLED=false`.
- Phase 2 inherits the Phase-1 test and adds workspace/index tests.
- Phase 3 adds the original six-test cross-phase contract, after runtime exists.

## Phase ownership matrix

### Phase 1 / shared root

Phase 1 owns the existing Phase-1 scaffold plus:

- the two permanent Audit workflows;
- approved-secret documentation in `apps/audit-api/wrangler.toml`, without the Phase-2 control-store binding;
- the complete `docs/audit/specifications-v2/` package and canonical manifest;
- `package-lock.json` and root Audit scripts;
- deterministic manifest generator;
- infrastructure, reproducible-CI, and Phase-1 acceptance tests.

The specification package is atomic Phase-1/shared-root ownership because the manifest hashes all 22 specification files as one deterministic inventory.

### Phase 2

Phase 2 owns its API/web/workspace/profile feature diff plus server-owned tenant/layer indexes, caller snapshot rejection, stale-ETag and retry-idempotency behavior, upload-grant derivation, R2 CORS, Phase-2 boundary tests, only Phase-2 API hunks, and the `AUDIT_CONTROL_STORE` binding.

### Phase 3

Phase 3 owns campaigns/evidence/API/web integration, canonical runtime identity mapping, final R2 lifecycle, reports and retention, state-integrity and production-readiness tests, the cross-phase A-01–A-04 test, and Phase-3 boundary tests.

## Exact shared-file rules

### `apps/audit-api/wrangler.toml`

Phase 1 documents the approved names and keeps `AUDIT_EXECUTION_ENABLED = "false"`. Phase 2 adds `AUDIT_CONTROL_STORE`. No secret values are committed.

### `apps/audit-api/src/index.mjs`

The Phase-2 version excludes and never forwards `tenantIndex` or `layerIndex`; only optional `indexEtag` is accepted for concurrency control. No Phase-3 route content is copied backward.

### `apps/audit-api/src/entry.mjs` and `runtime.mjs`

The accepted complete files belong to Phase 3. Client maps to read/submit/admin, GPT maps to read/submit, edge control is internal/KDF only, and attestation is signing-only. Execution remains disabled.

## Verification evidence

### Fresh Phase-1 focused verification

Connector-backed exact files were materialized without dependency installation.

Commands:

- `node --check test/audit-phase1-acceptance-contract-v1.test.mjs`
- `node --check scripts/rebuild-audit-spec-manifest.mjs`
- `node --test --test-name-pattern='manifest generator|root Audit script|approved persistent identities' test/audit-phase1-acceptance-contract-v1.test.mjs`

Result: syntax checks exit `0`; `3 passed, 0 failed`.

The 22-file committed hash walk was not rerun locally because Git transport cannot resolve GitHub and the connector mirror does not materialize the full specification directory. Those spec/manifest blobs are copied unchanged from accepted `4a236915...`; the generator fixture passed freshly.

### Fresh Phase-3 runtime verification

Commands:

- `node --check apps/audit-api/src/runtime.mjs`
- `node --check test/runtime-identities-v1.test.mjs`
- `node --test test/runtime-identities-v1.test.mjs`

Result: syntax checks exit `0`; `2 passed, 0 failed`.

Approved aliases, core readiness, production callback sanitization, and `executionEnabled=false` were verified.

### Phase-2 behavioral evidence transfer

Replacement Phase-2 exact blobs:

- API route source: `586d2863754764a18f478b5144283285dc53691b`;
- workspace service: `708b71ba217d334117f55510e055e8e91669fa31`;
- seven-test acceptance file: `75d372bc0c3823c133eeccc0775bf190a05532e4`;
- workspace protocol: `104ca5528f367536a2c1fd87dc60fed601e98a6f`;
- R2 store: `8393645bb56bef92fcd7745f970763ca850b1632`.

These are byte-identical to the accepted issue #51 head where the seven workspace tests passed. Phase 3's shared-protocol patch only changes the job prefix and adds artifact/snapshot/profile support; it does not alter the tenant/workspace/layer ID, validation, forbidden-field, or budget functions used by Phase 2. Fresh route inspection confirms no caller tenant/layer snapshots.

### Exact comparisons

- current `main` → Phase 1: 56 paths;
- Phase 1 → Phase 2: 26 paths;
- Phase 2 → Phase 3: 30 paths;
- accepted repair head → cumulative replacement tree: exactly the four intentional paths listed above.

No CurveYield Lite path or Phase 4–6 implementation path appears.

## Cloudflare production-deployment blocker

Cloudflare bot records show production deployments of existing draft heads for PRs #13, #24, and #35.

Required administrator action:

`Cloudflare dashboard -> Workers & Pages -> contract-automation -> Settings -> Builds & deployments / Git integration`

Restrict production deployment to the approved release branch (`main`) and disable PR/non-release production deployments, or disconnect the Git integration. Review preview rules as well.

Moving the three branch refs before this change would knowingly risk production deployment and violate issue #70.

## Ready publication operations after external remediation

1. move `audit-phase1/integration-v2` to `67a898da0b1c222481253abcc70fdf3bc3d428ce`;
2. move `audit-phase2/integration-v2` to `d95319c027995d4ba53afb88e6d17fe262a2e585`;
3. move `audit-phase3/integration-v2` to `680a667f8f3e76f1aa78014d55cecbc8b3e64266`;
4. verify PR bases remain `main` → Phase 1 → Phase 2;
5. rerun exact-head permissible checks;
6. update PR #13/#24/#35 descriptions;
7. commit this ledger to `audit-repair/phases-1-3-pr-chain-v1`;
8. post final issue report and update mailbox state.

## Blocked checks

Not run: dependency installation, compilation/build, Wrangler dry run, Actions, complete full-suite tests from a full checkout, or branch-head CI.

## Security confirmation

No dependency was installed or downloaded. No package-manager command, compilation, build, deployment, workflow approval, submitted-project execution, external audit-tool execution, production secret, AWS use, CurveYield Lite modification, Phase 4–6 modification, execution enablement, PR merge, or main merge occurred.

No branch ref or PR head has been moved.
