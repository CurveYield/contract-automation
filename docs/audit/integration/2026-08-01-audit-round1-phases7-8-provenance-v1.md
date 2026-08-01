# Round 1 Phases 7–8 Source/Destination Provenance Manifest v1

## Immutable pins

- Repository: `CurveYield/contract-automation`
- Starting/latest-main SHA: `c1f624cee5de9644736d6ab8f967661e6ae348fd`
- Accepted implementation SHA: `768437d01ae9d64b04a4755f7f697ed049e505b4`
- Phase 7 source pin: `1a9d3f19c987d2da494e9fd35b03f12e6ca08d52`
- Phase 8 source pin: `9b8c81631f6f75d3d888563071cab2ec709fb53d`

Every destination below is resolved as the exact GitHub blob at:

`768437d01ae9d64b04a4755f7f697ed049e505b4:<destination-path>`

Every source-derived entry is resolved as the exact GitHub blob at the stated source SHA and source path. No byte-identical claim is made: source-derived files are classified as `adapted` because the old acceptance reports were untrusted and the candidate was independently reconstructed and repaired.

## Counts

- Total implementation/test/fixture paths: **63**
- Phase 7 production/package paths: 18
- Phase 7 tests/helpers: 11
- Phase 8 production paths: 21
- Phase 8 fixtures: 4
- Phase 8 tests: 8
- Round 1 cross-phase tests: 1
- Historical Phase 7/8 review documents copied: 0
- Unowned paths changed: 0

## Phase 7 production/package paths

Default source locator for entries not marked `new`:

`1a9d3f19c987d2da494e9fd35b03f12e6ca08d52:<same-path>`

Adaptations cover latest-main isolation, runtime-neutral hashing, immutable-request-bound tenant indexes, state-before-destruction, and retry-safe deletion.

- `packages/audit-fork-protocol/package.json` — adapted
- `packages/audit-fork-protocol/src/base-primitives.mjs` — new: Phase-7-local identity boundary for independent reconstruction
- `packages/audit-fork-protocol/src/checkpoint-contracts.mjs` — adapted
- `packages/audit-fork-protocol/src/constants.mjs` — adapted
- `packages/audit-fork-protocol/src/digest.mjs` — new: runtime-neutral SHA-256
- `packages/audit-fork-protocol/src/fork-contracts.mjs` — adapted
- `packages/audit-fork-protocol/src/index.mjs` — adapted
- `packages/audit-fork-protocol/src/internals.mjs` — adapted
- `packages/audit-fork-protocol/src/keys.mjs` — adapted
- `packages/audit-fork-protocol/src/mock-contracts.mjs` — adapted
- `packages/audit-fork-protocol/src/transition.mjs` — adapted
- `packages/audit-forks/package.json` — adapted
- `packages/audit-forks/src/checkpoint-operations.mjs` — adapted
- `packages/audit-forks/src/index.mjs` — adapted
- `packages/audit-forks/src/service.mjs` — adapted
- `packages/audit-forks/src/storage.mjs` — adapted
- `packages/audit-fork-mock-adapter/package.json` — adapted
- `packages/audit-fork-mock-adapter/src/index.mjs` — adapted

## Phase 7 test/helper paths

Default source locator for entries not marked `new`:

`1a9d3f19c987d2da494e9fd35b03f12e6ca08d52:<same-path>`

- `test/audit-phase7-checkpoint-storage-v1.test.mjs` — adapted for isolated owned test store
- `test/audit-phase7-fork-actions-v1.test.mjs` — adapted
- `test/audit-phase7-fork-boundary-v1.test.mjs` — adapted import/capability allowlist
- `test/audit-phase7-fork-contracts-v1.test.mjs` — adapted
- `test/audit-phase7-fork-deletion-recovery-v1.test.mjs` — new: independent eight-case repair matrix
- `test/audit-phase7-fork-protocol-v1.test.mjs` — adapted
- `test/audit-phase7-fork-recovery-v1.test.mjs` — adapted for isolated owned test store
- `test/audit-phase7-fork-state-machine-v1.test.mjs` — adapted for isolated owned test store
- `test/audit-phase7-in-memory-store-v1.mjs` — new: test-only conditional store
- `test/audit-phase7-mock-checkpoint-restore-v1.test.mjs` — adapted
- `test/audit-phase7-mock-replay-v1.test.mjs` — adapted

## Phase 8 production paths

