# Worker 3 — Round 4 independent API/auth security review and assembled trust acceptance v1

## Identity

- Worker ID: `worker-3-round4-api-auth-security-review-v1`
- Sequence: `8`
- Message ID: `worker-3-round4-api-auth-security-review-v1-000008`
- Repository: `CurveYield/contract-automation`
- Issue: `#123`
- Branch: `audit-round4/review-api-auth-security-v1`
- Starting SHA: `6d877e2d87f1a91380a6c5d1efc47550527d8729`
- Round: **4 — final static/inert integration and acceptance round before Round 5 production testing**

## Authoritative inputs

- Worker 1 Round 3 API/GPT/auth final head: `6d877e2d87f1a91380a6c5d1efc47550527d8729`, issue #113.
- Worker 1 reviewed implementation candidate: `f02840ee3fc0c59759c5034dc5c40e0c154bdab5`.
- API contract: `audit-api-contracts-v2`.
- Catalog composition: `audit-catalog-composition-v2`.
- Worker 3 Round 3 GitHub Direct final documentation head: `1672b31a71674dd78eddc3bf5fc2fbe39d4ae07d`.
- Worker 3 verified GitHub Direct code/workflow candidate: `46873f805199e2212af3902c8525c0f3e4501721`.
- Worker 3 authoritative Round 3 final report: issue #115 comment `5156758072`.
- Round 4 master gate: issue #119.

Re-fetch all inputs and reject any mismatch before editing.

## Goal

Independently security-review the API/GPT/auth/report-discovery release from an external GitHub Direct trust-boundary perspective. Prove exact route/method/scope authorization, credential separation and non-persistence, tenant/resource non-interference, cache/cursor scoping, recursive redaction, hostile-provider handling and Cloudflare portability. Repair only observed defects test-first. Publish deterministic Worker 2 intake instructions, then independently accept or reject the frozen assembled candidate’s full API/GitHub trust model.

## Owned paths

- minimal proven repairs to Worker 1-owned API/auth/catalog/report paths;
- tests `test/audit-round4-worker3-*` and `apps/audit-api/test/round4-security-*`;
- fixtures `test/fixtures/audit-round4/worker3/**`;
- reviews/manifests `docs/audit/round4/worker3/**`.

Do not alter Worker 3 Round 3 GitHub Direct production during Stage A. Never alter the GitHub-native simulation/App/RPC addon.

## Stage A ordered work

1. Pin exact candidate, report, changed-path/blob, route/auth, schema and catalog registries.
2. Re-run all permissible Worker 1 source-review, authorization, non-interference, redaction, portability, concurrency and route-composition tests.
3. Build the complete credential-identity and route/method/scope/resource-binding matrix.
4. Build the API-to-GitHub-Direct trust separation and data-flow map.
5. Add observed RED tests for duplicate credentials, case/prefix/whitespace confusion, malformed bearer forms and request-supplied identity aliases.
6. Add RED tests for cross-tenant/workspace/resource cache reuse, hidden-resource body/header/status/count/ETag drift and stale/tampered cursors.
7. Add RED tests for error/provider text reflection, unsafe URLs/paths, authorization/header/cookie leakage and oversized hostile values.
8. Add RED tests for Node-only imports, environment-created capabilities, hidden GitHub/storage authority, read body parsing, arbitrary network clients and execution claims.

### Checkpoint 1

Post exact source/report/blob verification, authorization/trust map, RED commands/results, protected hashes and changed paths.

9. Repair only proven API/auth/catalog/report defects while preserving stable contracts or explicitly versioning unavoidable changes.
10. Centralize and close route authorization; prove every owned method/route has one exact allowed identity/scope/resource rule.
11. Harden credential configuration, matching, expiry/revocation, grant binding and recursive credential-key rejection.
12. Harden hidden-resource non-interference, provider argument ownership and cache/cursor/ETag scope.
13. Harden public error normalization and hostile provider boundaries without invoking getters or reflecting attacker text.
14. Verify production code cannot serialize, persist, log or derive cache keys from credentials.
15. Verify Cloudflare Worker portability using only approved Web APIs and no hidden fallback/transport authority.
16. Build exact API/GitHub Direct public-contract compatibility tests through public indexes only.

### Checkpoint 2

Post repaired SHA, route/credential matrix, redaction/non-interference results, portability proof, GREEN evidence and exact Worker 2 intake paths.

17. Run broad hostile-object, credential corpus, route substitution, cache/cursor, concurrent-scope, abort/cancellation, provider-error and static import/security matrices.
18. Run direct-Node, syntax, JSON, changed-path, public-schema, credential-literal, Cloudflare portability, protected-blob and whitespace gates.
19. Publish complete reviewed/repaired path/blob manifest, compatibility manifest and deterministic Worker 2 intake instructions.
20. Publish `ACCEPT`, `ACCEPT WITH REPAIR` or `REJECT`.

### Checkpoint 3 — Stage A completion

Post final Stage A SHA, all changed paths/blobs, tests/mutations/attack-case totals, route/auth registry, residual risks and exact intake order.

## Stage B assembled trust acceptance

After Worker 2 freezes one assembled integration SHA on issue #119:

1. Pin the exact SHA; any newer SHA invalidates acceptance.
2. Verify API/GitHub Direct trust separation, route auth and credential non-persistence.
3. Verify minimal permissions, full-SHA action pins and workflow source trust/target-as-data behavior.
4. Verify ledger/CAS/replay/cancellation/report idempotency and bounded artifact handling.
5. Verify recursive redaction across API, CLI, reports and operator surfaces.
6. Verify Cloudflare portability, no hidden fallback and no secret values in source/fixtures/logs/docs.
7. Verify protected simulation-addon blob equality.
8. Publish final `ACCEPT` or `REJECT` against that exact SHA.

## Restrictions

No dependency installation unless issue #123 permits it, no submitted-project execution, no live GitHub/RPC/network, no wallet/signing/transaction, no deployment, no secret values, no PR, no branch merge and no direct `main` modification.

## Completion

Post startup/checkpoints/final reports only to issue #123, commit only to `audit-round4/review-api-auth-security-v1`, record exact report IDs and SHAs in status, and monitor issue #119 for the Stage B candidate.
