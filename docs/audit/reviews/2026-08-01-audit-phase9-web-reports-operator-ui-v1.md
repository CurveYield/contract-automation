# Phase 9 Web Reports, Operator UI, and Accessibility Review v1

> **Worker:** `worker-4`
> **Issue:** `#105`
> **Branch:** `audit-phase9/web-reports-operator-ui-v1`
> **Starting SHA:** `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`
> **Mailbox sequence:** `1`
> **Assignment blob:** `37ed559b309d006af99706ad8ce5fd5d10b362ee`

## Recommendation

**ACCEPT**

The Phase 9 web/reporting surface is complete within Worker 4's owned paths. It is dependency-free, read-only, driven by strict contracts and defensive view models, backed by repository-owned inert fixtures, and connected only through an injected transport. The implementation exposes no wallet, signer, transaction, broadcast, deployment, arbitrary RPC, dynamic-code, package-install, workflow-mutation, credential-persistence, or execution-enablement path.

## Scope completed

All sixteen ordered sections in issue #105 were implemented:

1. RED tests and page/component/view-model/data-contract map.
2. Strict UI contracts for all twelve entity families.
3. Canonical defensive view models.
4. Responsive semantic shell and keyboard-first focus behavior.
5. Report list/filter/sort/pagination and immutable report detail/evidence views.
6. Workspace/campaign/job lifecycle views.
7. Persistent-fork and clean-room/provenance views.
8. Capability and tool-catalog discovery.
9. Bounded, redacted operator diagnostics.
10. Accessible tables/cards/details/identifiers and focus restoration.
11. Mobile/tablet/desktop contracts and overflow/extreme-input tests.
12. Safe injected client with cancellation and stale-response rejection.
13. Four inert end-to-end journeys.
14. Adversarial rendering, hostile-object, and redaction fixtures.
15. Static execution-boundary proof.
16. Direct tests, syntax/JSON checks, path allowlist, whitespace validation, durable review, and manual accessibility checklist.

## Architecture

### `packages/audit-ui-contracts/`

Defines twelve frozen entity contracts:

- capability
- catalog tool
- workspace
- campaign
- job
- evidence
- report
- fork
- checkpoint
- clean-room campaign
- provenance
- diagnostic

`parseUiEntity()` is the strict boundary: it accepts only own enumerable data properties, rejects unknown keys, rejects missing required keys, and never invokes accessor descriptors. `readUiEntityData()` is the tolerant defensive projection used by view models.

### `packages/audit-report-view-model/`

Converts untrusted record-like values into exact-key, recursively frozen view models. It provides:

- NFKC normalization;
- C0/C1 and bidirectional-control removal;
- bounded identifiers, text, numbers, and collections;
- safe internal and HTTP(S) URL handling;
- rejection of protocol-relative, credential-bearing, secret-query, script/data, malformed, and oversized URLs;
- sparse-array compaction;
- cycle resistance;
- deterministic ordering;
- visible-only clean-room provenance;
- lifecycle truth labels;
- diagnostic secret, URL, and host-path redaction.

### `apps/audit-web/`

Provides:

- deterministic route recognition;
- semantic HTML shell and state components;
- pure page renderers for every required route;
- responsive CSS and a three-viewport layout contract;
- safe injected-client abstraction;
- inert application navigation controller;
- cancellation, stale-response rejection, focus restoration, and bounded recovery states.

There is no direct network client. The application accepts an injected `transport` function and only issues bounded `GET` requests inside `/api/audit/**`.

## Page and route inventory

| Route | View | Main content |
|---|---|---|
| `/reports` | report list | search, status filter, deterministic sort, pagination, evidence counts |
| `/reports/:id` | report detail | immutable report summary and evidence table |
| `/workspaces` | workspace list | visible workspace cards |
| `/workspaces/:id` | workspace detail | workspace summary and campaigns |
| `/campaigns/:id` | campaign detail | lifecycle summary and jobs |
| `/jobs/:id` | job detail | truthful state, report relation, bounded failure/resource facts |
| `/forks/:id` | persistent-fork detail | checkpoints, export/delete status, retention |
| `/clean-room/:id` | clean-room detail | controlled merges and visible provenance only |
| `/catalog` | capability/tool catalog | discovery metadata with explicit execution unavailability |
| `/diagnostics` | operator diagnostics | bounded code, correlation, retry, quota, retention, publication, stale-state, details |
| unmatched | not-found | semantic bounded error state |

Every route targets `main-heading` for post-navigation focus and carries `executionAvailable=false` truth.

## Component inventory

- `renderShell`
- `renderState`
- `escapeHtml`
- `renderReportsPage`
- `renderReportDetailPage`
- `renderWorkspacesPage`
- `renderWorkspacePage`
- `renderCampaignPage`
- `renderJobPage`
- `renderForkPage`
- `renderCleanRoomPage`
- `renderCatalogPage`
- `renderDiagnosticsPage`
- `renderAuditPage`
- `resolveAuditRoute`
- `createAuditClient`
- `createAuditApp`
- `getLayoutMode`

