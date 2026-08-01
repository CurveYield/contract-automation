# Phase 8 Clean-Room Control and Controlled Merge Review v1 — Superseding Repair

## Disposition

**Recommendation: ACCEPT**

This review supersedes the earlier completion candidate at `9b8c81631f6f75d3d888563071cab2ec709fb53d` and its issue report. Orchestrator source review comment `5152426552` identified eight mandatory checkpoint-1 defects that had not been incorporated before that completion was reported. Worker 3 reopened mailbox sequence `4`, reproduced all eight defects test-first, repaired them in the same assigned branch, reran the entire Phase 8 acceptance corpus, and preserved the original Phase 8 implementation boundaries.

Phase 8 remains an isolated control/storage implementation. It does not execute submitted projects, tools, scripts, processes, containers, RPC calls, transactions, deployments, workflows, or source-code merges. Integration remains gated on independent Phase 7 acceptance.

## Repository and assignment state

- Repository: `CurveYield/contract-automation`
- Worker: `worker-3`
- Issue: `#91`
- Mailbox sequence: `4`
- Message ID: `worker-3-phase8-clean-room-control-merge-v1-000004`
- Branch: `audit-phase8/clean-room-control-merge-v1`
- Required starting SHA: `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c`
- Superseded candidate SHA: `9b8c81631f6f75d3d888563071cab2ec709fb53d`
- Mandatory repair comment: `https://github.com/CurveYield/contract-automation/issues/91#issuecomment-5152426552`
- Repair implementation head before this review update: `68e32d077f6cbf92efc3c7f0c636a12c0634d59a`
- Exact repaired final SHA: recorded in the superseding final issue report, completed mailbox status, and repair-completion event after this review update.
- Expected repaired changed-file inventory: 34 files — 21 production modules, 8 focused tests, 4 inert fixtures, and this review.

## Package and module map

### Clean-room protocol — `packages/audit-clean-room-protocol/src`

| Module | Responsibility |
|---|---|
| `index.mjs` | Stable export-only facade. |
| `boundary.mjs` | Hostile reflection boundary, canonical values, UTF-8 byte limits, defensive clone/freeze, canonical hashing entrypoint. |
| `digest.mjs` | Runtime-neutral synchronous SHA-256 and UTF-8 byte utilities using standard JavaScript only. |
| `constants.mjs` | Versioned schemas, scopes, roles, and campaign states. |
| `policy.mjs` | Clean-room policy builder and validator. |
| `access-context.mjs` | Campaign access-context builder and validator. |
| `grants.mjs` | Immutable base-artifact grants and revocation records. |
| `references.mjs` | Strict immutable reference-list validation. |

### Clean-room access — `packages/audit-clean-room-access/src`

| Module | Responsibility |
|---|---|
| `index.mjs` | Stable export-only facade. |
| `constants.mjs` | Resource kinds, decision reasons, and closed role/state read matrix. |
| `authorization.mjs` | Exact tenant/workspace/campaign authorization and read-scope/role-state gate. |
| `visibility.mjs` | Resource visibility and fully validated grant/revocation evaluation. |
| `non-interference.mjs` | Byte-stable hidden-resource envelope and enforcement contract. |
| `storage-keys.mjs` | Deterministic scoped object and server-owned index key derivation. |
| `index-planning.mjs` | Conditional server-owned index mutation planning and canonical operation traces. |

### Terminal campaigns — `packages/audit-clean-room-campaigns/src/index.mjs`

Owns immutable terminal campaign manifests, derived inventories, terminal semantics, deterministic identity/digest, and merge eligibility.

### Controlled merge — `packages/audit-controlled-merge/src`

| Module | Responsibility |
|---|---|
| `index.mjs` | Stable export facade. |
| `request-state.mjs` | Merge requests, state, events, CAS transitions, and validation. |
| `relations.mjs` | Duplicate/conflict relation construction, attribution, and validation. |
| `publication-storage.mjs` | Merge manifests, canonical `class-a`/`class-b` transaction planning, quotas, retries, and deterministic index rebuild. |

### Provenance — `packages/audit-provenance/src/index.mjs`

Owns provenance nodes, edges, indexes, referential integrity, cycle rejection, authorized origin tracing, and merged-report references.

## Mandatory repair evidence

### Red command

```text
node --test test/audit-phase8-clean-room-checkpoint1-repair-v1.test.mjs
```

Result against the untouched superseded completion candidate:

```text
8 tests
0 passed
8 failed
```

Each failing test mapped one-to-one to an orchestrator repair item.

### Repair matrix

