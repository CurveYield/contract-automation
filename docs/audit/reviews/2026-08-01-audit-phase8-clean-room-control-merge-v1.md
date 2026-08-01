# Phase 8 Clean-Room Control and Controlled Merge Review v1

## Disposition

**Recommendation: ACCEPT**

The isolated Phase 8 control/storage implementation satisfies all eighteen ordered work sections from issue #91. It implements tenant/workspace/campaign authorization, exact visibility and immutable base-artifact sharing, hidden-resource non-interference, terminal campaign manifests, deterministic controlled merge state, duplicate/conflict relations, provenance, merged-report references, exact-key storage planning, quota/retention/recovery controls, multi-tenant end-to-end scenarios, hostile-boundary validation, and static execution/confidentiality gates.

Phase 8 integration remains gated on independently accepted Phase 7. This branch does not execute submitted projects, external audit tools, processes, containers, network/RPC requests, transactions, or deployments.

## Repository state

- Repository: `CurveYield/contract-automation`
- Worker: `worker-3`
- Issue: `#91`
- Branch: `audit-phase8/clean-room-control-merge-v1`
- Required starting SHA: `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c`
- Implementation candidate SHA before this review file: `dd1067192835b8e3e6363ebb1fbb0a2f3ef0f323`
- Exact final branch SHA: recorded in the final issue report, Worker 3 completed status, and completion event after this review commit. A commit cannot truthfully contain its own Git SHA.
- Candidate comparison: 23 commits ahead, 0 behind, merge base equal to the required starting SHA.
- Candidate changed-file count: 20 before this review; 21 including this review.

## Package and interface map

### `packages/audit-clean-room-protocol`

`src/boundary.mjs` owns Phase 8-local hostile object boundaries and canonicalization:

- plain ordinary/null-prototype objects only;
- dense ordinary arrays only;
- exact keys and bounded collections;
- canonical identifiers, paths, timestamps, digests, strings, booleans, enums, and safe integers;
- negative-zero, NaN, Infinity, unsafe integer, control-character, sparse-array, accessor, symbol, class/custom-prototype, cycle, nesting, and hostile-reflection rejection;
- deterministic canonical JSON, SHA-256 identities, defensive clones, and recursive freezing.

`src/index.mjs` exports:

- `createCleanRoomPolicy` / `validateCleanRoomPolicy`;
- `createCampaignAccessContext` / `validateCampaignAccessContext`;
- `createShareGrant` / `validateShareGrant`;
- `createShareGrantRevocation` / `validateShareGrantRevocation`;
- strict reference-list validation and all boundary utilities.

### `packages/audit-clean-room-access`

`src/index.mjs` exports:

- `authorizeCampaignAccess` / `validateAccessDecision`;
- `decideResourceVisibility` / `validateVisibilityDecision`;
- `createHiddenResourceEnvelope`;
- `enforceHiddenResourceNonInterference`;
- `planScopedStorageKeys`;
- `planConditionalIndexUpdate`.

### `packages/audit-clean-room-campaigns`

`src/index.mjs` exports:

- `createTerminalCampaignManifest`;
- `validateTerminalCampaignManifest`;
- `terminalEligibility`.

### `packages/audit-controlled-merge`

`src/index.mjs` is a stable facade over three responsibility-focused modules.

`src/request-state.mjs` exports:

- `createMergeRequest` / `validateMergeRequest`;
- `createInitialMergeState` / `validateMergeState`;
- `transitionMergeState`;
- `validateMergeEvent`.

`src/relations.mjs` exports:

- `buildRelationMaps`;
- `createDuplicateRelation` / `validateDuplicateRelation`;
- `createConflictRelation` / `validateConflictRelation`.

`src/publication-storage.mjs` exports:

- `createMergeManifest` / `validateMergeManifest`;
- `planMergeStorageTransaction`;
- `rebuildMergeIndex`.

### `packages/audit-provenance`

`src/index.mjs` exports:

- `createProvenanceNode` / `validateProvenanceNode`;
- `createProvenanceEdge` / `validateProvenanceEdge`;
- `createProvenanceIndex` / `validateProvenanceIndex`;
- `traceAuthorizedOrigins`;
- `createMergedReportReference` / `validateMergedReportReference`.

## Test-first evidence

### Initial interface red

Command:

```text
node --test test/audit-phase8-clean-room-interfaces-red-v1.test.mjs
```

Result before production packages existed:

```text
5 tests
0 passed
5 failed
```

All failures were the expected absent package/interface failures.

### Sections 2–7 behavior red

