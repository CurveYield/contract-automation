# Round 3 API route, module, authorization, and data-flow map v1

## Identity

- Issue: `#113`
- Mailbox sequence: `4`
- Branch: `audit-round3/api-gpt-auth-release-v1`
- Starting SHA: `d2d17ce80071f67cf5894c09d3a7291f5904cf43`
- Prior package: issue `#102`
- Review mode: independent source review; prior acceptance claims are treated as hypotheses, not evidence.

## Current production module map

| Module | Responsibility | Imported trust boundary |
|---|---|---|
| `packages/audit-api-contracts/src/index.mjs` | hostile-value boundary, authentication, CORS, canonical JSON, cursor and cache metadata, error normalization | Web APIs only |
| `packages/audit-api-contracts/src/discovery.mjs` | read-scope and report-reference validation | server-owned environment scope map |
| `packages/audit-api-contracts/src/status.mjs` | campaign/job status summary validation | injected status provider output |
| `packages/audit-catalog-composition/src/index.mjs` | Phase 4–6 identity projection and aggregate capabilities | Phase 4 catalog plus pinned Phase 5/6 source identities |
| `apps/audit-api/src/phase4-catalog.mjs` | Phase 4 list/item routes | Phase 4 catalog/parser packages |
| `apps/audit-api/src/phase5-catalog.mjs` | Phase 5 list/item routes | accepted-interface projection |
| `apps/audit-api/src/phase6-catalog.mjs` | Phase 6 list/item routes | accepted-interface projection |
| `apps/audit-api/src/phase9-reports.mjs` | report list/item routes | injected report-discovery provider |
| `apps/audit-api/src/phase9-gpt.mjs` | GPT capabilities, catalog, report rewrite, campaign/job status | catalog composition and injected providers |
| `apps/audit-api/src/entry.mjs` | read-handler ordering, Phase 1–3 fallback, capability enrichment | legacy Phase 3 worker |

## Current route registry at the starting SHA

| Route | Method | Handler | Starting authorization | Data flow |
|---|---|---|---|---|
| `/audit/v1/tool-profiles` | GET/OPTIONS | Phase 4 catalog | any configured read identity; OPTIONS anonymous | catalog package → canonical JSON |
| `/audit/v1/tool-profiles/:profileId` | GET/OPTIONS | Phase 4 catalog | any configured read identity; OPTIONS anonymous | catalog item → canonical JSON |
| `/audit/v1/phase5/tool-profiles` | GET/OPTIONS | Phase 5 catalog | any configured read identity; OPTIONS anonymous | accepted-interface snapshot → canonical JSON |
| `/audit/v1/phase5/tool-profiles/:profileId` | GET/OPTIONS | Phase 5 catalog | any configured read identity; OPTIONS anonymous | accepted-interface item → canonical JSON |
| `/audit/v1/phase6/tool-profiles` | GET/OPTIONS | Phase 6 catalog | any configured read identity; OPTIONS anonymous | accepted-interface snapshot → canonical JSON |
| `/audit/v1/phase6/tool-profiles/:profileId` | GET/OPTIONS | Phase 6 catalog | any configured read identity; OPTIONS anonymous | accepted-interface item → canonical JSON |
| `/audit/v1/reports` | GET/OPTIONS | report discovery | any configured read identity with server-owned scope | scope → provider page → report validator → scoped cache |
| `/audit/v1/reports/:reportId` | GET/OPTIONS | report discovery | any configured read identity with server-owned scope | scope → provider item → exact identity check → scoped cache |
| `/audit/v1/gpt/capabilities` | GET/OPTIONS | GPT | client or GPT | static aggregate capability projection → scoped cache |
| `/audit/v1/gpt/catalog` | GET/OPTIONS | GPT | client or GPT | static catalog → cursor/page → scoped cache |
| `/audit/v1/gpt/catalog/:profileId` | GET/OPTIONS | GPT | client or GPT | static catalog item → scoped cache |
| `/audit/v1/gpt/reports[/:reportId]` | GET/OPTIONS | GPT rewrite | client or GPT | rewritten request → report handler |
| `/audit/v1/gpt/campaigns/:campaignId/status` | GET/OPTIONS | GPT | client or GPT | scope → provider → status validator → scoped cache |
| `/audit/v1/gpt/jobs/:jobId/status` | GET/OPTIONS | GPT | client or GPT | scope → provider → status validator → scoped cache |
| `/audit/v1/capabilities` | GET | entry/legacy | legacy Phase 3 authorization | legacy body → Phase 4/9 enrichment |
| `/audit/v1/readiness` | GET | entry/legacy | legacy Phase 3 authorization | runtime configuration → inert readiness |
| unrelated legacy Phase 1–3 routes | existing methods | Phase 3 fallback | existing legacy rules | unchanged fallback |

