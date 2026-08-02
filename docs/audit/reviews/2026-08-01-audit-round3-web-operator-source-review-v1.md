# Round 3 Audit Web / Operator Source Review v1

## Assignment pin

- Repository: `CurveYield/contract-automation`
- Issue: `#116`
- Branch: `audit-round3/web-operator-release-v1`
- Starting SHA: `79d86fe29baabc986f7a38aa8c048efb1379a106`
- Prior issue: `#105`
- Prior decision: `ACCEPT`
- Mailbox sequence: `2`
- Assignment blob: `c0f5ac138f0ba6468d289a098423b8074a708d10`
- Source review performed without dependency installation, compilation, live API/RPC access, project execution, wallets, signers, transactions, deployment, workflow mutation, PR, or merge.

## Starting inventory

### Production application modules

1. `apps/audit-web/src/app.mjs`
2. `apps/audit-web/src/client.mjs`
3. `apps/audit-web/src/layout.mjs`
4. `apps/audit-web/src/pages.mjs`
5. `apps/audit-web/src/render.mjs`
6. `apps/audit-web/src/routes.mjs`
7. `apps/audit-web/src/styles.css`
8. `packages/audit-report-view-model/src/index.mjs`
9. `packages/audit-ui-contracts/src/index.mjs`

### Existing focused tests

1. `test/audit-phase9-web-contracts-view-models.test.mjs`
2. `test/audit-phase9-web-routes-lifecycle.test.mjs`
3. `test/audit-phase9-web-diagnostics-accessibility-client.test.mjs`
4. `test/audit-phase9-web-e2e-adversarial-static.test.mjs`

### Existing inert fixtures

1. `test/fixtures/audit-phase9-web/inert-data-v1.json`
2. `test/fixtures/audit-phase9-web/adversarial-v1.mjs`
3. `test/fixtures/audit-phase9-web/dom-snapshots-v1.json`

## Protected simulation-addon hashes

The following blobs are pinned from the starting SHA and are outside Worker 4 ownership:

| Protected path | Blob SHA |
|---|---|
| `.github/workflows/github-native-simulate.yml` | `54e446d4a715ca9678ed4d7434f7ba90b2c67c96` |
| `packages/github-native-sim/src/cli.mjs` | `17d3a5597bbd83ed155ef115efa2fd2528d2ff0b` |
| `packages/github-native-sim/src/select-job.mjs` | `c0cc36e865d7cfd78464ce3e1ef9012f7194f173` |
| `packages/github-native-sim/src/run-job-file.mjs` | `8c4c82d76e249b74efc630c8cbf0d7707d25b5f2` |
| `packages/github-native-sim/src/fork-rpc-proxy.mjs` | `4d7e2bd1114f5a37914b26447c9c79a1e40a58e6` |
| `packages/github-native-sim/src/chain-fixtures.mjs` | `6a7c9b0e7300765fe9f8485eed4cbdc0fe9ec9db` |
| `packages/github-native-sim/src/ganache-accounts.mjs` | `f1018079c3f552dfb2c6719698296a831efdcd2b` |
| `packages/github-native-sim/src/project.mjs` | `d1529658c7f6dda3ef2f41b255fe99aa66de4a9d` |
| `packages/github-native-sim/src/schema.mjs` | `4efcbf5b8b95a68f8e4d476f299f4f93e951dfd7` |
| `packages/runner/src/rpc-method-policy.mjs` | `59dfa72f41a697d533720a4d8f939a81aeba6736` |
| `packages/runner/src/fork-rpc-guard.mjs` | `73690f16b506baa50ca471ce5b5566ccb601e765` |

Final verification must confirm that no branch diff touches any protected prefix and that each pinned file retains this blob SHA.

## Independent source-review findings

### Confirmed strengths

