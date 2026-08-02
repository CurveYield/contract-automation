# Audit Round 3 Phase 1–6 and Release-Integration Review v1

## Recommendation

**ACCEPT WITH REPAIR for Round 4 Stage A review.**

This branch is the authoritative hardened Phase 1–6 and release-integration-spine candidate. It is not a final Phase 1–8 release because the Phase 7–8 production paths present on this branch are frozen superseded inputs from issue #97. Round 4 must replace them from the independently reviewed Worker 0 candidate before assembled-candidate acceptance.

## Candidate identity and final binding

- Repository: `CurveYield/contract-automation`
- Branch: `audit-round3/phases1-8-release-integration-v1`
- Starting SHA: `5f834d9702a4d28061222a64cfa9d870c97a4978`
- Issue: #114
- Worker: `worker-2`
- Mailbox sequence: `7`
- Scope: Phase 1–6 hardening, Phase 7–8 public-contract compatibility, release intake contracts, source/blob registries, and Round 4/5 handoff

The exact final SHA and final issue-comment ID are recorded after the last branch commit in three durable records that must agree:

1. `.agent-control/v1/workers/worker-2/STATUS_v1.json`;
2. the Worker 2 sequence-7 completion event;
3. the final report on issue #114.

A committed document cannot contain the SHA of the commit that contains itself or the ID of a later comment, so this review deliberately uses that completion binding instead of a self-referential placeholder.

## Executive findings

1. Phase 1–3 required material hardening despite prior acceptance. The repaired branch rejects hostile object graphs, enforces canonical identity/index/CAS contracts, returns recursively frozen defensive values, and recovers deterministic partial writes.
2. Phase 4 production is byte-exact to accepted source `8beb17a3f4a9df0a32a07caf19fc17fb633d4d75` for the Round 3 changed path.
3. Phase 5 is byte-exact to accepted source `dd78a76f9546c85e79357a617b219067704c1616` except the documented `phase5-terminal-exit-null-v1` repair.
4. Phase 6 changed production paths are byte-exact to accepted source `1b20f634b6d3c5f1261d490e545415c81d7488f2`.
5. The new release-integration package rejects stale SHAs, dishonest blobs, malformed reports, hostile values, unregistered ownership, protected-path mutation, undeclared overlap, invalid shared-file unions, public-interface drift, and capability broadening.
6. Frozen Phase 7–8 public contracts compose with shared Phase 1 identities and the execution-disabled boundary, but their implementation is not accepted as final release code here.
7. All six protected GitHub-native simulation and runner/RPC-policy blobs remain byte-identical.

## Phase 1–3 repairs

### Shared boundary and R2

- Reject proxies, custom prototypes, accessors, symbols, hidden properties, sparse/decorated arrays, cycles, excessive depth, control characters, unsafe numbers and negative zero.
- Accept only ordinary inert `Uint8Array` byte payloads where bytes are part of the public contract.
- Canonically clone and recursively freeze accepted values.
- Reject duplicate scopes and duplicate evidence identities.
- Validate safe R2 keys and conditional options without invoking attacker accessors.
- Reject contradictory predicates and noncanonical ETags.

### Profiles, workspaces and layers

- Require sorted unique profile indexes with exact record membership.
- Bind profile records, SBOMs and attestations to deterministic keys.
- Bind workspace and layer references to their owning namespaces.
- Make revocation retries idempotent and conflict-safe.

### Campaigns, jobs, evidence and reports

- Recover partial immutable publications for campaigns, jobs, attempts, events, artifacts, evidence, attestations and reports.
- Keep active and terminal job indexes synchronized.
- Reject generic terminal-transition bypass.
- Make completion and cancellation retries idempotent and conflict-safe.
- Preserve accepted public method return shapes through a small wrapper around the internal recovery service.

## Phase 4–6 provenance

| Phase | Accepted source | Destination | Profiles |
|---|---|---|---:|
| 4 | `8beb17a3f4a9df0a32a07caf19fc17fb633d4d75` | exact changed path | 6 |
| 5 | `dd78a76f9546c85e79357a617b219067704c1616` | exact except one repair | 4 |
| 6 | `1b20f634b6d3c5f1261d490e545415c81d7488f2` | exact changed paths | 3 |

### Phase 5 terminal repair

- Path: `packages/audit-phase5-parsers/src/common.mjs`
- Source blob: `dab342010fd465aa7b637b76d4eb5058ebd3174e`
- Destination blob: `d25b446851a8393239f7f720b668e071a9df3232`
- Rule: timeout, cancellation and resource exhaustion emit `exitCode: null`, irrespective of a raw process exit code.

## Exact production path registries

The master pointer binds three production registries by Git blob SHA:

| Registry | Operations | Blob SHA |
|---|---:|---|
| Phase 1–3 | 8 | `3789f541564812ba2680231c373cb75c7d149b31` |
| Phase 4–6 | 29 | `149874168b0a9ac4409a9feab15eda21dd4537d7` |
| Release integration | 10 | `e0c9e3954ff1eca871c8a1288ddec10fa6a9580f` |

Total production path operations: **47**. Each operation records exact source head, source blob, destination blob, adaptation kind and repair ID where applicable.

## Release-integration spine

Package: `packages/audit-release-integration`