## View-model inventory

- evidence
- report
- report collection
- job
- campaign
- workspace
- checkpoint/fork
- provenance/clean room
- capability
- catalog tool
- diagnostic
- lifecycle state

## Lifecycle truth table

| State | Label | Terminal | Surface behavior |
|---|---|---:|---|
| pending | Pending | no | observation only |
| awaiting-executor | Awaiting executor | no | explicitly no executor here |
| running | In progress | no | observation only |
| completed | Completed | yes | no action control |
| published | Published | yes | safe report link when present |
| failed | Failed | yes | bounded failure summary only |
| cancelled | Cancelled | yes | no retry control |
| resource-limit | Resource limit reached | yes | bounded limit facts only |
| exporting | Export pending | no | no export action |
| exported | Exported | yes | safe inert link when supplied |
| deleting | Deletion pending | no | no delete action |
| deleted | Deleted | yes | no action control |
| stale | Stale state | no | bounded conflict truth |

## Persistent-fork and clean-room non-interference

Persistent-fork pages display checkpoint order, export status, delete status, retention expiry, and safe export links without buttons or mutation actions.

Clean-room projection requires provenance to be both explicitly visible and, when an allowlist exists, associated with an allowlisted source ID. Tests prove that an explicitly hidden source and a visible-but-not-allowlisted source do not enter the view model or rendered HTML.

## Operator diagnostics matrix

| Field | Bound / defense |
|---|---|
| code | canonical uppercase; max 80 |
| message | max 2,000; URL/path/secret redaction |
| correlation ID | max 160; copy-safe identifier |
| retry delay | `0…86,400` seconds |
| quota remaining | `0…1,000,000,000` |
| retention | `0…3,650` days |
| publication | bounded canonical status |
| stale-state | strict boolean |
| details | max 2,000; URL/path/secret redaction; native disclosure |

Redaction covers Bearer/Basic values, token/password/API-key/authorization assignments, raw HTTP(S) URLs, common POSIX host paths, and Windows drive paths.

## Safe-client behavior

- Requires an injected transport function.
- Allows only bounded `/api/audit` namespace paths.
- Rejects absolute external URLs, protocol-relative URLs, outside-namespace paths, fragments, backslashes, oversized paths, and secret-bearing query keys before transport invocation.
- Sends only `GET` and `accept: application/json`.
- Cancels the prior request in the same logical slot.
- Rejects late responses even when the transport ignores abort.
- Removes credential-shaped returned fields.
- Reads data descriptors only and never invokes returned accessors.
- Bounds depth, object keys, and arrays.
- Converts cycles to inert `null` leaves.
- Recursively freezes returned state.
- Uses no local/session storage, IndexedDB, cookie, or console logging sink.

## Inert end-to-end flows

The versioned fixture `inert-data-v1.json` supplies eight route resources and no executable behavior.

1. **Catalog → campaign → job → report/evidence:** four bounded `GET` requests, four focus restorations, and no operational buttons.
2. **Persistent fork:** lifecycle facts, checkpoint, export truth, delete truth, and retention without mutation controls.
3. **Clean room:** controlled merge and visible provenance with hidden-resource non-interference.
4. **Operator recovery:** first injected transport failure becomes a generic redacted alert; the next navigation succeeds and replaces the error state.

## Adversarial fixture coverage

The versioned `adversarial-v1.mjs` fixture covers:

1. script-like markup;
2. SVG/event-handler markup;
3. unsafe script URL;
4. inherited prototype property;
5. hostile accessor;
6. sparse million-length array;
7. cyclic record;
8. oversized text;
9. full-width Unicode normalization;
10. C0 control characters;
11. bidirectional control characters;
12. raw external URL;
13. POSIX host path;
14. Bearer token;
15. secret assignments;
16. credential-shaped returned fields;
17. oversized returned collection;
18. returned cyclic payload.

No accessor was invoked. Unsafe URLs became `null`; hidden/prototype/secret fields were excluded; arrays were bounded; cycles became inert; bidi/control characters were removed; output was frozen; and rendered HTML contained no injected script, SVG, or image element.

## Accessibility and keyboard evidence

- Document language and viewport metadata.
- Skip link to main content.
- Labeled primary navigation with `aria-current`.
- One page-level `h1` and semantic section headings.
- Focusable main region and deterministic post-navigation focus restoration.
- Loading/empty polite live regions and alert errors.
- Native forms, labels, selects, and inputs.
- Table captions, scoped row/column headers, and labeled keyboard-scrollable wrappers.
- Semantic list/card structures.
- Native `<details>/<summary>` expansion.
- Focusable, labeled, bounded copy-safe identifiers.
- Visible `:focus-visible` outline.
- Long-token wrapping and horizontal overflow containment.
- Reduced-motion media behavior.
- No color-only state encoding; state text remains explicit.

### Manual accessibility checklist

