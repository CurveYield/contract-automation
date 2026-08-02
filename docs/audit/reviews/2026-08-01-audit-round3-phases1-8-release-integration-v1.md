# Audit Round 3 Phases 1–8 Release Integration Review v1

## Recommendation

**ACCEPT WITH DOCUMENTED REPAIR for Round 4 intake.**

This branch is the authoritative hardened Phase 1–6 and release-integration-spine candidate. It is not the final Phases 1–8 release candidate because the current Phase 7–8 production paths are explicitly frozen, stale inputs from issue #97 and must be replaced by Worker 0's registered final Phase 7–8 candidate during Round 4.

## Candidate identity

- Repository: `CurveYield/contract-automation`
- Branch: `audit-round3/phases1-8-release-integration-v1`
- Starting SHA: `5f834d9702a4d28061222a64cfa9d870c97a4978`
- Issue: #114
- Worker: `worker-2`
- Scope: Phases 1–6 hardening, cross-phase public contracts, release manifest/intake spine, frozen Phase 7–8 compatibility testing

## Executive findings

1. Phase 1–3 validation and storage services required material hardening even though their starting blobs matched the previously accepted source. The repaired branch rejects hostile object graphs, enforces canonical indexes and ETags, returns defensive frozen values, and recovers deterministic partial writes.
2. Phase 4 is byte-exact to accepted source SHA `8beb17a3f4a9df0a32a07caf19fc17fb633d4d75`, including its complete deterministic result-contract documentation.
3. Phase 5 is byte-exact to accepted source SHA `dd78a76f9546c85e79357a617b219067704c1616` except for one explicit repair in `packages/audit-phase5-parsers/src/common.mjs`: non-completed terminal results discard raw process exit codes and emit `exitCode: null`.
4. Phase 6 profile, parser, result, and catalog graphs are byte-exact to accepted source SHA `1b20f634b6d3c5f1261d490e545415c81d7488f2`.
5. A new dependency-free release-integration package now validates candidate manifests, source/destination blobs, public-interface locks, shared-file unions, path ownership, protected files, capability composition, exact Round 4 slots, and release manifests.
6. Frozen Phase 7–8 public contracts remain compatible with shared Phase 1 identities and the execution-disabled release boundary, but their production files are not accepted as final release code on this branch.
7. All six current-main GitHub-native simulation and runner/RPC-policy blobs remain byte-identical.

## Phase 1–3 repairs

### Shared boundary

- Reject proxies, custom prototypes, symbols, getters/setters, non-enumerable properties, sparse or decorated arrays, cycles, excessive depth, control characters, non-finite numbers, and negative zero.
- Accept only ordinary `Uint8Array` values for inert byte payloads.
- Canonically clone and recursively freeze accepted values.
- Reject duplicate scopes and duplicate evidence identifiers.

### Conditional storage

- Validate safe bounded relative keys.
- Validate option objects without invoking accessors.
- Reject unknown and contradictory conditional-write predicates.
- Require canonical lowercase SHA-256 ETags.

### Profile, workspace, and layer identity

- Require unique sorted profile indexes with exact record membership.
- Bind SBOM and attestation references to deterministic profile keys.
- Bind workspace and layer object references to deterministic owning namespaces.
- Make profile revocation retries idempotent and conflict-safe.

### Campaign, job, evidence, and report lifecycle

- Recover partial immutable writes for campaigns, jobs, attempts, events, raw artifacts, evidence, attestations, and reports.
- Keep job indexes synchronized with active and terminal state.
- Reject generic terminal-transition bypasses.
- Make completion and cancellation retries idempotent and conflict-safe.
- Preserve accepted public return shapes through a small compatibility entrypoint wrapper.

## Phase 4–6 provenance

| Phase | Source SHA | Destination state | Profiles |
|---|---|---|---:|
| 4 | `8beb17a3f4a9df0a32a07caf19fc17fb633d4d75` | Exact | 6 |
| 5 | `dd78a76f9546c85e79357a617b219067704c1616` | Exact except `phase5-terminal-exit-null-v1` | 4 |
| 6 | `1b20f634b6d3c5f1261d490e545415c81d7488f2` | Exact | 3 |

### Phase 5 repair

- Path: `packages/audit-phase5-parsers/src/common.mjs`
- Destination blob: `d25b446851a8393239f7f720b668e071a9df3232`
- Rule: timeout, cancellation, and resource exhaustion must have `exitCode: null`, regardless of any raw process code.
- Direct repair test: 2/2 passed.