```text
12 tests
5 passed
7 failed
```

The failures demonstrated builder/validator schema-boundary defects before repair.

### Sections 8–11 behavior red

```text
10 tests
4 passed
6 failed
```

The failures demonstrated terminal-manifest builder/validator reconstruction defects before repair.

### Sections 12–14 behavior red

```text
10 tests
3 passed
7 failed
```

Six failures demonstrated provenance/report validator reconstruction defects. One demonstrated incomplete operation accounting when a three-input merge read only two terminal manifests.

### Hostile-reflection red

The adversarial corpus demonstrated that a revoked proxy could escape `Array.isArray()` as a raw `TypeError`. The Phase 8 boundary now converts this and other reflection traps to bounded `hostile_reflection` errors without invoking caller accessors.

## Final verification

Fresh command:

```text
node --test \
  test/audit-phase8-clean-room-interfaces-red-v1.test.mjs \
  test/audit-phase8-clean-room-protocol-access-v1.test.mjs \
  test/audit-phase8-controlled-merge-relations-v1.test.mjs \
  test/audit-phase8-provenance-storage-publication-v1.test.mjs \
  test/audit-phase8-end-to-end-multi-tenant-v1.test.mjs \
  test/audit-phase8-clean-room-adversarial-v1.test.mjs \
  test/audit-phase8-clean-room-static-boundary-v1.test.mjs
```

Result:

```text
54 tests
54 passed
0 failed
0 cancelled
0 skipped
```

Additional gates:

```text
production_mjs_files=9
syntax_failures=0
fixture_json_files=4
static_prohibited_capability_matches=0
diff_check=clean
owned_paths_only=true
```

## Authorization truth table

| Condition | Result | Stable reason |
|---|---|---|
| Same tenant/workspace/campaign and every exact scope present | Allow | `allowed` |
| Tenant differs | Deny | `tenant_mismatch` |
| Workspace differs | Deny | `workspace_mismatch` |
| Campaign differs | Deny | `campaign_mismatch` |
| Required exact scope absent | Deny | `scope_missing` |
| Wildcard or caller-authored decision field | Reject input | bounded validation code/path |

Authorization decisions bind server-owned context identities, requester ID, role/state, policy ID, required scopes, resource class, and decision timestamp. Request-provided booleans cannot authorize access.

## Sharing and visibility truth table

Twelve resource classes are covered: source manifest, base artifact, layer, job, attempt, log, artifact, evidence, report, fork reference, notification, and search entry.

| Resource relationship | Visibility |
|---|---|
| Campaign-owned resource in exact scope | Visible |
| Foreign campaign-private resource | Hidden |
| Exact immutable base artifact with valid same-scope grant | Visible |
| Base artifact with digest/source/campaign drift | Hidden |
| Campaign derivative under a base-artifact grant | Hidden |
| Expired grant | Hidden |
| Revoked grant after revocation timestamp | Hidden |
| Missing or cross-scope grant target | Hidden |

Grant records bind exact tenant, workspace, source campaign, target campaign, artifact ID, artifact digest, source digest, issue time, and expiry. Revocation is an immutable record and does not rewrite historical provenance. Transitive sharing and mutable aliases such as `latest` are rejected.

## Hidden-resource non-interference matrix

For hidden-existing versus absent resources, the deterministic response model is byte-identical across all thirteen caller-observable fields:

1. status;
2. code;
3. message;
4. item array;
5. total count;
6. facets;
7. notifications;
8. signed-resource planning;
9. relation hints;
10. cache tag/ETag class;
11. Class A operation count;
12. Class B/byte operation summary;
13. timing class.

Authorized provenance tracing also returns byte-identical `not_found` envelopes for hidden and absent nodes. No wall-clock timing benchmark is used; operation traces and response classes are compared explicitly.

## Terminal campaign eligibility table

| Terminal state | Completion kind | Partial/truncated truth | Merge eligible |
|---|---|---|---|
| `completed` | `success` | neither | Yes |
| `completed` | `findings` | neither | Yes |
| `completed` | `partial` | partial evidence true | Yes |
| `completed` | `truncated` | truncated true | Yes |
| `failed` | `failed` | explicit | No |
| `cancelled` | `cancelled` | explicit | No |
| `policy_rejected` | `policy_rejected` | explicit | No |

Inventories are derived from immutable finding/evidence references. Identity, digest, inventory, and eligibility drift are rejected. Original campaign objects remain unchanged.

## Merge state transition table

Canonical successful path:

```text
requested
  -> validating
  -> admitted
  -> resolving_relations
  -> building_provenance
  -> publishing
  -> completed
```