| Item | Red behavior | Repaired behavior | Focused green |
|---|---|---|---:|
| 1. Caller-selected index key | Caller supplied arbitrary `indexKey`. | Input accepts validated tenant/workspace/campaign plus closed `indexKind`; exact index key is server-derived. | 1/1 |
| 2. Visibility authorization bypass | Identity match alone exposed campaign resources. | Visibility requires `campaign:read` and a closed allowed role/state combination before any own-resource or grant evaluation. | 1/1 |
| 3. Non-strict grant arrays | Sparse/custom arrays and malformed unrelated records could escape full validation. | Grants and revocations use bounded ordinary dense-array validation and every entry is validated before matching. | 1/1 |
| 4. Hostile reflection | Throwing/revoked proxies could escape as raw trap errors. | All relevant reflection is guarded and returns stable `hostile_reflection`. | 1/1 |
| 5. Unused byte limit | `LIMITS.bytes` did not constrain canonical output. | Canonical JSON, cloning, freezing, and hashing enforce exact UTF-8 encoded bytes. | 1/1 |
| 6. Node-only digest | Production imported `node:crypto`. | Pure standard-JavaScript SHA-256 uses `TextEncoder`; production has zero Node built-in imports. | 1/1 |
| 7. Operation-class drift | Traces used `A` and `B`. | Index and merge traces use exact `class-a` and `class-b` vocabulary. | 1/1 |
| 8. Oversized facades | Independent responsibilities were compressed into large `index.mjs` files. | Protocol and access responsibilities are split into 15 focused modules with export-only facades. | 1/1 |

Focused repair result:

```text
8 tests
8 passed
0 failed
```

## Hostile-object matrix

The repair-specific matrix contains these direct cases:

1. throwing ordinary-object `ownKeys` proxy;
2. revoked ordinary-object proxy;
3. revoked array proxy;
4. throwing array `ownKeys` proxy;
5. sparse grant array;
6. custom-prototype grant array;
7. malformed unrelated grant entry;
8. malformed unrelated revocation entry.

The broader adversarial corpus additionally covers accessors, symbols, class instances, custom object prototypes, cycles, negative zero, NaN, Infinity, unsafe integers, control characters, unsafe paths, oversized collections, duplicate identities, and cross-scope substitution. All rejections use bounded stable code/path data and do not reflect attacker-controlled text.

## Authorization and visibility truth tables

### Exact authorization identity/scope cases

| Condition | Decision | Stable reason |
|---|---|---|
| Exact tenant/workspace/campaign and all required scopes | Allow | `allowed` |
| Tenant differs | Deny | `tenant_mismatch` |
| Workspace differs | Deny | `workspace_mismatch` |
| Campaign differs | Deny | `campaign_mismatch` |
| Exact required scope missing | Deny | `scope_missing` |
| Wildcard/caller-authored decision | Reject input | bounded schema error |

### Read scope, role, and campaign-state matrix

Every role/state combination is tested both with and without `campaign:read`, for 24 repair-specific cases.

| Role | `active` | `terminal` | `archived` |
|---|---:|---:|---:|
| `owner` | Allow | Allow | Allow |
| `reviewer` | Allow | Allow | Allow |
| `operator` | Allow | Allow | Deny `role_state_denied` |
| `reader` | Allow | Allow | Allow |

Removing `campaign:read` denies all twelve role/state combinations with `scope_missing`.

### Resource visibility

Twelve resource classes are covered: source manifest, base artifact, layer, job, attempt, log, artifact, evidence, report, fork reference, notification, and search entry.

| Resource relationship | Result |
|---|---|
| Exact campaign-owned resource with read authorization | Visible |
| Same identities without read scope | Hidden |
| Disallowed role/state | Hidden |
| Foreign campaign-private resource | Hidden |
| Exact immutable base artifact with valid same-scope grant and read authorization | Visible |
| Base-artifact digest/source/campaign drift | Hidden |
| Campaign derivative under base grant | Hidden |
| Expired or revoked grant | Hidden |
| Missing/cross-scope grant | Hidden |

## Derived storage key and operation-class tables

### Closed index kinds

| `indexKind` | Derived key suffix |
|---|---|
| `campaigns` | `indexes/campaigns-v1.json` |
| `share-grants` | `indexes/share-grants-v1.json` |
| `merges` | `indexes/merges-v1.json` |

The full key is always derived as:

```text
tenants/{tenantId}/workspaces/{workspaceId}/{suffix}
```

`planConditionalIndexUpdate()` no longer accepts `indexKey`. Unknown fields and unsupported kinds are rejected before a plan is produced.

### Operation vocabulary

