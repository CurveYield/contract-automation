# Worker 1 Round 4 Stage A — Worker 2 Intake v1

## Authoritative source

- Issue: `#121`
- Sequence: `5`
- Starting SHA: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`
- Reviewed code snapshot: `e26b78c2c26f3c11897e8fea397c8615fc66a5a0`
- Isolated takeover branch: `orchestrator/worker1-round4-takeover-v1`
- Recommendation: **ACCEPT WITH REPAIR**
- Stage B: **not started; waiting for one frozen assembled SHA on #119**

The original Worker 1 branch continued changing after the runtime was declared nonfunctional. Do not intake by branch merge. Use only the exact path/blob manifest from the isolated takeover lineage.

## Intake order

After the accepted Phase 1–6 spine and accepted/repaired Phase 7–8 base:

1. Replace the seven `packages/audit-phase78-service/src/**` paths listed in the manifest.
2. Replace the four `packages/audit-fork-reporting/src/**` paths listed in the manifest.
3. Replace the four `packages/audit-clean-room-reporting/src/**` paths listed in the manifest.
4. Replace `packages/audit-phase78-publication/src/plans.mjs` and `recovery.mjs`.
5. Add the six Worker 1 test files and two fixtures.
6. Intake the two review documents if release evidence documentation is included.
7. Perform shared-file unions only if another accepted manifest explicitly overlaps. This manifest has no workflow, runner/RPC, GitHub-native simulation, PR #126, or Worker 1 Round 3 API-production path.

## Mandatory blob gate

Use `docs/audit/round4/worker1/2026-08-02-phase78-stage-a-path-blob-manifest-v1.json`.

Reject intake if any production or test blob differs from the manifest. A later takeover-branch head is acceptable only when its production/test blobs are identical and additional commits are metadata-only.

## Public compatibility locks

- v2 fork requests require `attemptId`.
- request-bound response/error validators must reject recomputed cross-scope objects.
- hidden and absent authorization/report projections remain indistinguishable.
- v2 cursors and cache metadata bind tenant, workspace, campaign, fork, attempt, merge, index, and visible-view digests.
- v2 pages do not expose `total`.
- reports validate upstream fork/campaign/merge/relation/provenance contracts before projection.
- publication uses exact resource-scoped keys, immutable create semantics, exact CAS, and pointer-last recovery.
- `executionEnabled` and `usesPrefixListing` remain false.

## Verification evidence

The independent takeover run executed six Worker 1 suites together: **108 passed, 0 failed**. See the verification receipt for the exact command, breakdown, and no-checkout limitation.

## Stage B activation

After Worker 2 publishes a single frozen integration SHA on #119, notify this orchestrator takeover on #121. Stage B must run against that exact SHA. Any newer assembly invalidates the acceptance.
