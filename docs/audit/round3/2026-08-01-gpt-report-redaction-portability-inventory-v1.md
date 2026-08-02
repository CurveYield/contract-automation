# Round 3 GPT, report, redaction, and portability inventory v1

## Candidate identity

- Issue: `#113`
- Branch: `audit-round3/api-gpt-auth-release-v1`
- Starting SHA: `d2d17ce80071f67cf5894c09d3a7291f5904cf43`
- API contracts: `audit-api-contracts-v2`
- Catalog composition: `audit-catalog-composition-v2`
- Execution: disabled
- Executor: unavailable

## GPT endpoint registry

| Endpoint | Route scope | Output contract | Provider/import |
|---|---|---|---|
| `/audit/v1/gpt/capabilities` | `capabilities.read` | `audit-aggregate-capabilities-v2` | validated catalog and Phase 7–8 compatibility |
| `/audit/v1/gpt/catalog` | `catalog.read` | `audit-gpt-catalog-list-v2` | immutable Phase 4–6 catalog |
| `/audit/v1/gpt/catalog/:profileId` | `catalog.read` | `audit-tool-profile-summary-v2` | immutable Phase 4–6 catalog |
| `/audit/v1/gpt/reports` | `reports.list` | `audit-report-list-v2` | injected report provider |
| `/audit/v1/gpt/reports/:reportId` | `reports.read` | `audit-report-reference-v1` | injected report provider |
| `/audit/v1/gpt/workspaces/:workspaceId/status` | `workspace.status.read` | `audit-status-summary-v1` | injected status provider |
| `/audit/v1/gpt/campaigns/:campaignId/status` | `campaign.status.read` | `audit-status-summary-v1` | injected status provider |
| `/audit/v1/gpt/jobs/:jobId/status` | `job.status.read` | `audit-status-summary-v1` | injected status provider |
| `/audit/v1/gpt/forks/:forkId/status` | `fork.status.read` | `audit-status-summary-v1` | injected status provider |
| `/audit/v1/gpt/clean-rooms/:cleanRoomId/status` | `clean-room.status.read` | `audit-status-summary-v1` | injected status provider |
| `/audit/v1/gpt/jobs/:jobId/evidence-summary` | `evidence.summary.read` | `audit-evidence-summary-v1` | injected status provider |

All routes are GET/OPTIONS only. Unsupported methods are rejected before body parsing. Request-supplied tenant, workspace, scope, capability, or service-grant fields are not read.

## Report contract inventory

### Immutable report reference

Exact fields:

- `schemaVersion`
- `reportId`
- `tenantId`
- `workspaceId`
- `campaignId`
- `jobId`
- `reportSchemaVersion`
- immutable lowercase `sha256:` digest
- canonical `createdAt`
- bounded summary with classification, finding count, evidence count, and truncation state

Prohibited by exact-key validation:

- artifact bytes;
- inline evidence bytes;
- arbitrary or signed URLs;
- host paths;
- credentials/headers;
- execution claims;
- hidden-resource totals.

### Report list

Exact fields:

- `schemaVersion: audit-report-list-v2`
- `reports`
- `nextCursor`

Provider output is bounded, canonicalized, duplicate-checked, visibility-filtered, sorted by report ID, and then paginated. Exact duplicates deduplicate; conflicting duplicate IDs fail closed. Stale anchors return `stale_cursor`. Totals are never returned.

### Status summaries

`audit-status-summary-v1` supports exact lifecycle vocabularies for:

- workspace;
- campaign;
- job;
- fork;
- clean-room.

The terminal boolean must agree with the resource-specific state. Real fork and job states may truthfully report `awaiting_executor`; no state may imply an available executor.

### Evidence summaries

`audit-evidence-summary-v1` exposes only bounded counts, classification, truncation, and canonical update time. It contains no artifact bytes, URLs, paths, credentials, or executable content.

## Error/redaction contract

Public errors include only:

- stable bounded code;
- stable public message (`Request rejected` or `The request could not be completed`);
- optional validated bounded field path.

The normalizer discards provider messages, recursive details, response/request headers, nested arrays, causes, stacks, URLs, host paths, control characters, bidi/Unicode attacker text, and oversized strings. Unknown and hostile-reflection errors use one deterministic internal-error response. Error responses use `private, no-store`.

## Cloudflare portability and import graph

Owned production modules use only standard ECMAScript/Web APIs:

- `TextEncoder` / `TextDecoder`;
- `crypto.subtle.digest`;
- `URL`, `Request`, `Response`, `Headers`;
- `structuredClone`;
- `btoa` / `atob`.

Production import graph:

```text
entry.mjs
  -> phase3.mjs / runtime.mjs / upload-grants.mjs (existing Phase 1–3 composition)
  -> phase4-catalog.mjs
  -> phase5-catalog.mjs
  -> phase6-catalog.mjs
  -> phase9-reports.mjs
  -> phase9-gpt.mjs

catalog/report/GPT handlers
  -> audit-api-contracts/{index,authorization,discovery,status}.mjs
  -> audit-catalog-composition/index.mjs
  -> accepted Phase 4 catalog/parser contracts
```

No owned production module imports `node:*`, filesystem, process, child-process, worker-thread, socket/network client, package manager, container runtime, dynamic code, wallet/signing/transaction/broadcast/deployment primitive, GitHub-native simulation, runner RPC policy/guard, or CurveYield Lite.

The API imports only immutable compatibility metadata for Phase 5–8. It does not import Phase 7–8 storage internals.

## Focused verification files

- `apps/audit-api/test/round3-gpt-routes-v1.test.mjs`
- `apps/audit-api/test/round3-pagination-provider-v1.test.mjs`
- `packages/audit-api-contracts/test/round3-status-evidence-v1.test.mjs`
- `packages/audit-api-contracts/test/round3-redaction-v1.test.mjs`
- `apps/audit-api/test/round3-cloudflare-portability-v1.test.mjs`

These supplement all retained issue #102 regression tests.
