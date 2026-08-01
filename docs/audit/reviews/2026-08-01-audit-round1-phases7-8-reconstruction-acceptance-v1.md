# Round 1 Phases 7–8 Reconstruction Acceptance Review v1

## Recommendation

**ACCEPT**

The Phase 7 persistent-fork control/storage surface and Phase 8 clean-room/controlled-merge surface were reconstructed onto latest-main starting SHA `c1f624cee5de9644736d6ab8f967661e6ae348fd` without merging stale worker ancestry. Both prior worker acceptance reports were treated as untrusted. The candidate was independently repaired and verified with direct Node tests while submitted execution remained disabled.

## Exact pins

- Starting SHA: `c1f624cee5de9644736d6ab8f967661e6ae348fd`
- Accepted implementation candidate SHA: `768437d01ae9d64b04a4755f7f697ed049e505b4`
- Phase 7 source pin: `1a9d3f19c987d2da494e9fd35b03f12e6ca08d52`
- Phase 8 source pin: `9b8c81631f6f75d3d888563071cab2ec709fb53d`
- Branch: `audit-round1/phases7-8-reconstruction-v1`
- Issue: `#97`
- Mailbox sequence: `3`
- Assignment blob SHA: `470ad9570cb9ea59d65406095884de5fd7549ab6`

The final documentation commit containing this review and the provenance manifest is recorded in the issue #97 final report and Worker 0 completion status because a Git commit cannot self-embed its own SHA.

## Durable checkpoints

1. Checkpoint 1: issue #97 comment `5152687455` — Phase 7 reconstruction and independent repair.
2. Checkpoint 2: issue #97 comment titled **Checkpoint 2 — Phase 8 protocol, access, terminal campaigns, merge state, and relations**.
3. Checkpoint 3: issue #97 comment titled **Checkpoint 3 — Phase 8 provenance, publication, storage recovery, end-to-end, and adversarial gates**.
4. Checkpoint 4 is posted after this review and provenance manifest are committed and the final aggregate verification is rerun.

## Changed-path and provenance inventory

The implementation candidate contains exactly **63 owned paths**:

- Phase 7 production/package paths: 18
- Phase 7 focused tests/helpers: 11
- Phase 8 production paths: 21
- Phase 8 inert fixtures: 4
- Phase 8 focused tests: 8
- Round 1 cross-phase tests: 1

No byte-identical transplant claim is made for a path whose behavior was independently adapted. Every path has an immutable source commit/path locator, destination commit/path locator, mode, and adaptation reason in:

`docs/audit/integration/2026-08-01-audit-round1-phases7-8-provenance-v1.md`

Historical Phase 7/8 review documents were not copied.

## Test-first evidence

### Phase 7 RED

Latest-main isolation before local compatibility adaptation:

```text
14 test files
2 passed
12 failed (expected missing parallel Phase 1–3 modules)
```

Deletion/recovery tests before repair:

```text
8 tests
1 passed
7 failed
```

### Phase 8 RED

The eight-case repair matrix reproduced the assigned source defects: caller-selected index keys, incomplete read authorization, unvalidated grant/revocation collections, unstable reflection failures, character-count byte limits, Node-only digest coupling, noncanonical operation classes, and monolithic responsibility boundaries.

### Final GREEN

```text
Phase 7 focused: 33 passed, 0 failed
Phase 8 focused: 58 passed, 0 failed
Round 1 cross-phase: 14 passed, 0 failed
Aggregate: 105 passed, 0 failed, 0 cancelled, 0 skipped
```

Fresh syntax checks passed for all changed `.mjs` files. All four Phase 8 fixture JSON files parsed. Static capability scans and trailing-whitespace checks passed.

## Phase 7 acceptance matrix

- External create requests stop at `awaiting_executor`.
- Only the deterministic inert mock may become `ready`.
- Fork identity binds tenant, workspace, campaign, attempt, profile, policy, requester, exact chain ID and block number/hash.
- State writes use compare-and-swap and monotonic versions.
- Tenant index mutation is private and immutably request-bound.
- Deletion enters `deleting` before destructive object mutation.
- Exact retries converge after deleting CAS, object deletion, manifest deletion, export deletion, tombstone publication, and final deleted CAS failures.
- Successful exact deletion retry is idempotent; conflicting retry metadata rejects.
- Checkpoint target 250 MB, maximum 1 GB, maximum eight, active retention one day, exported retention seven days.
- Operation traces: create 6A/4B, checkpoint 3A/3B, export 2A/3B.
- No listing or copy operation.