| Operation | Class |
|---|---|
| `GetObject` / exact authoritative read | `class-b` |
| `PutObject` / conditional or immutable write | `class-a` |

Conditional index update remains one `class-b` read plus one `class-a` write. A typical two-input merge remains four Class B-equivalent reads and four Class A-equivalent writes, with every trace entry carrying the canonical string vocabulary.

## Exact encoded-byte boundary cases

`LIMITS.bytes` is 20,000,000 encoded UTF-8 bytes.

| Case | Encoded canonical JSON size | Result |
|---|---:|---|
| ASCII string sized to boundary | 20,000,000 | Accept |
| Same ASCII string plus one byte | 20,000,001 | Reject `encoded_bytes_exceeded` |
| Multibyte `é` string sized to boundary | 20,000,000 | Accept |
| Same multibyte string plus one character | 20,000,002 | Reject `encoded_bytes_exceeded` |

The limit is checked before returned canonical JSON, before defensive clone/freeze completion, and before hashing canonical structured values.

## Runtime-neutral digest verification

Production imports no `node:` modules. The pure JavaScript SHA-256 implementation was compared with Node's independent reference implementation for five vectors:

1. empty string;
2. `abc`;
3. `hello world`;
4. multibyte `é🙂`;
5. one million `x` characters.

All five digests matched byte-for-byte. The standard known vector for `abc` is also pinned directly in the repair suite.

## Hidden-resource non-interference

Hidden-existing and absent resources remain byte-identical across thirteen caller-observable surfaces:

1. status;
2. code;
3. message;
4. item array;
5. total count;
6. facets;
7. notifications;
8. signed-resource planning;
9. duplicate/conflict hints;
10. cache/ETag class;
11. Class A operation count;
12. Class B and byte summary;
13. deterministic timing class.

Authorized provenance tracing likewise emits the same bounded `not_found` result for absent and hidden nodes.

## Terminal campaign and controlled merge tables

### Terminal campaign eligibility

| Terminal state | Completion kind | Merge eligible |
|---|---|---:|
| `completed` | `success` | Yes |
| `completed` | `findings` | Yes |
| `completed` | `partial` | Yes |
| `completed` | `truncated` | Yes |
| `failed` | `failed` | No |
| `cancelled` | `cancelled` | No |
| `policy_rejected` | `policy_rejected` | No |

### Canonical merge state path

```text
requested
  -> validating
  -> admitted
  -> resolving_relations
  -> building_provenance
  -> publishing
  -> completed
```

Every transition requires exact CAS state and emits an immutable deterministic event. Stale writes, invalid terminal transitions, implicit campaign discovery, and request-selected executable algorithms are rejected.

## Duplicate, conflict, and provenance guarantees

- Exact duplicates become deterministic relation groups without deleting or rewriting original findings or evidence.
- Materially different records with one comparison identity become conflict relations retaining every competing campaign, finding, field value, material digest, and evidence reference.
- Relation output is byte-identical under complete input reversal.
- Provenance nodes and edges are exact, sorted, frozen, and referentially validated.
- Dangling references, conflicting/duplicate nodes, cross-scope nodes, and cycles are rejected.
- Authorized origin tracing filters hidden campaign nodes and edges.
- Merged-report references point to immutable approved report/evidence digests and reject script content, URLs, credential text, and host paths.

## Storage, quota, retention, and recovery

| Scenario | Class A | Class B | Retained bytes | Retention | Variant |
|---|---:|---:|---:|---:|---|
| Typical two-input merge | 4 | 4 | 2,000,000 | 90 days | `typical-4a-4b-2mb-90d` |
| Three-input partial-write retry | 4 | 5 | 2,500,000 | 60 days | `idempotent-retry` |
| Conditional server-owned index update | 1 | 1 | bounded | policy-bound | exact CAS |

The planner reads every approved terminal manifest, exact current state, and exact server-owned index. It creates immutable request/event, relation/provenance, and manifest records, then conditionally updates current/index state. No prefix listing or silent operation omission is possible. Input count, retained bytes, retention days, collection sizes, nesting, and immutable retry digests are bounded.

## Fixture and end-to-end inventory

Four inert JSON fixtures cover two tenants, three workspaces, multiple campaigns, matching hidden identifiers, active/revoked/expired grants, six terminal variants, duplicates, conflicts, unrelated findings, immutable evidence, stale writes, retry, and quota rejection.

The end-to-end path validates authorization, visibility, non-interference, terminal manifests, merge admission, relations, provenance, report references, publication, storage traces, retry, stale writes, and complete input reversal without executing a workload.

## Adversarial and mutation totals