Public contracts:

- `audit-public-interface-lock-v1`
- `audit-release-component-manifest-v1`
- `audit-shared-file-union-v1`
- `audit-release-intake-plan-v1`
- `audit-release-integration-manifest-v1`

The package is split into focused boundary, contracts, digest, interface-lock, component-manifest, shared-union, intake, release-manifest and public-index modules. It is in-memory validation only and imports no filesystem, process, network, VM, package manager, credential, wallet, signing, transaction, deployment or workflow capability.

The final source review found and repaired four defects in the initial compact spine:

1. real camelCase and uppercase JavaScript export names could not be locked;
2. the required `ACCEPT WITH REPAIR` recommendation string was rejected;
3. protected-path checks were exact-only rather than hierarchy-aware;
4. declared shared-file unions could not authorize exact overlapping ownership safely.

A fifth defect was observed during GREEN verification: a validated interface lock was fed back into a creator that forbade its own `lockSchemaVersion`. The modular implementation fixes the root cause by reconstructing creator input from validated fields.

## Verification evidence

### Current Round 3 focused evidence

- Tests/scenarios: **38**
- Passed: **38**
- Failed: **0**

This is composed of:

- 23 unchanged exact-blob Phase 1–8/protected/static scenarios retained from the prior exact-tree run;
- 15 exact-blob integration-spine scenarios rerun after the final modular repair.

The 15 integration tests include **32 explicit hostile/intake variants** and an independent Node `crypto` check proving the built-in deterministic SHA-256 digest over canonical JSON.

### Accepted source evidence

- Phase 4: 29/29 tests, 14 fixture payloads.
- Phase 5: 36/36 tests, 16 fixture payloads.
- Phase 6: 59/59 tests, 73 fixture payloads.
- Aggregate: **124/124 accepted-source tests** and **103 fixture payloads**.
- Minimum explicit mutation vectors: **146** when the 32 current release-intake variants are included.

### Transport limitation

Normal Git transport remained unavailable. Verification used GitHub content-addressed blob readback and local Node execution of byte-identical files. No dependency was installed or downloaded.

## Protected blobs

| Path | Blob SHA |
|---|---|
| `.github/workflows/github-native-simulate.yml` | `54e446d4a715ca9678ed4d7434f7ba90b2c67c96` |
| `packages/runner/src/rpc-method-policy.mjs` | `59dfa72f41a697d533720a4d8f939a81aeba6736` |
| `packages/runner/src/fork-rpc-guard.mjs` | `73690f16b506baa50ca471ce5b5566ccb601e765` |
| `packages/runner/src/run-job.mjs` | `e6489c756d43a2f294120ac3c84687030fb919db` |
| `packages/github-native-sim/src/fork-rpc-proxy.mjs` | `4d7e2bd1114f5a37914b26447c9c79a1e40a58e6` |
| `packages/github-native-sim/src/run-job-file.mjs` | `8c4c82d76e249b74efc630c8cbf0d7707d25b5f2` |

## Round 4 deterministic intake

Master gate: #119. Stage A reviews: #120, #121, #123 and #124. Stage B assembly: #122.

Required order:

1. create the Round 4 integration branch from the completed Worker 2 final SHA;
2. intake reviewed/repaired Worker 0 Phase 7–8 paths;
3. intake reviewed/repaired Worker 1 API paths;
4. intake reviewed/repaired Worker 3 GitHub Direct paths and trusted workflow;
5. intake reviewed/repaired Worker 4 web paths;
6. construct shared files field by field from committed union manifests;
7. restore the approved main-line simulation addon byte-for-byte;
8. freeze one assembled SHA for all independent acceptances.

Representative commands:

```text
git switch --create audit-round4/full-platform-integration-v1 <worker-2-finalSha>
git checkout <accepted-candidate-sha> -- <exact-owned-path-1> <exact-owned-path-2> ...
node --test test/audit-round3-*.test.mjs test/audit-round4-integration-*.test.mjs
git diff --check
git rev-parse HEAD
```

Traditional source-branch merges and whole-side shared-file conflict resolution are forbidden.

## Round 5 production handoff

Production acceptance is issue #125. The committed handoff contains required secret and variable **names only**, Cloudflare domains/resources, R2 bucket/CORS expectations, seven read-only RPC networks, trusted workflow assumptions, observability, rollback and recovery plans.

No production secret value was retrieved, printed or committed. No deployment, workflow, RPC request, wallet operation, signing, transaction or broadcast occurred in Round 3.

## Residual risks

1. Phase 7–8 implementation on this branch remains a frozen stale input and must be replaced during Round 4.
2. API, GitHub Direct and web candidates remain external Round 4 inputs.
3. Live Cloudflare, R2, GitHub, DNS, TLS, RPC, quota, cost and rollback behavior remains untested until Round 5.
4. Repository-wide dependency-backed tests remain for the assembled candidate; this assignment used only permissible direct Node and static checks without installation.

## Final assessment

The Phase 1–6 implementation and release-integration spine are suitable for independent Round 4 review. The branch preserves an execution-disabled validation/storage boundary, provides complete exact source/blob provenance for 47 production path operations, and supplies deterministic intake, overlap, shared-file, interface and capability gates for the remaining release candidates.