- Rendering uses explicit HTML escaping at output boundaries.
- Existing routes and view models consistently mark execution unavailable.
- Existing client accepts only an injected transport and rejects external API paths.
- Existing response projection avoids invoking ordinary accessor descriptors.
- Existing tests cover basic XSS, URL schemes, sparse arrays, cycles, cancellation, stale responses, credential-shaped keys, three viewports, reduced motion, and inert read-only flows.
- Existing branch contains no wallet, signing, transaction, broadcast, deployment, RPC endpoint, dynamic-code, workflow-mutation, or persistent credential sink in Worker 4 production paths.

### Observed defects and unproven Round 3 claims

| ID | Finding | Risk / missing proof | RED coverage |
|---|---|---|---|
| R3-WEB-001 | Contract registry omits exports, merges, quotas, retention, operation budgets, profiles, parsers, results, GitHub Direct status, and release provenance. | Service/API compatibility cannot be explicit or version locked. | Source-review test 1 |
| R3-WEB-002 | `Array.isArray`, descriptor reads, and recursive freezing are not guarded against revoked proxies. | Hostile input can throw an uncontrolled native error. | Test 2 |
| R3-WEB-003 | Safe links retain URL fragments. | Secret-bearing or attacker-controlled fragments can enter rendered URLs. | Test 3 |
| R3-WEB-004 | Route matching consumes the full query string and `decodeURIComponent` can throw. | Valid filtered routes become not-found; malformed encodings can crash routing. | Test 4 |
| R3-WEB-005 | Round 3 lifecycle states are missing. | UI can label admitted/model-only/timeout/restore/tombstone states as unknown. | Test 5 |
| R3-WEB-006 | Empty clean-room visible-resource allowlist permits every `visible:true` provenance item. | Hidden-resource non-interference is not fail-closed. | Test 6 |
| R3-WEB-007 | Diagnostic redaction misses `/root` paths and stack-frame attacker names. | Operator diagnostics can disclose host data or attacker-controlled stack text. | Test 7 |
| R3-WEB-008 | Client projection uses ordinary objects and unguarded descriptor reads. | Revoked proxies can fail transport projection; dangerous keys can affect object prototypes. | Test 8 |
| R3-WEB-009 | Identical concurrent GETs cancel and duplicate transport work. | Request deduplication requirement is unmet. | Test 9 |
| R3-WEB-010 | No scoped cache or ETag protocol exists. | Conditional refresh and deterministic offline recovery are unmet. | Test 10 |
| R3-WEB-011 | Application state has no explicit loading/unauthorized kinds, injected history, or state announcements. | History, accessibility, and authorization requirements are unproven. | Test 11 |
| R3-WEB-012 | Report view model drops summary, service references, and cross-resource IDs. | Complete immutable evidence/reference view is unavailable. | Scheduled Checkpoint 2/3 tests |
| R3-WEB-013 | Job error text is bounded but not diagnostic-redacted. | Secrets, paths, URLs, or attacker text may appear in lifecycle pages. | Scheduled Checkpoint 3/4 tests |
| R3-WEB-014 | Existing pages cover only 10 routes. | Profile/parser/result, GitHub Direct status, operations, quota/retention, and release provenance are absent. | Source-review test 4 plus Checkpoint 3 route matrix |
| R3-WEB-015 | Fork view lacks create/restore/tombstone facts and clean-room view lacks access/share facts. | Required lifecycle surfaces are incomplete. | Scheduled Checkpoint 3 tests |
| R3-WEB-016 | Existing diagnostics use `role=alert` for every persisted item. | Screen readers may announce an entire historical diagnostic list as urgent. | Scheduled Checkpoint 4 accessibility tests |
| R3-WEB-017 | Responsive evidence is limited to three widths and CSS token presence. | Zoom, narrow width, large graph, huge count, and partial-data behavior remain unproven. | Scheduled Checkpoint 4 fixtures |
| R3-WEB-018 | No Round 4 handoff manifest or static release inventory exists. | Final integration and deployment inputs are not durable. | Section 20 |

## Observed RED evidence