Failure, cancellation, and policy-rejection transitions are allowed only from their specified nonterminal states. Completed, failed, cancelled, and policy-rejected states are terminal. Every state transition requires an exact ETag precondition and creates an immutable event with a deterministic ID and digest. Stale writes and invalid transitions are rejected.

## Duplicate and conflict relations

### Duplicate relation identity

Comparison input is the normalized finding identity key plus material fields: severity, status, remediation, location, and material digest. Exact material duplicates are grouped without deleting or rewriting originals.

Every duplicate member retains:

- source campaign ID;
- original finding ID;
- original material digest;
- every evidence reference.

### Conflict relation identity

Findings with one comparison identity but differing severity, status, remediation, location, or material digest create a conflict relation. The relation records stable conflicting field names and every competing value/source. It performs no semantic resolution or confidence scoring.

Relation group/member IDs and digests are deterministic and byte-identical under complete finding-order reversal. A comparison key may contain an exact duplicate subgroup and a conflict simultaneously without first-record-wins data loss.

## Provenance model

Supported node types include source, workspace, base artifact, campaign, layer, job, attempt, finding, evidence, report, duplicate/conflict relation, merge request/attempt/manifest, and merged-report reference.

Supported edge types include derived-from, belongs-to, produced, supports, reported-by, member-of, merged-into, and references.

Acceptance gates cover:

- exact node/edge schemas;
- deterministic canonical ordering;
- node and edge validator replay;
- referential integrity;
- dangling-reference rejection;
- conflicting-node and duplicate-node rejection;
- tenant/workspace substitution rejection;
- cycle rejection;
- hidden-campaign filtering during authorized origin tracing.

Representative tested graphs include a 3-node/2-edge graph and a 5-node/4-edge multi-campaign visibility graph.

## Merge manifest and report publication

Merge manifests pin:

- merge request identity/digest;
- final state;
- sorted terminal-manifest digests;
- duplicate-map digest;
- conflict-map digest;
- provenance-index digest;
- sorted merged-report references;
- policy ID;
- exact operation summary;
- publication timestamp.

Merged-report references point to immutable approved report and evidence digests. They distinguish complete, partial, cancelled, and policy-rejected sources. They do not copy or mutate original evidence. Script/iframe/object content, raw HTTP URLs, authorization/bearer material, private-key labels, and Windows/POSIX host paths are rejected.

## Storage operation, quota, retention, and recovery tables

### Operation scenarios

| Scenario | Class A | Class B | Retained bytes | Retention | Variant |
|---|---:|---:|---:|---:|---|
| Typical two-input merge | 4 | 4 | 2,000,000 | 90 days | `typical-4a-4b-2mb-90d` |
| Three-input partial-write retry | 4 | 5 | 2,500,000 | 60 days | `idempotent-retry` |
| Conditional server-owned index update | 1 | 1 | bounded input | policy-bound | exact CAS |

The planner reads every approved terminal manifest, exact current state, and the exact server-owned index key. It creates immutable request/event, relation/provenance, and manifest objects, then conditionally updates current/index state. No prefix listing exists.

### Quotas and recovery

The implementation enforces merge input count, retained bytes, retention days, collection sizes, string sizes, safe integers, and nesting limits. Existing immutable digests are recorded for retry; immutable writes are retry-safe; stale current/index updates are rejected. Index rebuild accepts only approved immutable manifest entries, sorts deterministically, and does not discover hidden campaigns.

## End-to-end fixture inventory

Four valid JSON files are present:

1. `fixture-manifest-v1.json` — complete unique inventory;
2. `multi-tenant-campaigns-v1.json` — two tenants, three workspaces, same-name hidden campaigns, six terminal campaign variants, active/revoked/expired grants;
3. `relation-scenarios-v1.json` — exact duplicates, conflict member, unrelated finding, immutable evidence attribution;
4. `storage-recovery-v1.json` — typical operations, three-input retry, stale pointer, and quota rejection.

The end-to-end suite proves validation, authorization, non-interference, terminal manifests, merge admission, relation maps, provenance, report publication, storage planning, stale-write rejection, retry, and full input reversal. It creates no executable workload.

## Adversarial and mutation corpus

The suite performs **176 one-field invalid mutations** across seventeen public output contracts:

- policy;
- access context;
- share grant;
- share revocation;
- access decision;
- visibility decision;
- terminal manifest;
- merge request;
- merge state;
- merge event;
- duplicate relation;
- conflict relation;
- provenance node;
- provenance edge;
- provenance index;
- merged-report reference;
- merge manifest.

