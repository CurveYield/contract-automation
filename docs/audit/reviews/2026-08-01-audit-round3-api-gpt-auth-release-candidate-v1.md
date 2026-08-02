# Round 3 API, GPT, authorization, and Cloudflare release-candidate review v1

## Decision

**ACCEPT** for Round 4 reconstruction and final integration acceptance.

The Round 3 owned implementation completes all twenty ordered sections in issue #113 and leaves submitted-project execution disabled. It replaces count-only and boolean capability seams, centralizes route authorization, adds the missing GPT lifecycle/evidence routes, repairs report non-interference and cursor handling, hardens provider/error boundaries, verifies Cloudflare-compatible production imports, and exercises the real exported API entry under concurrency and cancellation.

## Immutable identity

- Repository: `CurveYield/contract-automation`
- Issue: `#113`
- Worker: `worker-1-round3-api-gpt-auth-release-v1`
- Mailbox sequence: `4`
- Branch: `audit-round3/api-gpt-auth-release-v1`
- Starting SHA: `d2d17ce80071f67cf5894c09d3a7291f5904cf43`
- Reviewed implementation SHA: `f02840ee3fc0c59759c5034dc5c40e0c154bdab5`
- API contract: `audit-api-contracts-v2`
- Catalog composition: `audit-catalog-composition-v2`
- Phase 7–8 compatibility source: `13af0c6c6c3d74ceacdc1894d6f3146460884fb4`
- Protected simulation-addon reference: `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`
- Execution boundary: `executionEnabled: false`
- Executor state: unavailable
- Round 4 final documentation/branch SHA: recorded in the issue #113 final report because a commit cannot self-reference its own SHA.

## Durable checkpoints

- Checkpoint 1 comment: `5154751497`
- Checkpoint 2 comment: `5154795950`
- Checkpoint 3 comment: `5154858811`
- Checkpoint 4 comment: `5154894490`
- Checkpoint 5: posted after final verification and this review publication.

## Independent source review

The prior issue #102 implementation and its tests were treated as untrusted review input. The initial seven-case RED suite produced:

```text
7 tests
0 passed
7 failed
0 cancelled
0 skipped
```

The source review found:

1. duplicate configured credentials selected the first identity;
2. raw booleans could fabricate Phase 7/8 capability availability;
3. Phase 6 summaries omitted exact parser/result identities;
4. cross-scope report rows changed an empty list from 200 to 500;
5. stale report cursors silently returned empty 200 pages;
6. hostile configured CORS origins could throw in the Web header constructor;
7. workspace, fork, clean-room, and evidence-summary GPT routes were absent;
8. route authorization was broad read authentication plus a GPT post-check rather than a closed route registry;
9. provider ordering was applied after provider-controlled pagination;
10. Phase 7–8 discovery lacked an immutable transport-neutral compatibility record.

Every observed RED case is now green. The additional architectural gaps are covered by exact compatibility, authorization, provider, pagination, and real-entry tests.

## API contract v2

`packages/audit-api-contracts/src/index.mjs` now enforces:

- exact bounded UTF-8 bytes for strings, keys, cursors, values, and responses;
- bounded dense arrays, ordinary/null-prototype objects, collection counts, and nesting;
- accessor, symbol, sparse-array, custom-prototype, class-instance, cycle, negative-zero, unsafe-number, and hostile-reflection rejection;
- recursively frozen defensive output;
- canonical JSON encoding;
- duplicate credential configuration rejection before token matching;
- one exact bearer identity, including narrowly scoped `service-read`;
- canonical HTTP(S) CORS origin or fail-closed `null`;
- reserved content, CORS, cache, ETag, cookie, and security response headers;
- private scoped ETags and cursors with no secret-derived input;
- stable public error codes/messages/paths with recursive attacker-data discard.

The exact bounds are one million encoded value/response bytes, 8,192 string bytes, 160 key bytes, 1,000 collection entries, depth 24, and 4,096 cursor bytes.

## Exact catalog and capability composition

The `audit-catalog-composition-v2` catalog contains 13 unique deterministic entries:

- Phase 4: 6
- Phase 5: 4
- Phase 6: 3

Every entry binds profile, parser, adapter, tool, parser package/version/function, capture schema, result schema, evidence schema, trusted producer, source package, and source commit where the accepted upstream contract defines them. Every record remains unpublished, digest-required, non-runnable, execution-disabled, and executor-unavailable.