- Existing one-field invalid mutations: 176 across 17 public result contracts.
- Mandatory repair-specific tests: 8.
- Repair-specific scope/role/state visibility cases: 24.
- Repair-specific hostile/array cases: 8.
- Runtime digest reference vectors: 5.
- Encoded-byte boundary cases: 4.

## Final verification

Command:

```text
node --test test/audit-phase8-*.test.mjs
```

Fresh result after all mandatory repairs:

```text
62 tests
62 passed
0 failed
0 cancelled
0 skipped
```

Additional fresh gates:

```text
production_mjs_files=21
syntax_failures=0
fixture_json_files=4
sha256_reference_vectors=5
node_runtime_import_matches=0
legacy_A_B_operation_label_matches=0
static_prohibited_capability_matches=0
diff_check=clean
owned_paths_only=true
```

## Static execution and confidentiality boundary

All 21 production modules were scanned. There are zero matches for filesystem/repository enumeration, process/shell/worker execution, network/HTTP/RPC/fetch/DNS/socket access, package managers, containers, dynamic code, cloud SDK coupling, credentials, wallets, signing, transactions, deployment, arbitrary URLs, CurveYield Lite imports, or execution-enablement states.

The previous `node:crypto` exception has been removed. Production code is runtime-neutral standard JavaScript.

## Exact changed-file inventory

### Production — 21 modules

- `packages/audit-clean-room-protocol/src/index.mjs`
- `packages/audit-clean-room-protocol/src/boundary.mjs`
- `packages/audit-clean-room-protocol/src/digest.mjs`
- `packages/audit-clean-room-protocol/src/constants.mjs`
- `packages/audit-clean-room-protocol/src/policy.mjs`
- `packages/audit-clean-room-protocol/src/access-context.mjs`
- `packages/audit-clean-room-protocol/src/grants.mjs`
- `packages/audit-clean-room-protocol/src/references.mjs`
- `packages/audit-clean-room-access/src/index.mjs`
- `packages/audit-clean-room-access/src/constants.mjs`
- `packages/audit-clean-room-access/src/authorization.mjs`
- `packages/audit-clean-room-access/src/visibility.mjs`
- `packages/audit-clean-room-access/src/non-interference.mjs`
- `packages/audit-clean-room-access/src/storage-keys.mjs`
- `packages/audit-clean-room-access/src/index-planning.mjs`
- `packages/audit-clean-room-campaigns/src/index.mjs`
- `packages/audit-controlled-merge/src/index.mjs`
- `packages/audit-controlled-merge/src/request-state.mjs`
- `packages/audit-controlled-merge/src/relations.mjs`
- `packages/audit-controlled-merge/src/publication-storage.mjs`
- `packages/audit-provenance/src/index.mjs`

### Focused tests — 8 files

- `test/audit-phase8-clean-room-checkpoint1-repair-v1.test.mjs`
- `test/audit-phase8-clean-room-interfaces-red-v1.test.mjs`
- `test/audit-phase8-clean-room-protocol-access-v1.test.mjs`
- `test/audit-phase8-clean-room-adversarial-v1.test.mjs`
- `test/audit-phase8-clean-room-static-boundary-v1.test.mjs`
- `test/audit-phase8-controlled-merge-relations-v1.test.mjs`
- `test/audit-phase8-provenance-storage-publication-v1.test.mjs`
- `test/audit-phase8-end-to-end-multi-tenant-v1.test.mjs`

### Inert fixtures — 4 files

- `test/fixtures/audit-phase8/fixture-manifest-v1.json`
- `test/fixtures/audit-phase8/multi-tenant-campaigns-v1.json`
- `test/fixtures/audit-phase8/relation-scenarios-v1.json`
- `test/fixtures/audit-phase8/storage-recovery-v1.json`

### Durable review — 1 file

- `docs/audit/reviews/2026-08-01-audit-phase8-clean-room-control-merge-v1.md`

## Blocked checks and residual risks

- Phase 8 integration remains blocked until Phase 7 is independently accepted.
- Live R2 bindings, API routes, and Cloudflare deployment composition require later integration review.
- The synchronous pure-JavaScript SHA-256 implementation is verified against reference vectors but should receive an independent performance review for very large production control objects.
- Production infrastructure must preserve the modeled hidden-resource timing, cache, operation, and response classes.
- Operation estimates must be cross-checked against the final storage adapter implementation.

No dependency installation/download, compilation, build, submitted-project execution, external audit-tool execution, process/container/network/RPC activity, signing, transaction, deployment, workflow approval, production secret, AWS, CurveYield Lite change, execution enablement, PR integration, or merge to `main` occurred.
