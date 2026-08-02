# Worker 1 Round 4 Phase 7–8 / API Compatibility Stage A Review v1

## Recommendation

**ACCEPT WITH REPAIR** for deterministic integration by Worker 2.

Stage B remains pending one frozen assembled SHA on issue #119. This report does not claim assembled-candidate or production acceptance.

## Exact source identities

- Repository: `CurveYield/contract-automation`.
- Issue: #121.
- Mailbox sequence: `5`.
- Assignment blob: `a584ab7e0f1839badc586b73dc58ab7ebca08e72`.
- Starting/reconciled Worker 0 source: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`.
- Worker 0 repaired core candidate: `dc77c51eb02d6f07b6ce9d582d8629b9c9932788`.
- Worker 0 closeout report: issue #112 comment `5156777973`.
- Worker 1 Round 3 API candidate: `6d877e2d87f1a91380a6c5d1efc47550527d8729`.
- Reviewed Stage A code/test candidate: `e26b78c2c26f3c11897e8fea397c8615fc66a5a0`.

## Scope and trust boundary

The review covered only the public Phase 7–8 service, authorization, lifecycle-plan, pagination/cache, reporting and publication/recovery seams consumed by the API/GPT layer.

The following remained read-only:

- Worker 0 repaired Phase 7–8 core validators and tenant/attempt-scoped readers;
- Worker 1 Round 3 API/GPT/auth production;
- Worker 2 integration-spine internals;
- Worker 3 GitHub Direct Audit internals;
- Worker 4 web/UI production;
- GitHub-native simulation/App/RPC-addon paths;
- PR #126 live-fork/simulation paths;
- production credentials, deployment and submitted-project executors.

No PR, merge, deployment, workflow approval, network/RPC, wallet, signing, transaction or secret-value operation was performed.

## Source verification

Worker 0's reconciled source head exactly matched the assigned branch starting SHA. The branch was zero commits ahead and zero behind at startup.

The Worker 0 handoff and closeout proved 75 repaired core tests and transferred six unfinished integration gaps:

1. service lifecycle and operation-summary reconciliation;
2. exclusive use of tenant/attempt-scoped public readers;
3. validator-backed report projections;
4. cursor/cache/quota/retention/tombstone/publication-replay coverage;
5. complete multi-tenant service/report scenarios;
6. final exact path/blob and Worker 2 intake records.

## Independent RED findings

The initial no-download exact public-seam mirror produced:

```text
10 tests
0 passed
10 failed
0 cancelled
0 skipped
```

The observed defects were:

1. fork service requests could not bind immutable attempt identity;
2. orchestration used a generic write plan instead of repaired transient lifecycles and exact failure boundaries;
3. absent and cross-tenant fork authorization outcomes were distinguishable;
4. cursors did not bind campaign/fork/attempt/visible-view identity and pages exposed total counts;
5. relation summaries exposed hidden-member presence and hidden-influenced counts;
6. visible provenance identity changed when only hidden nodes or the hidden source-index digest changed;
7. fork reports bypassed repaired state/tombstone validation;
8. campaign/merge reports trusted self-asserted manifests and operation summaries;
9. publication keys omitted exact fork/attempt scope and recovery lacked typed pointer-last evidence;
10. provider/internal errors had no descriptor-safe stable public normalizer.

The RED record is committed as `test/audit-round4-worker1-source-review-red-v1.test.mjs` and the exact route/export map is committed under `docs/audit/round4/worker1/`.

## Minimal repairs

### Service contracts and authorization

- Preserved v1 service request/response/error compatibility.
- Added v2 contracts with explicit `attemptId` and exact tenant/workspace/campaign/fork/merge identity.
- Added request-bound response and error validators.
- Collapsed absent, cross-tenant and cross-attempt fork resources to one `resource_hidden` decision.
- Used descriptor-safe inspection and recursive frozen outputs.
- Added stable error normalization that never reflects provider text, getters, URLs, host paths, stacks or tokens.

### Lifecycle and operation truth

The public orchestration plans now match Worker 0's repaired traces:

| Operation | Lifecycle | Failure boundaries | Class A | Class B |
|---|---|---:|---:|---:|
| checkpoint | `ready -> checkpointing -> ready` | 5 | 9 | 10 |
| export | `ready -> exporting -> ready` | 4 | 8 | 12 |
| restore | `ready -> restoring -> ready` | 3 | 7 | 11 |
| delete | `ready-or-transient -> deleting -> deleted` | 4 | 7 | 9 |

Plans remain execution-disabled, terminal-protected and prefix-list-free.

### Pagination and cache

- Added cursor/page v2.
- Bound cursor and ETag scope to tenant, workspace, campaign, fork, attempt, merge, resource, source index and visible view.
- Cross-scope reuse fails before data projection.
- Source/view drift returns `stale_cursor`.
- Page v2 omits total counts.
- Cache metadata is `private, no-store` and varies on authorization.

### Reporting

- Fork/checkpoint/export/delete records now pass repaired core validators before projection.
- Delete projections enforce state/tombstone identity congruence.
- Campaign and merge reports use repaired semantic validators.
- Partially hidden relation groups are omitted in full.
- Provenance reports validate the index and derive public identity only from visible nodes/edges.
- Hidden and absent resources use one byte-identical, count-invariant projection.

### Publication and recovery

- Publication v2 keys include exact campaign/fork/attempt/merge scope.
- Immutable records use exact-content preconditions and `if-none-match` creates.
- Mutable pointers use exact ETag/version CAS and are published last.
- Typed recovery rejects conflicting completion evidence and pointer-before-immutable/index ordering.
- Existing v1 contracts remain available for deterministic legacy integration.

## Fresh GREEN evidence

Command:

```text
node --test test/audit-round4-worker1-*.test.mjs
```

Result:

```text
108 tests
108 passed
0 failed
0 cancelled
0 skipped
```

Breakdown:

| Suite | Cases |
|---|---:|
| source-review regression | 10 |
| service/auth/lifecycle/cursor/cache/error | 21 |
| report/semantic/non-interference | 20 |
| publication/quota/CAS/replay | 23 |
| multi-tenant E2E/hostile/concurrency | 21 |
| static trust boundary | 13 |

Additional local checks:

- 23 production JavaScript modules: syntax clean.
- 6 Worker 1 test modules: syntax clean.
- 2 Worker 1 JSON fixtures: parsed successfully.
- 12 named multi-tenant scenarios.
- accessor invocation count in explicit hostile cases: zero.
- dependency installation/download: none.
- compilation/build: none.

The test harness mirrored the exact fetched public service/report/publication production files. It used clearly identified harness-only stubs for repaired core builders/validators because no full checkout or dependency download was available through the connector. Those stubs were not committed and are not represented as repository changes. The combined Worker 2 tree must rerun the same tests against the exact repaired core modules; that requirement is not waived.

## Static boundary results

The 17 repaired production files contain:

- no Node-only import;
- no process/container/environment authority;
- no network client or arbitrary URL authority;
- no dynamic code execution;
- no storage-internal or unscoped-reader import;
- no credential-shaped literal value;
- no execution-enabled or prefix-listing path;
- no wallet, signer, transaction, broadcast or deployment capability.

## Path and blob evidence

- Exact code/test candidate path/blob manifest:
  - `docs/audit/round4/worker1/2026-08-02-phase78-stage-a-path-blob-manifest-v1.json`
  - blob `3ecd9f2b76091a1fb6320b4c9dbd4f10c5ed38f3`
- Public compatibility manifest:
  - `docs/audit/round4/worker1/2026-08-02-phase78-public-compatibility-manifest-v1.json`
  - blob `8bcf9124c01fd47401c16fc58bb0f094f85f6bdb`
- Deterministic Worker 2 instructions:
  - `docs/audit/round4/worker1/2026-08-02-phase78-worker2-intake-v1.md`

The code/test candidate contains 27 changed paths:

- 17 production;
- 6 tests;
- 2 fixtures;
- 2 pre-candidate review documents;
- 0 unowned;
- 0 frozen/protected.

The manifest excludes itself by an explicit self-reference rule; its blob and later documentation head are recorded in durable issue/status records.

## Protected-addon verification

- Source protected baseline blob: `526971062e8049f9f85390a7863fe3c5e3085a33`.
- Present protected paths: 30.
- Expected-absent runner paths: 2.
- Protected paths in the exact start-to-candidate compare: 0.
- PR #126 live-fork/simulation overlap: 0.

Because the reviewed candidate is a direct descendant of the exact verified starting SHA and its comparison contains no protected path, protected blobs remain byte-identical to the starting source.

## Production prerequisites

Round 5 must verify:

- live Cloudflare Worker runtime and bindings;
- live R2 CAS/object behavior, retention and recovery;
- authenticated API selection of v2 contracts;
- production provider failure/latency behavior;
- deployment, observability, rollback and secret-name presence.

No production credential value is present or required for this Stage A package.

## Residual risks

1. Exact-core combined rerun remains mandatory because the isolated harness used test-only core stubs.
2. Legacy page v1 preserves its historical total field. Hidden-resource-sensitive Phase 7–8 routes must use page v2.
3. Cursor digests are deterministic integrity checks, not secret signatures; transport acceptance remains behind authenticated API authorization.
4. No live Cloudflare, R2, provider, workflow or deployment behavior was exercised.
5. Stage B is not active until issue #119 freezes one exact assembled SHA.

## Worker 2 intake verdict

Worker 2 may intake the exact registered production/test blobs from candidate `e26b78c2c26f3c11897e8fea397c8615fc66a5a0`, after the accepted/repaired Worker 0 core, using the committed blob manifest. Any blob mismatch, unregistered path, stale core source, protected-addon change, or combined-test failure is a rejection.

## Final Stage A verdict

**ACCEPT WITH REPAIR.**

The public Phase 7–8 API compatibility seam is ready for deterministic integration and exact-core combined testing. Worker 1 remains active and waiting for the frozen Stage B assembled SHA.