Phase 5 is pinned to `2982614879f1f6d252a7630eb5331031d5934b4e`. Phase 6 is pinned to `1b20f634b6d3c5f1261d490e545415c81d7488f2`.

Phase 7–8 discovery validates the immutable `@curveyield/audit-phase78-service` v0.1.0 compatibility record at source `13af0c6c6c3d74ceacdc1894d6f3146460884fb4`, including exact index/constants blobs and 15 operation names. It imports no service/storage internals.

Aggregate capabilities ignore raw request booleans and environment aliases. Phase 7 and Phase 8 availability remain false on this isolated candidate while service discovery is truthfully exposed. Missing dependencies never create capabilities.

## Route and authorization matrix

The real exported entry composes direct Phase 4–6 catalog routes, direct report list/item, GPT capabilities/catalog/reports, bounded workspace/campaign/job/fork/clean-room status, and evidence summary before the existing Phase 1–3 fallback.

The exact GPT additions include:

- `/audit/v1/gpt/workspaces/:workspaceId/status`
- `/audit/v1/gpt/forks/:forkId/status`
- `/audit/v1/gpt/clean-rooms/:cleanRoomId/status`
- `/audit/v1/gpt/jobs/:jobId/evidence-summary`

All owned routes are GET/OPTIONS only. Unsupported methods fail before body parsing.

Authorization identities:

- client and GPT: approved read scopes;
- legacy read/submit/admin: direct catalog/report only, forbidden from GPT routes;
- `service-read`: exact server-owned scope, tenant/workspace, expiry, revocation, and resource binding;
- edge-control, attestation, CurveYield Lite, malformed, empty, duplicate, unrelated, and request-supplied identities: unauthorized or fail-closed configuration error.

The service grant is exactly `{ tenantId, workspaceId, scopes, resourceBindings, expiresAt, revoked }`. Missing/malformed/expired/revoked grants converge on one bounded 403 class. Resource-binding mismatches are hidden as the same 404 class as absent resources.

## Report, lifecycle, evidence, pagination, and cache behavior

Report references are immutable bounded metadata with no artifact bytes, arbitrary/signed URLs, host paths, credentials, or executable content.

Provider output is validated, canonicalized, visibility-filtered, conflict-checked, sorted, and only then paginated. Exact duplicate rows deduplicate. Conflicting duplicate IDs fail closed. Stale, tampered, malformed, duplicate-query, cross-scope, and oversized cursor/limit inputs reject deterministically. No total or hidden count is emitted.

Workspace, campaign, job, fork, and clean-room statuses use exact type-specific state vocabularies and terminal congruence. Jobs and forks may truthfully remain `awaiting_executor`; they never claim available execution.

Evidence summaries contain only bounded classification/count/truncation/update metadata. They contain no artifact/evidence bytes or URLs.

Cache metadata is private and bound to tenant, workspace, route, query, and canonical response body. Concurrent tenant/workspace tests produce stable within-scope ETags and distinct cross-scope ETags. Credentials are never inputs.

## Hidden-resource non-interference

The tests prove:

- hidden and absent report/status/evidence items use the same status and body class;
- well-formed cross-scope report rows do not affect visible body, cursor, cache-control, or ETag;
- request-supplied tenant/workspace/scope/resource aliases do not change provider arguments;
- service binding mismatches reveal no grant or resource state;
- provider arguments contain only server-owned tenant/workspace/resource identifiers;
- no hidden totals, facets, cache keys, or provider text are returned.

## Error and hostile-provider boundary

Public errors contain only a stable bounded code, stable public message (`Request rejected` or `The request could not be completed`), and optional validated path.

The normalizer discards recursive provider text, nested objects/arrays, authorization/request/response headers, bearer values, secrets, URLs, Windows/POSIX paths, stacks, causes, control characters, bidi/Unicode attacker text, and oversized input.

Status and report providers are accessed through own data-property descriptors; getters are never invoked. Throwing and revoked proxies, accessors, cycles, custom prototypes, sparse arrays, symbols, unsafe numbers, prototype-pollution fields, extra execution claims, byte payloads, rejected promises, and partial provider outputs converge on bounded stable provider/internal errors. Cross-scope identity mismatches remain 404 rather than provider errors.

