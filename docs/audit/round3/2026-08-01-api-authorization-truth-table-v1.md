# Round 3 API authorization truth table v1

## Scope

- Issue: `#113`
- Branch: `audit-round3/api-gpt-auth-release-v1`
- Starting SHA: `d2d17ce80071f67cf5894c09d3a7291f5904cf43`
- Contract: `audit-api-contracts-v2`
- Authorization module: `packages/audit-api-contracts/src/authorization.mjs`

Authorization is evaluated in this order:

1. validate configured credential identities and reject duplicate configured secret values;
2. parse one exact `Bearer <token>` authorization value;
3. authenticate to one server-configured identity;
4. validate the server-owned identity scope/grant;
5. enforce the closed route-scope registry;
6. for service identities, enforce expiry, revocation, and exact resource binding;
7. call the injected read provider with tenant/workspace/resource identities derived only from server-owned state.

Request query parameters, headers, bodies, path aliases, and provider outputs cannot create authorization.

## Closed route-scope registry

| Registry key | Exact route scope |
|---|---|
| `catalogRead` | `catalog.read` |
| `capabilitiesRead` | `capabilities.read` |
| `reportsList` | `reports.list` |
| `reportRead` | `reports.read` |
| `workspaceStatusRead` | `workspace.status.read` |
| `campaignStatusRead` | `campaign.status.read` |
| `jobStatusRead` | `job.status.read` |
| `evidenceSummaryRead` | `evidence.summary.read` |
| `forkStatusRead` | `fork.status.read` |
| `cleanRoomStatusRead` | `clean-room.status.read` |

Unknown route scopes fail closed as `forbidden`.

## Identity-to-route truth table

Legend: `A` allowed, `F` stable `403 forbidden`, `U` stable `401 unauthorized`, `B` allowed only with exact service binding.

| Identity | Direct catalogs | Direct report list/item | GPT capabilities/catalog | GPT report list/item | GPT workspace/campaign/job status | GPT evidence summary | GPT fork/clean-room status |
|---|---:|---:|---:|---:|---:|---:|---:|
| `client` | A | A | A | A | A | A | A |
| `gpt` | A | A | A | A | A | A | A |
| `legacy-read` | A | A | F | F | F | F | F |
| `legacy-submit` | A | A | F | F | F | F | F |
| `legacy-admin` | A | A | F | F | F | F | F |
| `service-read` | B | no list grant by default / B item | B | no list grant by default / B item | B | B | B |
| edge-control token | U | U | U | U | U | U | U |
| attestation key | U | U | U | U | U | U | U |
| CurveYield Lite credential | U | U | U | U | U | U | U |
| malformed/empty/unrelated | U | U | U | U | U | U | U |

Catalog handlers preserve historical compatibility for configured non-service read identities by using a server-owned `global/global` catalog scope when no per-identity scope record is configured. This fallback cannot be used for reports, statuses, evidence, forks, or clean rooms.

## Service grant contract

The `service-read` identity requires exactly:

```text
{
  tenantId,
  workspaceId,
  scopes,
  resourceBindings,
  expiresAt,
  revoked
}
```

Rules:

- exact keys only;
- tenant/workspace identifiers are bounded versioned identifiers;
- scope and resource-binding arrays are dense, unique, canonical sorted arrays;
- scopes must be members of the closed route-scope registry;
- resource bindings use `<resource-type>:<resource-id>` and allow only workspace, campaign, job, report, fork, and clean-room types;
- `revoked` must be exactly `false`;
- current authorization time and expiry are canonical ISO instants supplied by trusted runtime configuration;
- authorization fails when current time is equal to or later than expiry;
- item/status/evidence routes require the exact resource binding;
- a missing or mismatched resource binding returns the same `404 not_found` resource response class as an absent resource;
- malformed, missing, expired, and revoked grants return the same bounded `403 forbidden` response class;
- credentials and grant internals are never returned.

## Credential collision truth table

| Configuration | Result |
|---|---|
| all configured secret values distinct | normal identity matching |
| client and GPT values identical | `500 credential_configuration_conflict` before token matching |
| any legacy/service value aliases another configured identity | same conflict result |
| conflict exists but request token is unrelated | same conflict result |
| empty/unconfigured identities | omitted from collision and matching sets |
| hostile environment access | bounded configuration error; no secret reflection |

A credential collision is treated as a server configuration defect rather than selecting the first identity.

## Non-interference expectations

| Case pair | Required equality |
|---|---|
| hidden service-bound item vs absent item | status, body, error code/message/details, cache class |
| expired vs revoked vs malformed vs missing service grant | status and bounded error body |
| well-formed cross-scope report rows present vs absent | list body, returned count class, next cursor, cache-control, ETag |
| cross-workspace cursor replay vs malformed cursor | both bounded client errors; neither exposes the other workspace |
| request-supplied tenant/workspace/scope/resource headers or queries | no effect on provider arguments or authorization context |

## Provider argument contract

Providers receive only the server-owned fields required by the operation:

- report list: `{ tenantId, workspaceId }`;
- report item: `{ tenantId, workspaceId, reportId }`;
- status: `{ tenantId, workspaceId, <resourceId> }`;
- evidence summary: `{ tenantId, workspaceId, jobId }`.

Providers never receive bearer tokens, credential names, raw authorization headers, caller-selected scopes, or caller-selected tenant/workspace identities.

## Focused test inventory

- `packages/audit-api-contracts/test/round3-authorization-v1.test.mjs`
- `apps/audit-api/test/round3-gpt-routes-v1.test.mjs`
- `apps/audit-api/test/round3-pagination-provider-v1.test.mjs`
- prior Phase 9 GPT/report/auth tests retained as regression inputs.

The focused corpus covers route allowlists, legacy isolation, service scope/resource binding, expiry, revocation, malformed grants, duplicate credential aliases, request authority substitution, hidden/absent equality, scoped caches, provider arguments, stale/tampered cursors, hostile provider accessors, and provider output conflicts.
