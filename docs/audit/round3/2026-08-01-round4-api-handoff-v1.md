# Round 4 API final-acceptance handoff v1

## Candidate identity

- Repository: `CurveYield/contract-automation`
- Round 3 issue: `#113`
- Branch: `audit-round3/api-gpt-auth-release-v1`
- Starting SHA: `d2d17ce80071f67cf5894c09d3a7291f5904cf43`
- Reviewed implementation SHA: `f02840ee3fc0c59759c5034dc5c40e0c154bdab5`
- API contract: `audit-api-contracts-v2`
- Catalog composition: `audit-catalog-composition-v2`
- Phase 7–8 compatibility source: `13af0c6c6c3d74ceacdc1894d6f3146460884fb4`
- Protected simulation-addon reference: `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`
- Recommendation entering Round 4: **ACCEPT for final integration review**
- Execution boundary: `executionEnabled: false`; executor unavailable.

Round 4 must reconstruct or integrate this candidate by owned path only. It must not merge stale ancestry, enable submitted-project execution, or modify the protected GitHub-native simulation/RPC addon.

## Public package exports

### `packages/audit-api-contracts/src/index.mjs`

- `AUDIT_API_CONTRACT_VERSION`
- `AUDIT_API_BOUNDS`
- `ApiContractError`
- `validateExternalValue(value, path?)`
- `canonicalJson(value)`
- `authenticateAuditRead(request, env)`
- `corsHeaders(env)`
- `createJsonResponse(value, options?)`
- `normalizeApiError(cause, options?)`
- `errorResponse(cause, env)`
- `encodePageCursor({ scope, kind, after })`
- `decodePageCursor(cursor, { scope, kind })`
- `parsePageLimit(value, options?)`

### `packages/audit-api-contracts/src/authorization.mjs`

- `AUDIT_ROUTE_SCOPES`
- `authorizeAuditReadRequest(request, env, options)`

### `packages/audit-api-contracts/src/discovery.mjs`

- report/reference and read-scope validation retained from the accepted prior package.

### `packages/audit-api-contracts/src/status.mjs`

- `validateStatusSummary(value, expectedIdentity)`
- `validateEvidenceSummary(value, expectedIdentity)`

### `packages/audit-catalog-composition/src/index.mjs`

- `AUDIT_CATALOG_COMPOSITION_VERSION`
- `ACCEPTED_SOURCE_COMMITS`
- `ACCEPTED_PHASE78_INTERFACE`
- `createAcceptedPhase5Catalog()`
- `createAcceptedPhase6Catalog()`
- `createAuditCatalogComposition({ phase4Profiles })`
- `validateAuditCatalogComposition(value)`
- `createAcceptedPhase78ServiceCompatibility()`
- `validatePhase78ServiceCompatibility(value)`
- `createAggregateAuditCapabilities(options)`

## Exact read route registry

### Direct catalog and report routes

| Route | Methods | Route scope |
|---|---|---|
| `/audit/v1/tool-profiles` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/tool-profiles/:profileId` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/phase5/tool-profiles` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/phase5/tool-profiles/:profileId` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/phase6/tool-profiles` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/phase6/tool-profiles/:profileId` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/reports` | GET, OPTIONS | `reports.list` |
| `/audit/v1/reports/:reportId` | GET, OPTIONS | `reports.read` |

### GPT-facing routes