## Release-integration spine

Package: `packages/audit-release-integration`

The package is in-memory validation only and exports:

- strict hostile-boundary errors;
- exact Round 4 intake slots;
- public-interface lock creation/validation/comparison;
- deny-by-default capability composition;
- component manifest creation/validation;
- source/destination blob truth checks;
- shared-file union validation with disjoint field ownership;
- deterministic candidate intake planning;
- release manifest creation/validation.

It imports no filesystem, process, network, VM, package-manager, wallet, signing, transaction, deployment, workflow, or transport capability.

## Verification evidence

### Actual committed Round 3 branch

The current private branch archive was materialized and the focused suite executed against the actual committed tree.

- Tests: **31**
- Passed: **31**
- Failed: **0**
- Syntax: every Audit production and focused test `.mjs` file passed `node --check`

The focused suite covers:

- hostile object and defensive-clone boundaries;
- R2 conditional writes and stale CAS;
- profile/workspace/campaign/job/evidence/report lifecycles;
- injected partial-write recovery;
- public-interface return-shape locks;
- Phase 4–6 profile/parser/result/catalog composition;
- Phase 5 terminal repair;
- release manifest/intake/union/capability contracts;
- 24 release-intake adversarial variants;
- Phase 7–8 public-contract compatibility;
- protected Git blob preservation;
- static execution-disabled and transport-free scanning.

### Accepted source evidence preserved through exact blobs

- Phase 4: 29/29 focused tests, 14 fixtures.
- Phase 5: 36/36 focused tests, 16 fixtures.
- Phase 6: 59/59 focused tests, 73 fixtures.
- Aggregate: **124/124 accepted-source tests** and **103 fixture payloads**.
- Explicit mutation vectors: at least **138**, comprising at least 114 accepted Phase 4–6 vectors plus 24 Round 3 release-intake variants. Additional hostile-object and substitution cases are not included in that minimum.

## Protected blobs

| Path | Preserved blob SHA |
|---|---|
| `.github/workflows/github-native-simulate.yml` | `54e446d4a715ca9678ed4d7434f7ba90b2c67c96` |
| `packages/runner/src/rpc-method-policy.mjs` | `59dfa72f41a697d533720a4d8f939a81aeba6736` |
| `packages/runner/src/fork-rpc-guard.mjs` | `73690f16b506baa50ca471ce5b5566ccb601e765` |
| `packages/runner/src/run-job.mjs` | `e6489c756d43a2f294120ac3c84687030fb919db` |
| `packages/github-native-sim/src/fork-rpc-proxy.mjs` | `4d7e2bd1114f5a37914b26447c9c79a1e40a58e6` |
| `packages/github-native-sim/src/run-job-file.mjs` | `8c4c82d76e249b74efc630c8cbf0d7707d25b5f2` |

## Round 4 intake contract

Round 4 must use path-level transplants, never source-branch merges.

1. Worker 0 final Phase 7–8 candidate replaces stale issue #97 paths.
2. Worker 1 final API candidate is transplanted only into registered API-owned paths.
3. Worker 3 final GitHub Direct candidate is transplanted only into registered GitHub Direct-owned paths.
4. Worker 4 final web candidate is transplanted only into registered web-owned paths.
5. Shared files are produced only through declared field-owned union manifests.
6. Every candidate must supply final SHA, issue report, complete owned-path inventory, source/destination blob table, public-interface lock, recommendation, and test evidence.
7. Any stale SHA, missing blob, unregistered path, overlap, protected-path mutation, public-interface drift, or capability broadening is a hard rejection.

## Residual risks and required follow-up

1. Phase 7–8 production on this branch is intentionally stale and frozen; it must be replaced during Round 4 before release acceptance.
2. API, GitHub Direct, and web final candidates were not yet integrated; their Round 4 candidate manifests remain prerequisites.
3. No PR, branch merge, workflow approval, execution-plane enablement, deployment, or production secret action was performed.
4. Round 4 must rerun the full changed-path, public-interface, protected-blob, capability, cross-system, adversarial, syntax, and direct-Node test gates after each intake and after the complete union.

## Final assessment

The Phase 1–6 and release-integration-spine portions are suitable for Round 4 intake. The branch preserves a strict metadata/validation/storage-only boundary, provides deterministic source and interface contracts for the remaining workers, and closes the identified Phase 1–6 compact-adaptation and lifecycle gaps. Final Phases 1–8 acceptance remains contingent on successful Round 4 replacement and integration of the registered external candidates.