## Real entry, concurrency, and cancellation

The real `apps/audit-api/src/entry.mjs` was exercised across the full owned route registry, legacy fallback, capabilities/readiness, OPTIONS/CORS, malformed encoding, unsupported methods, streaming error bodies, concurrent scope isolation, already-aborted requests, and requests aborted while an injected provider was pending.

Cancellation is normalized at the composition boundary as HTTP 499 with `request_cancelled`. Abort reasons are never reflected. The cancellation checks do not pass signals, credentials, or authorization details into provider arguments.

## Cloudflare Worker portability

Static/import-graph checks cover 11 owned production modules and prove no:

- `node:*` production import;
- Buffer/process/filesystem/child-process/worker-thread/socket/network client;
- dynamic code/WebAssembly;
- package-manager/container runtime;
- wallet/key/signing/transaction/broadcast/deployment primitive;
- GitHub-native simulation, runner RPC policy/guard, or CurveYield Lite import;
- `executionEnabled: true` or `runnable: true` production state.

The runtime uses standard Web APIs: TextEncoder/TextDecoder, `crypto.subtle`, URL, Request, Response, Headers, structuredClone, btoa, and atob.

The portability test initially reported the required Cloudflare Worker `fetch(request, env)` entry method as an outbound `fetch` call. Systematic debugging isolated the test-only pattern error; the scanner now forbids constructed network clients and `globalThis.fetch` while allowing the Worker entrypoint. The corrected gate is green.

## Protected simulation/RPC boundary

Reference commit: `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`.

Seventeen protected Git blob identities are pinned in `docs/audit/round3/2026-08-01-protected-simulation-addon-blobs-v1.json`. The candidate changed-path set contains zero GitHub-native simulation/App/RPC-addon, runner RPC policy/guard, or related workflow/documentation paths.

## Changed paths

The final expected candidate contains exactly 30 unique sorted owned paths listed in `docs/audit/round3/2026-08-01-candidate-changed-paths-v1.json`:

- 6 production API entry/handler modifications;
- 3 API-contract production files, including the new authorization module;
- 1 catalog-composition production file;
- 11 focused Round 3 test files;
- 7 Round 3 route/auth/inventory/handoff/review manifests;
- 2 focused catalog/API package test files counted in the above package groups.

No unowned or frozen path is accepted.

## Verification method and evidence

No dependency was installed/downloaded. Nothing was compiled or built. No submitted project or external audit tool ran. No live network/RPC, wallet/signing/transaction, deployment, workflow approval, PR, branch merge, or merge to `main` occurred.

Focused milestones:

- Checkpoint 2: 21/21
- Checkpoint 3: 47/47
- Checkpoint 4: 58/58
- Real-entry focused gate: full owned route/cancellation corpus green
- Hostile integration focused gate: provider, concurrency, and authority-substitution corpus green
- Final aggregate totals are recorded in Checkpoint 5 and the final issue report after fresh verification.

Direct syntax checks cover every changed `.mjs`. JSON parsing covers every Round 3 JSON manifest. Final checks include changed-path allowlisting, 17 protected blob re-fetches, Cloudflare portability scanning, and `git diff --check`.

## Blocked or intentionally prohibited checks

- dependency installation or package-manager commands;
- compilation/build;
- live Cloudflare deployment or Wrangler invocation requiring unavailable dependencies;
- submitted-project or external audit-tool execution;
- process/container service execution beyond direct repository-owned Node test invocation;
- live provider/network/RPC access;
- wallet/signing/transaction/broadcast/deployment;
- workflow approval, PR, merge, or main modification.

These were prohibited by issue #113 and are not claimed.

## Residual risk

1. Phase 5 and Phase 6 catalog records remain immutable accepted-interface projections until Round 4 reconstructs their exact source packages onto the integration lineage.
2. Phase 7–8 discovery validates immutable service compatibility but does not import or execute service/storage internals.
3. Real storage/provider implementations are external to this package. Round 4 must verify they preserve the exact provider argument, ordering, snapshot, conflict, and hidden-resource contracts.
4. Cloudflare portability is proven by Web-API behavior and static import inspection, not by deployment or build.
5. Repository-wide integration suites and shared-file union conflicts are Round 4 responsibilities.

No residual risk requires a Round 3 owned code repair. The candidate is suitable for Round 4 final reconstruction and acceptance.