The assigned Phase 8 source was monolithic. Source locators below identify the original contract file from `9b8c81631f6f75d3d888563071cab2ec709fb53d`; each destination is an explicit modular repair.

### Clean-room protocol

Source: `packages/audit-clean-room-protocol/src/index.mjs`, except `boundary.mjs` maps to the same source path.

- `packages/audit-clean-room-protocol/src/access-context.mjs` — adapted
- `packages/audit-clean-room-protocol/src/boundary.mjs` — adapted from `packages/audit-clean-room-protocol/src/boundary.mjs`
- `packages/audit-clean-room-protocol/src/constants.mjs` — adapted
- `packages/audit-clean-room-protocol/src/digest.mjs` — new modular runtime-neutral digest extracted from source requirements
- `packages/audit-clean-room-protocol/src/grants.mjs` — adapted
- `packages/audit-clean-room-protocol/src/index.mjs` — adapted facade
- `packages/audit-clean-room-protocol/src/policy.mjs` — adapted
- `packages/audit-clean-room-protocol/src/references.mjs` — adapted

### Clean-room access

Source: `9b8c81631f6f75d3d888563071cab2ec709fb53d:packages/audit-clean-room-access/src/index.mjs`

- `packages/audit-clean-room-access/src/authorization.mjs` — adapted
- `packages/audit-clean-room-access/src/constants.mjs` — adapted
- `packages/audit-clean-room-access/src/index.mjs` — adapted facade
- `packages/audit-clean-room-access/src/index-planning.mjs` — adapted; server-derived closed index keys
- `packages/audit-clean-room-access/src/non-interference.mjs` — adapted
- `packages/audit-clean-room-access/src/storage-keys.mjs` — adapted
- `packages/audit-clean-room-access/src/visibility.mjs` — adapted; read-scope and role/state gating

### Terminal campaigns

- `packages/audit-clean-room-campaigns/src/index.mjs` — adapted from same path at Phase 8 source pin

### Controlled merge

- `packages/audit-controlled-merge/src/index.mjs` — adapted from same path at Phase 8 source pin
- `packages/audit-controlled-merge/src/publication-storage.mjs` — adapted from same path at Phase 8 source pin
- `packages/audit-controlled-merge/src/relations.mjs` — adapted from same path at Phase 8 source pin
- `packages/audit-controlled-merge/src/request-state.mjs` — adapted from same path at Phase 8 source pin

### Provenance

- `packages/audit-provenance/src/index.mjs` — adapted from same path at Phase 8 source pin

## Phase 8 inert fixtures

These are new deterministic repository-owned fixtures. They have no executable payload.

- `test/fixtures/audit-phase8/fixture-manifest-v1.json`
- `test/fixtures/audit-phase8/multi-tenant-campaigns-v1.json`
- `test/fixtures/audit-phase8/relation-scenarios-v1.json`
- `test/fixtures/audit-phase8/storage-recovery-v1.json`

## Phase 8 focused tests

The first six tests map to the same paths at the Phase 8 source pin and were adapted to the repaired modular implementation. The final two are new independent acceptance gates.

- `test/audit-phase8-clean-room-interfaces-red-v1.test.mjs` — adapted
- `test/audit-phase8-clean-room-protocol-access-v1.test.mjs` — adapted
- `test/audit-phase8-clean-room-static-boundary-v1.test.mjs` — adapted
- `test/audit-phase8-controlled-merge-relations-v1.test.mjs` — adapted
- `test/audit-phase8-end-to-end-multi-tenant-v1.test.mjs` — adapted
- `test/audit-phase8-provenance-storage-publication-v1.test.mjs` — adapted
- `test/audit-phase8-clean-room-checkpoint1-repair-v1.test.mjs` — new eight-defect repair matrix
- `test/audit-phase8-clean-room-adversarial-v1.test.mjs` — new broad mutation/hostile-object corpus

## Round 1 cross-phase test

- `test/audit-round1-phases7-8-cross-phase-v1.test.mjs` — new

## Preservation proof

Because the reconstruction branch starts at exact SHA `c1f624cee5de9644736d6ab8f967661e6ae348fd` and its implementation diff contains only the 63 paths above:

- latest-main GitHub-native simulation paths are inherited unchanged;
- no API/web/workflow/deployment path changed;
- no Worker 1/2/3 active path changed;
- no GitHub Direct implementation path changed;
- no CurveYield Lite path changed;
- no submitted-execution capability was enabled.
