# Worker 3 Round 4 API/Auth Security — Worker 2 Intake v1

## Authoritative input

- Issue: `#123`
- Starting/API head: `6d877e2d87f1a91380a6c5d1efc47550527d8729`
- Reviewed/repaired code snapshot: `a70e6d762530bf0ce8c7dfd467c8b1278b6dd43d`
- Takeover branch: `orchestrator/worker3-round4-takeover-v1`
- Recommendation: **ACCEPT WITH REPAIR — Stage A**

## Exact intake

Transplant these paths only, using the exact blobs in `2026-08-02-worker3-stage-a-path-blob-manifest-v1.json`:

1. `apps/audit-api/src/phase9-reports.mjs`
2. `apps/audit-api/test/round4-hidden-provider-noninterference-v1.test.mjs`

Do not merge the branch. Reject any mismatching blob or additional production path.

## Repair semantics

The report-list provider boundary now performs hostile-safe shallow inspection of the provider container and each row's `tenantId`/`workspaceId` data descriptors. Cross-scope rows are removed before recursive validation. Visible rows are still fully validated by `validateReportReference`; malformed visible rows, sparse/accessor-bearing arrays, malformed page wrappers, and conflicting duplicate visible report IDs remain fail-closed.

## Required integration gates

Worker 2 must run:

```text
node --test apps/audit-api/test/round4-hidden-provider-noninterference-v1.test.mjs
node --test apps/audit-api/test/round3-pagination-provider-v1.test.mjs
node --test apps/audit-api/test/round3-entry-composition-v1.test.mjs
node --test apps/audit-api/test/round3-gpt-routes-v1.test.mjs
node --test apps/audit-api/test/round3-hostile-integration-v1.test.mjs
node --test packages/audit-api-contracts/test/round3-authorization-v1.test.mjs
node --test packages/audit-api-contracts/test/round3-contracts-v1.test.mjs
node --test packages/audit-api-contracts/test/round3-redaction-v1.test.mjs
```

Also verify:

- exact route/method/scope/resource registry;
- duplicate/revoked/expired credential rejection;
- malformed Bearer and identity-alias rejection;
- hidden/absent status, body, headers, counts and ETags remain identical;
- cursor scope/checksum/staleness and provider snapshot drift;
- recursive error redaction and hostile getter non-invocation;
- Cloudflare/Web-API portability;
- protected simulation/RPC blobs and PR #126 paths remain unchanged.

## Stage B

After issue #119 freezes one assembled SHA, the orchestrator will perform Worker 3's Stage B API/GitHub trust acceptance against that exact SHA. Any new assembled SHA invalidates the acceptance.
