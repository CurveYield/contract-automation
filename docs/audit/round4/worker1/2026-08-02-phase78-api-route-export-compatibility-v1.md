# Phase 7–8 API Route / Public Export Compatibility Map v1

## Pinned inputs

- Worker 0 reconciled Round 3 head: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`.
- Worker 0 repaired core candidate: `dc77c51eb02d6f07b6ce9d582d8629b9c9932788`.
- Worker 0 report: issue #112 comment `5156777973`, `ACCEPT WITH REPAIR`.
- Worker 1 Round 3 API head: `6d877e2d87f1a91380a6c5d1efc47550527d8729`.
- Worker 1 Round 3 report: issue #113 comment `5154958425`, `ACCEPT`.
- Round 4 assignment: issue #121, sequence `5`, assignment blob `a584ab7e0f1839badc586b73dc58ab7ebca08e72`.

## Consumer boundary

Worker 1's API/GPT layer must consume Phase 7–8 only through transport-neutral, versioned, public contracts. It must not import storage keys, raw object stores, unscoped readers, credentials, or executor authority.

| API/GPT dependency | Required Phase 7–8 public export | Authoritative version/state | Required public behavior | Current review finding |
|---|---|---|---|---|
| Fork status | `ForkService.readForkForTenant(tenantId, forkId)` plus validated `fork-state-v1` | requested / awaiting_executor / ready / checkpointing / restoring / exporting / deleting / deleted / failed / cancelled | exact tenant and attempt identity; hidden and absent are indistinguishable | Core reader is scoped, but service request/auth contracts do not carry or bind `attemptId` |
| Checkpoint status/reference | `ForkService.readCheckpointForTenant(tenantId, attemptId, forkId, checkpointId)` and `validateCheckpointManifest` | `fork-checkpoint-manifest-v1` | exact tenant/fork/attempt/checkpoint identity; one-day retention; no bytes | Core reader is correct; reporting bypasses validator and service cursor lacks attempt scope |
| Export status/reference | `validateExportManifest` | `fork-export-manifest-v1` | exact tenant/fork/checkpoint identity; seven-day retention; no byte copy claim | Reporting bypasses validator |
| Restore lifecycle | `validateRestoreManifest` plus fork state | ready -> restoring -> ready | no fabricated completion; exact attempt identity | Generic orchestration plan does not expose transient lifecycle/failure boundaries |
| Delete/tombstone | `validateForkState` plus `validateForkTombstone` | deleting -> deleted | tombstone/state identity congruence; terminal protection | Delete projection checks only two raw fields and bypasses validators |
| Clean-room campaign status | `validateTerminalCampaignManifest` | completed / failed / cancelled / policy_rejected | exact lifecycle/completion/partial/truncated/eligibility semantics | Campaign projection accepts raw self-asserted manifest fields |
| Merge status/report | `validateMergeRequest`, `validateMergeState`, `validateMergeManifest` | requested through completed/failed/cancelled/policy_rejected | exact request/manifest digest, members, policy, operation summary | Merge projection accepts impossible self-asserted digest/operation summaries |
| Relation summary | `validateDuplicateRelation`, `validateConflictRelation` | duplicate/conflict relation v1 | validated members/material/conflict fields; no hidden existence or count signal | Current summary reads raw member arrays and returns `hiddenMembersPresent` plus hidden-influenced group counts |
| Provenance status/report | `validateProvenanceIndex` and merged report reference validators | `phase8-provenance-index-v1` | validated DAG; visible-view-only report digest and cache identity | Current projection accepts raw index and includes hidden-source `indexDigest` in public report |
| Phase 7–8 pagination | phase78 service cursor/page contracts | current cursor v1 requires replacement/version bump | cursor bound to tenant/workspace/campaign/fork/attempt/resource/index/view; no hidden total | Current cursor binds only tenant/workspace/resource/index/page size and returns total |
| Phase 7–8 cache/ETag | service-visible projection digest | new explicit version required | derived only from visible validated projection and exact scope | No explicit visible-view cache contract exists |
| Publication/replay | phase78 publication plan and recovery contracts | current publication v1 requires replacement/version bump | deterministic scoped keys; immutable conflict detection; typed pointer-last replay | Keys omit campaign/fork/merge/attempt identity; recovery is digest-list only |
| Public errors | phase78 service error contract | current error v1 requires bounded normalizer | stable code/message/path; no provider text, URL, token, path, stack, or hidden reason | No provider/internal error normalizer export exists; authorization denial reasons differ across hidden cases |

## Public exports accepted from repaired core

### Phase 7

- `validateForkRequest`
- `validateForkState`
- `validateForkEvent`
- `validateForkActionRequest`
- `validateForkActionResult`
- `validateCheckpointManifest`
- `validateExportManifest`
- `validateRestoreManifest`
- `validateForkTombstone`
- `ForkService.readRequestForTenant`
- `ForkService.readForkForTenant`
- `ForkService.readCheckpointForTenant`

`ForkService` does not publicly export its raw request, fork, or checkpoint readers. Stage A must preserve that boundary and must not add an unscoped reader.

### Phase 8

- `validateTerminalCampaignManifest`
- `validateMergeRequest`
- `validateMergeState`
- `validateMergeEvent`
- `validateMergeManifest`
- `validateDuplicateRelation`
- `validateConflictRelation`
- `validateProvenanceNode`
- `validateProvenanceEdge`
- `validateProvenanceIndex`
- merged-report reference validators

## Exact source-review RED findings

The no-download mirror reproduced ten failures against the exact fetched public service/report/publication source:

1. fork service requests reject an explicit `attemptId` instead of binding it;
2. checkpoint orchestration has no `ready -> checkpointing -> ready` lifecycle or exact failure-boundary inventory;
3. absent and cross-tenant fork authorization return distinguishable reasons;
4. cursors cannot bind campaign/fork/attempt/view and pages expose total counts;
5. relation summaries expose hidden-member presence and hidden-influenced group/member counts;
6. visible provenance report digests change when only hidden nodes/source index digests change;
7. fork reports accept a deleted state that fails `validateForkState` tombstone requirements;
8. merge reports accept impossible self-asserted manifests and unbounded operation summaries;
9. publication keys omit exact fork/attempt identity;
10. no stable provider/internal error-normalization export exists.

Command:

```text
node --test test/audit-round4-worker1-source-review-red-v1.test.mjs
```

Result:

```text
10 tests
0 passed
10 failed
0 cancelled
0 skipped
```

Every failure is behavioral. No failure was caused by a missing source file, syntax error, dependency installation, compilation, network, RPC, or submitted-project execution.

## Repair rule

Production changes are permitted only for these observed public seam defects. Repaired core lifecycle, semantic validators, scoped readers, and storage internals remain authoritative and are not rewritten. Worker 1 Round 3 API production remains read-only during Stage A.