## Starting authentication identities

| Environment binding | Starting identity | Starting effective read access |
|---|---|---|
| `AUDIT_CLIENT_API_KEY` | `client` | catalogs, reports, GPT routes |
| `AUDIT_GPT_API_KEY` | `gpt` | catalogs, reports, GPT routes |
| `AUDIT_READ_API_KEY` | `legacy-read` | catalogs and reports; forbidden from GPT routes |
| `AUDIT_SUBMIT_API_KEY` | `legacy-submit` | catalogs and reports; forbidden from GPT routes |
| `AUDIT_ADMIN_API_KEY` | `legacy-admin` | catalogs and reports; forbidden from GPT routes |
| narrowly scoped service identity | absent | no route contract |
| edge-control, attestation, Lite, malformed, empty, unrelated | unauthorized | none |

## Independently observed source-review findings

1. **Credential alias collision:** identical configured values for two identity bindings select the first identity instead of failing closed. This can substitute the first identity's read scope for the intended identity.
2. **Capability fabrication seam:** the exported aggregate builder accepts raw booleans that can mark Phase 7 or Phase 8 available without a compatibility proof.
3. **Incomplete Phase 6 identity:** the Phase 6 summary records package version `0.2.0` but omit parser function, capture schema, result schema, and trusted producer identity.
4. **List non-interference leak:** a cross-scope report row changes an otherwise empty list from HTTP 200 to provider-contract HTTP 500.
5. **Stale cursor acceptance:** a cursor whose anchor no longer exists can silently return HTTP 200 with an empty page.
6. **CORS configuration failure:** a control-character-bearing configured origin reaches the `Response` constructor and throws rather than failing closed to `null`.
7. **Incomplete GPT surface:** workspace, fork, clean-room, and evidence-summary routes required by issue #113 are absent.
8. **Partial route-level authorization:** the prior package has broad read authentication plus a GPT-only post-check, but no explicit per-route scope registry or narrowly scoped service identity.
9. **Pagination trust ambiguity:** report pages are sorted only after the provider has applied its limit/after arguments, so global canonical ordering and anchor state are not proven by the API contract.
10. **Phase 7–8 discovery absence:** aggregate capabilities have booleans but no transport-neutral compatibility contract or service-discovery identity.

## Preserved RED evidence

Command, executed against an isolated no-download harness containing byte-equivalent starting source for the six exercised production modules:

```text
node --test apps/audit-api/test/round3-source-review-red-v1.test.mjs
```

Result:

```text
7 tests
0 passed
7 failed
0 cancelled
0 skipped
TAP duration: 134.396766 ms
```

Failure inventory:

- missing duplicate-credential rejection;
- raw booleans fabricate Phase 7/8 availability;
- missing Phase 6 parser/result identities;
- cross-scope report list returns 500 instead of non-interfering 200;
- stale cursor returns 200 instead of stable `stale_cursor`;
- hostile CORS origin throws in the Web API header constructor;
- four required GPT route classes return no handler.

## Target Round 3 route additions

- `/audit/v1/gpt/workspaces/:workspaceId/status`
- `/audit/v1/gpt/forks/:forkId/status`
- `/audit/v1/gpt/clean-rooms/:campaignId/status`
- `/audit/v1/gpt/jobs/:jobId/evidence-summary`

The target implementation will add explicit route authorization contracts, service identities, exact provider-page contracts, Phase 7–8 compatibility evidence, bounded evidence summaries, stale cursor semantics, recursive redaction, and Cloudflare portability verification without modifying the frozen simulation/RPC addon.