- [x] Keyboard skip path is present.
- [x] Navigation order follows document order.
- [x] Every form control has a visible label.
- [x] Every table has a caption and scoped headers.
- [x] Dynamic error/empty/loading states have appropriate live semantics.
- [x] Disclosure uses native keyboard-operable elements.
- [x] Main content receives focus after route navigation.
- [x] Focus indicator is not removed.
- [x] Long identifiers do not require unbounded page width.
- [x] Motion is reduced when requested.
- [x] Execution unavailability is stated in text.
- [x] No secret or host path is intentionally rendered.

A real-browser screen-reader and visual-regression pass was not available without introducing prohibited dependencies. Deterministic full-document DOM fixtures and explicit CSS/layout contracts are the dependency-free evidence used instead.

## Viewport evidence

| Case | Width | Mode | Evidence |
|---|---:|---|---|
| mobile | 360 | stacked | single-column shell, forms, cards; bounded width |
| tablet | 768 | split | split header, three-column filters, two-card grid |
| desktop | 1280 | wide | three-card grid, two-column diagnostics |

Boundary assertions cover 320, 600, 899, 900, and positive infinity. CSS contains 600px and 900px breakpoints, no fixed four-digit width, `overflow-wrap:anywhere`, and `overflow-x:auto` table containment.

## Static execution-boundary proof

Owned production source is scanned for and excludes:

- browser wallet provider access;
- wallet/signer/transaction/broadcast APIs;
- deployment paths;
- RPC paths;
- `eval` and dynamic `Function` construction;
- child-process execution;
- direct `fetch`, XHR, and WebSocket clients;
- package-install commands;
- workflow paths;
- local/session storage, IndexedDB, and cookie persistence.

Every literal API endpoint found in owned production source is exactly `/api/audit` or begins `/api/audit/`.

## Verification ledger

### Test-first evidence

| Batch | RED | GREEN |
|---|---:|---:|
| sections 1–4 | 8 failed | 8 passed |
| sections 5–8 | 7 failed, 1 pre-existing pass | 8 passed |
| sections 9–12 | 11 failed, 1 pre-existing pass | 12 passed |
| sections 13–16 | 8 failed | 8 passed |
| final cumulative | — | 36 passed |

### Final direct commands

```text
node --test test/audit-phase9-web-contracts-view-models.test.mjs test/audit-phase9-web-routes-lifecycle.test.mjs test/audit-phase9-web-diagnostics-accessibility-client.test.mjs test/audit-phase9-web-e2e-adversarial-static.test.mjs
```

Result: `36 pass`, `0 fail`, `0 skipped`, `0 cancelled`.

```text
node --check <each of 9 owned JavaScript modules>
```

Result: `9/9` syntax-valid.

```text
JSON.parse(three owned package.json files)
JSON.parse(dom-snapshots-v1.json)
JSON.parse(inert-data-v1.json)
```

Result: `5/5` JSON files valid.

```text
git diff --cached --check
```

Result: no whitespace errors in the exact twenty-file owned candidate set.

## Changed-file inventory

1. `apps/audit-web/package.json`
2. `apps/audit-web/src/app.mjs`
3. `apps/audit-web/src/client.mjs`
4. `apps/audit-web/src/layout.mjs`
5. `apps/audit-web/src/pages.mjs`
6. `apps/audit-web/src/render.mjs`
7. `apps/audit-web/src/routes.mjs`
8. `apps/audit-web/src/styles.css`
9. `docs/audit/reviews/2026-08-01-audit-phase9-web-reports-operator-ui-v1.md`
10. `packages/audit-report-view-model/package.json`
11. `packages/audit-report-view-model/src/index.mjs`
12. `packages/audit-ui-contracts/package.json`
13. `packages/audit-ui-contracts/src/index.mjs`
14. `test/audit-phase9-web-contracts-view-models.test.mjs`
15. `test/audit-phase9-web-diagnostics-accessibility-client.test.mjs`
16. `test/audit-phase9-web-e2e-adversarial-static.test.mjs`
17. `test/audit-phase9-web-routes-lifecycle.test.mjs`
18. `test/fixtures/audit-phase9-web/adversarial-v1.mjs`
19. `test/fixtures/audit-phase9-web/dom-snapshots-v1.json`
20. `test/fixtures/audit-phase9-web/inert-data-v1.json`

All paths are authorized by issue #105.

## Residual risks

1. The renderer is validated through dependency-free Node and deterministic DOM assertions rather than a live browser accessibility tree.
2. Transport integration with a future API implementation is intentionally untested; only the injected client contract and inert fixtures are in scope.
3. Visual styling is intentionally minimal and system-native; no external fonts, assets, frameworks, or component dependencies were introduced.
4. URL safety is policy-based and deliberately conservative; future legitimate URL schemes require an explicit reviewed contract change.

None of these residual risks enables execution, leaks hidden resources, persists credentials, or blocks acceptance of the assigned isolated Phase 9 surface.