Command:

```text
node --test test/audit-round3-web-source-review-v1.test.mjs
```

Result against starting source:

- Tests: `11`
- Passed: `0`
- Failed: `11`
- Cancelled: `0`
- Skipped: `0`
- Failures matched the intended missing behavior; no test failed because of a syntax error or unavailable dependency.

## Architecture and compatibility map

```text
Worker 1 API fixture contracts v1 ----\
                                      > audit-web-compat adapter v1
Worker 0 service/report fixtures v1 -/             |
                                                    v
                               strict audit-ui-contracts v2
                                                    |
                                                    v
                         canonical audit-report-view-model v2
                                                    |
                     +------------------------------+-------------------+
                     |                              |                   |
                     v                              v                   v
              route registry                page renderers       diagnostics
                     |                              |                   |
                     +------------------------------+-------------------+
                                                    |
                                                    v
                                      audit application state
                                                    |
                                                    v
                                  injected execution-disabled client
                                      cancellation / dedup / ETag
                                          scoped in-memory cache
```

Compatibility rules:

1. Adapter inputs are inert repository fixtures with explicit schema/version strings.
2. Adapter code imports no Worker 0, Worker 1, Worker 2, or Worker 3 implementation modules.
3. Unsupported versions fail closed with stable UI compatibility errors.
4. Output uses Worker 4 strict contracts only.
5. No adapter enables project execution or claims an executor is present.
6. Cache is in-memory, scope keyed, bounded, and never stores credential-shaped fields.
7. Hidden resources must be explicitly allowlisted before they enter a view model.

## Page / route map target

| Route family | Main views | Execution truth |
|---|---|---|
| reports | list, filter, sort, pagination, detail, evidence, references | unavailable |
| workspaces | list and workspace summary | unavailable |
| campaigns/jobs | complete lifecycle state views | unavailable |
| forks | create status, checkpoints, exports, restore, delete, tombstone | unavailable |
| clean room | access, share, merge, visible provenance | unavailable |
| profiles/parsers/results | compatibility discovery and result summaries | unavailable |
| catalog | capability and tool discovery | unavailable |
| GitHub Direct | status only | unavailable |
| operations | quota, retention, operation budget | unavailable |
| diagnostics | redacted operator recovery facts | unavailable |
| release | compatibility versions and candidate provenance | unavailable |
| unmatched / unauthorized | bounded state pages | unavailable |

## Client-state target

`idle -> loading -> ready | empty | unauthorized | error | offline-stale`

- A newer navigation makes older responses stale.
- Identical in-flight reads share one transport operation.
- Different resources in the same route slot cancel the prior operation.
- ETag values are bounded opaque validators.
- A `304` can use only the matching scoped cache entry.
- Offline fallback is opt-in and announces stale data.
- Cache and request state never persist outside process memory.

## Accessibility baseline and target

Existing baseline: language, viewport metadata, skip link, primary navigation label, one page heading, focusable main region, table captions/scopes, visible focus, overflow containers, and reduced-motion CSS.

Round 3 target adds: explicit loading/authorization/offline announcements, non-urgent persisted diagnostics, deterministic focus restoration, history semantics, bounded accessible descriptions, contrast tokens/documentation, forced-colors support, zoom/narrow-width fixtures, and a manual screen-reader checklist that clearly distinguishes executed static checks from browser-only review steps.

## Ordered implementation batches

1. **Checkpoint 1:** source review, observed RED suite, maps, protected hashes.
2. **Checkpoint 2:** contracts, defensive view models, compatibility adapter, routes, state truth.
3. **Checkpoint 3:** complete report/lifecycle/fork/clean-room/catalog/operations/release views and inert fixtures.
4. **Checkpoint 4:** diagnostics, client cache/races, accessibility, responsive/hostile layout corpus.
5. **Checkpoint 5:** E2E/adversarial/static suite, release candidate review, Round 4 handoff manifest, final verification.