Additional hostile cases cover tenant/workspace/campaign/source/digest substitution, extra/missing fields, invalid timestamps, unsafe paths, control characters, oversized/duplicate collections, negative zero, NaN, Infinity, unsafe integers, accessors, symbols, class/custom prototypes, sparse arrays, cycles, throwing proxies, and revoked proxies. Rejections return stable bounded codes and paths.

## Static execution and confidentiality boundary

All nine production `.mjs` sources were scanned. Matches: **0**.

Forbidden capabilities include:

- process/child process/worker thread/shell/command/script execution;
- filesystem reads, writes, or repository enumeration;
- network, HTTP, fetch, DNS, sockets, WebSocket, RPC, or arbitrary URL access;
- package installation, containers/images/binaries, dynamic code, or workflows;
- credentials, keys, mnemonics, wallets, signing, transactions, calldata, broadcasts, or deployment;
- direct Cloudflare/AWS SDK coupling;
- CurveYield Lite imports;
- execution-enablement state.

The only Node built-in production dependency is `node:crypto` for deterministic SHA-256 identities. Fixture scanning found no authorization header, bearer token, private key, mnemonic, API key, raw URL, or host-path leakage.

## Exact changed files and responsibilities

### Production

- `packages/audit-clean-room-protocol/src/boundary.mjs` — strict hostile boundary, canonicalization, SHA identities, defensive freeze.
- `packages/audit-clean-room-protocol/src/index.mjs` — policy, access context, share grants/revocations.
- `packages/audit-clean-room-access/src/index.mjs` — authorization, visibility, hidden envelopes, scoped keys, CAS index planning.
- `packages/audit-clean-room-campaigns/src/index.mjs` — immutable terminal campaign manifests and eligibility.
- `packages/audit-controlled-merge/src/index.mjs` — stable package facade.
- `packages/audit-controlled-merge/src/request-state.mjs` — requests, state, events, CAS transitions.
- `packages/audit-controlled-merge/src/relations.mjs` — duplicate/conflict relation maps and validators.
- `packages/audit-controlled-merge/src/publication-storage.mjs` — merge manifests, operation planning, deterministic index rebuild.
- `packages/audit-provenance/src/index.mjs` — provenance graph, tracing, merged-report references.

### Focused tests

- `test/audit-phase8-clean-room-interfaces-red-v1.test.mjs`
- `test/audit-phase8-clean-room-protocol-access-v1.test.mjs`
- `test/audit-phase8-controlled-merge-relations-v1.test.mjs`
- `test/audit-phase8-provenance-storage-publication-v1.test.mjs`
- `test/audit-phase8-end-to-end-multi-tenant-v1.test.mjs`
- `test/audit-phase8-clean-room-adversarial-v1.test.mjs`
- `test/audit-phase8-clean-room-static-boundary-v1.test.mjs`

### Fixtures

- `test/fixtures/audit-phase8/fixture-manifest-v1.json`
- `test/fixtures/audit-phase8/multi-tenant-campaigns-v1.json`
- `test/fixtures/audit-phase8/relation-scenarios-v1.json`
- `test/fixtures/audit-phase8/storage-recovery-v1.json`

### Review

- `docs/audit/reviews/2026-08-01-audit-phase8-clean-room-control-merge-v1.md`

## Blocked and intentionally unperformed checks

Not performed because prohibited or outside this isolated package:

- dependency installation or download;
- package-manager, compilation, or build commands;
- submitted project or external audit-tool execution;
- process/container/image execution;
- Cloudflare/R2 live calls, GitHub Direct execution, arbitrary network/RPC calls;
- wallet/signing/transaction/deployment operations;
- API/web integration changes;
- Phase 7 integration or merge;
- workflow creation or approval;
- main-branch merge.

## Residual risks

- Phase 8 is an isolated deterministic control/storage model; deployment-specific R2 adapters and API routes require later integration review.
- Operation accounting is a truthful planner model and must be rechecked against the final storage adapter implementation.
- Hidden-resource timing is modeled by explicit response and operation classes; production infrastructure must preserve those classes without adding distinguishable latency branches.
- Future finding schemas may require a separately versioned comparison-identity policy rather than widening the current contracts.
- Phase 8 cannot integrate until Phase 7 is independently accepted.

## Final recommendation

**ACCEPT**

All eighteen ordered sections, four-fixture inventory, multi-tenant scenario suite, 176-field mutation corpus, non-interference gates, operation-accounting scenarios, and static security boundaries are implemented and verified within exclusive Phase 8 ownership.