## Phase 8 access and non-interference matrix

- Default deny; exact tenant/workspace/campaign and scopes required.
- Read visibility requires `campaign:read` plus the closed role/state matrix.
- All 12 resource classes tested for own-campaign visibility and cross-campaign hiding.
- Explicit grants expose only exact immutable base artifacts, never campaign-private derivatives.
- Expiry/revocation deny future reads without rewriting provenance.
- Hidden absent/existing resources produce canonical-byte-identical bodies, errors, counts, facets, notifications, signed-resource plans, relation hints, cache tags, operation budgets, and timing classes.
- Storage and index keys are server-derived; caller-selected paths and index snapshots reject.

## Phase 8 terminal, merge, relation, and provenance matrix

- Terminal completion kinds distinguish success, findings, partial, truncated, failed, cancelled, and policy-rejected.
- Only eligible completed campaigns enter merge planning.
- Exact sorted membership and same tenant/workspace/source identity required.
- Merge CAS path verified through completed; stale and terminal transitions reject.
- Duplicate and conflict maps preserve every original finding/evidence reference and are order independent.
- Provenance rejects dangling, conflicting, cross-scope, and cyclic graphs.
- Authorized tracing cannot expose hidden campaign nodes.
- Merge/report manifests pin exact source, relation, provenance, report, policy, and operation digests.
- Active content, credentials, arbitrary URLs, and host paths reject from report references.

## Storage, quota, retention, and recovery

Typical merge: 4 Class A, 4 Class B, 2 MB retained for 90 days.

Three-input idempotent retry: 4 Class A, 5 Class B, 2.5 MB retained for 60 days.

Input-count, bytes, retention, stale-pointer, and partial immutable-write recovery are tested. No prefix listing occurs. Server-owned indexes rebuild only from approved immutable manifests.

## Latest-main preservation and static boundaries

The branch began at exact latest-main SHA `c1f624cee5de9644736d6ab8f967661e6ae348fd` and only the 63 implementation/test/fixture paths in the provenance manifest plus the two final documentation paths changed. GitHub-native simulation code is inherited unchanged and is absent from the diff. No API/web/workflow/deployment, Worker 1/2/3 active path, GitHub Direct, CurveYield Lite, or unrelated contract/application path changed.

Production scans found no process, shell, worker thread, filesystem enumeration, network/HTTP/RPC/socket, arbitrary URL, package-manager/install, container/image/binary, dynamic code, wallet/key/signer, transaction/calldata/broadcast, deployment, direct cloud SDK, or execution-enablement capability.

## Blocked checks — no success claimed

- dependency installation or package-manager commands;
- compilation/build;
- full repository suite requiring Worker 2 Phase 1–6 and Worker 1 catalog/API integration;
- production R2 binding integration;
- real RPC/fork compute;
- submitted-project/tool execution;
- containers;
- deployment/workflow execution;
- API/web integration;
- merge to main.

## Residual risks

1. Phase 7 real execution remains intentionally absent and requires a separately authorized hardened executor.
2. Opaque checkpoint bytes are verified by identity/size/digest but not interpreted by the control plane.
3. Phase 7 local compatibility primitives must be reconciled by exact contract tests when Worker 2's Phase 1–6 candidate is integrated.
4. Phase 8 storage behavior is proven through deterministic planners; production R2 binding tests remain an integration gate.
5. Worker 3's later Phase 8 branch was input-only and not treated as authoritative; the orchestrator must compare this independently reconstructed candidate against any accepted Worker 3 evidence before Round 1 combination.

## Restriction confirmation

No dependency was installed or downloaded. No package manager, compilation, build, submitted project/tool, process/container, live network/RPC, wallet/key/signer, transaction/broadcast, deployment, workflow approval, production secret, AWS resource, CurveYield Lite change, PR, branch merge, or `main` merge occurred.