| Route | Methods | Route scope |
|---|---|---|
| `/audit/v1/gpt/capabilities` | GET, OPTIONS | `capabilities.read` |
| `/audit/v1/gpt/catalog` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/gpt/catalog/:profileId` | GET, OPTIONS | `catalog.read` |
| `/audit/v1/gpt/reports` | GET, OPTIONS | `reports.list` |
| `/audit/v1/gpt/reports/:reportId` | GET, OPTIONS | `reports.read` |
| `/audit/v1/gpt/workspaces/:workspaceId/status` | GET, OPTIONS | `workspace.status.read` |
| `/audit/v1/gpt/campaigns/:campaignId/status` | GET, OPTIONS | `campaign.status.read` |
| `/audit/v1/gpt/jobs/:jobId/status` | GET, OPTIONS | `job.status.read` |
| `/audit/v1/gpt/forks/:forkId/status` | GET, OPTIONS | `fork.status.read` |
| `/audit/v1/gpt/clean-rooms/:cleanRoomId/status` | GET, OPTIONS | `clean-room.status.read` |
| `/audit/v1/gpt/jobs/:jobId/evidence-summary` | GET, OPTIONS | `evidence.summary.read` |

The real `apps/audit-api/src/entry.mjs` dispatches all owned read handlers before the existing Phase 1–3 fallback. It returns stable 499 `request_cancelled` responses when a request is already aborted or becomes aborted across an awaited handler/provider boundary. Abort reasons are never reflected.

## Authentication identities

- `AUDIT_CLIENT_API_KEY` → `client`
- `AUDIT_GPT_API_KEY` → `gpt`
- `AUDIT_READ_API_KEY` → `legacy-read`
- `AUDIT_SUBMIT_API_KEY` → `legacy-submit`
- `AUDIT_ADMIN_API_KEY` → `legacy-admin`
- `AUDIT_SERVICE_READ_API_KEY` → `service-read`

Configured credential values must be unique. Any alias between configured identities fails closed before token matching as `credential_configuration_conflict`.

Client and GPT identities may use all approved read scopes. Legacy aliases may use only direct catalog and report discovery and are forbidden from the GPT namespace. `service-read` requires the exact server-owned grant:

```text
{ tenantId, workspaceId, scopes, resourceBindings, expiresAt, revoked }
```

Service scopes and bindings are canonical, unique, bounded, unexpired, and non-revoked. Item/status/evidence reads require the exact `<resource-type>:<resource-id>` binding. Request data cannot add a scope, binding, tenant, workspace, capability, or execution state.

## Capability and catalog dependencies

- Phase 4: six exact current catalog/parser identities from the candidate starting lineage.
- Phase 5: four immutable accepted-interface summaries pinned to `2982614879f1f6d252a7630eb5331031d5934b4e`.
- Phase 6: three immutable accepted-interface summaries pinned to `1b20f634b6d3c5f1261d490e545415c81d7488f2`, including parser function, capture schema, result schema, and trusted producer.
- Phase 7–8: transport-neutral service compatibility pinned to source commit `13af0c6c6c3d74ceacdc1894d6f3146460884fb4`, index blob `d23b4922f8209b5829618b4d9a4174f3b5849be9`, constants blob `8f8ae95fb8a6b5829618b4d9a4174f3b5849be9`, and 15 exact operation names.

Phase 5–8 catalog/service discovery does not claim installed runtime execution availability. Phase 7 and Phase 8 `available` remain false. Raw booleans, environment aliases, or request data cannot make them true.

## Pagination, caching, and non-interference

- report provider output is validated, canonicalized, visibility-filtered, conflict-checked, sorted, and only then paginated;
- exact duplicate report rows deduplicate; byte-different duplicate IDs fail closed;
- cursors bind exact tenant/workspace scope, route kind, and anchor; stale anchors return `stale_cursor`;
- response totals are omitted;
- cache metadata is private and binds tenant, workspace, route, query, and canonical response body;
- secrets are never included in cursor or ETag inputs;
- well-formed hidden report rows do not alter the visible body, cursor, cache-control, or ETag;
- hidden item/status/evidence targets are indistinguishable from absent resources.

## Error and provider boundary

Public errors expose only a stable code, stable public message, and optional bounded validated path. Provider messages, nested data, request/response headers, bearer values, URLs, host paths, stacks, causes, control characters, bidi text, Unicode attacker text, and oversized values are discarded.

Provider methods are read through own data-property descriptors. Accessor getters are not invoked. Malformed provider schemas return stable `provider_contract_error` 500 responses; cross-scope identity mismatches remain stable 404 responses.

## Cloudflare Worker portability

Owned production code uses standard ECMAScript/Web APIs only and has no `node:*` production import, Buffer/process/filesystem/child-process/worker-thread/socket/network client, dynamic code, package manager, container runtime, wallet/signing/transaction/broadcast/deployment primitive, or execution-enablement state.

No owned production module imports GitHub-native simulation, runner RPC policy/guard, or CurveYield Lite. The protected addon remains pinned at reference commit `3f68cc1b12cc7f9a84e4cb04b768c049138814c6` and has zero candidate changed paths.

## Shared-file union instructions for Round 4

1. Start from the Round 4 integration candidate, not this branch ancestry.
2. Copy the 30 paths in `docs/audit/round3/2026-08-01-candidate-changed-paths-v1.json` by exact reviewed content.
3. For `apps/audit-api/src/entry.mjs`, retain the existing Phase 1–3 imports and fallback behavior while adding the Round 3 read-handler order and cancellation checks exactly.
4. Do not overwrite any newer integration-owned runtime, service, web, GitHub Direct, workflow, or deployment path.
5. Rebuild Phase 5–8 compatibility only when the integrated accepted source blobs match the pinned identities; never infer availability from package presence alone.
6. Preserve every protected simulation/RPC blob and workflow byte-for-byte.
7. Keep `executionEnabled: false` and executor unavailable throughout.

## Minimal final acceptance commands

No dependency installation or compilation is required.

```text
node --test \
  packages/audit-api-contracts/test/*.test.mjs \
  packages/audit-catalog-composition/test/*.test.mjs \
  apps/audit-api/test/phase4*.test.mjs \
  apps/audit-api/test/phase5*.test.mjs \
  apps/audit-api/test/phase9*.test.mjs \
  apps/audit-api/test/round3-*.test.mjs
```

Then run direct syntax checks for all changed `.mjs`, parse the three Round 3 JSON manifests, verify the 30-path allowlist, re-fetch all 17 protected blob pins, and run `git diff --check`.

## Residual risk and Round 4 decisions

1. Phase 5 and Phase 6 summaries are immutable accepted-interface projections on this isolated lineage; Round 4 should replace projection-only availability with integrated package validation only after exact source/blob verification.
2. Phase 7–8 capability discovery validates a transport-neutral compatibility record; it does not import or execute service/storage internals.
3. Provider storage and network implementations are outside this package. Round 4 must verify the integrated providers preserve the documented argument, snapshot, ordering, and non-interference contracts.
4. The no-download harness validates Cloudflare-compatible Web API behavior and static imports but does not perform a Cloudflare deployment or build.
5. Repository-wide integration tests outside this branch lineage remain a Round 4 responsibility.

These are integration residual risks, not unresolved defects in the Round 3 owned implementation.
