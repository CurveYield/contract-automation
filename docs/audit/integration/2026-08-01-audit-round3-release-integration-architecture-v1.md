# Audit Round 3 Release Integration Architecture v1

## Authority

- Branch: `audit-round3/phases1-8-release-integration-v1`
- Starting SHA: `5f834d9702a4d28061222a64cfa9d870c97a4978`
- Worker: `worker-2`
- Issue: `#114`
- This document defines deterministic Round 4 intake. It does not authorize execution, deployment, workflow changes, or source-branch merges.

## Source authority

| Component | Authoritative accepted source | Intake status |
|---|---|---|
| Phases 1–3 | `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c` | owned by this branch |
| Phase 4 | `8beb17a3f4a9df0a32a07caf19fc17fb633d4d75` | owned by this branch |
| Phase 5 | `dd78a76f9546c85e79357a617b219067704c1616` plus documented terminal-exit repair | owned by this branch |
| Phase 6 | `1b20f634b6d3c5f1261d490e545415c81d7488f2` | owned by this branch |
| Phase 7–8 final | Worker 0 final candidate slot | replace stale issue #97 paths in Round 4 |
| API final | Worker 1 final candidate slot | exact owned-path transplant only |
| GitHub Direct final | Worker 3 final candidate slot | exact owned-path transplant only |
| Web final | Worker 4 final candidate slot | exact owned-path transplant only |

## Intake order

1. Verify the Round 3 base SHA and all protected blobs.
2. Verify each external candidate branch, issue report, final SHA, and changed-path allowlist.
3. Transplant Worker 0 Phase 7–8 paths, replacing the stale issue #97 production paths atomically.
4. Transplant Worker 1 API-owned paths.
5. Transplant Worker 3 GitHub Direct-owned paths.
6. Transplant Worker 4 web-owned paths.
7. Apply documented shared-file unions only after all owned-path transplants.
8. Run the required post-intake test gate after every candidate and again after the complete union.
9. Reject rather than repair any candidate whose SHA, blob, ownership, public export, schema version, or protected-path state differs from its registered manifest.

## Ownership and overlap rules

- A path may have exactly one owning candidate unless it is registered as a shared-file union.
- Candidate manifests must enumerate every added, modified, renamed, and deleted path.
- Unregistered paths, stale SHAs, missing source blobs, duplicate destinations, parent/child ownership collisions, and modifications to protected paths are hard failures.
- Phase 7–8, API, GitHub Direct, and web production paths are frozen on this branch.
- Branch merges are forbidden; intake is path-level and provenance-preserving.

## Shared-file union rules

A shared file may be changed only when its manifest declares:

1. base blob SHA;
2. ordered candidate inputs;
3. field- or export-level ownership;
4. deterministic union function;
5. expected destination digest;
6. tests proving no export deletion, substitution, duplication, or capability broadening.

No textual conflict resolution, last-writer-wins behavior, manual copy, or undocumented formatting rewrite is accepted.

## Public interface locks

Each component lock contains:

- component ID and schema version;
- public entrypoint paths;
- sorted export names;
- profile/parser/result/catalog identity matrices where applicable;
- storage-key namespace ownership;
- capability flags;
- execution state;
- accepted source SHA and destination blob digest.

Public interfaces may be extended only by an explicitly versioned lock. Existing exports, identity pairs, lifecycle labels, evidence contracts, error codes, and storage prefixes may not silently change.

## Capability composition

The composed release remains metadata/validation/storage only. Every intake must preserve:

- `executionEnabled: false`;
- unavailable executor state;
- no process spawn, shell, dynamic code, package installation, arbitrary URL, network/RPC, wallet, signing, transaction, broadcast, deployment, container, image, or workflow capability;
- exact preservation of current-main GitHub-native simulation and RPC-policy blobs.

Capability composition is deny-by-default. A component may only contribute capabilities listed in its registered public contract, and no union may turn a false/unavailable capability into true/available.

## Replacement procedure for stale Phase 7–8

The issue #97 Phase 7–8 files on this branch are superseded inputs, not accepted release code. Round 4 must:

1. validate Worker 0's registered final SHA and issue report;
2. compare Worker 0's owned-path list with the stale Phase 7–8 list;
3. delete stale paths absent from the final manifest only when deletion is explicitly registered;
4. replace matching owned paths using Worker 0 source blobs;
5. add new registered owned paths;
6. verify no Phase 1–6, API, GitHub Direct, web, runner, workflow, Lite, deployment, or secret path changed;
7. rerun public-interface, cross-system, protected-blob, and changed-path gates.

## Required post-intake gates

- source SHA/blob verification;
- changed-path allowlist and ownership overlap check;
- public export and schema/version lock check;
- profile/parser/result/catalog compatibility;
- tenant/workspace/campaign/job/evidence/report identity consistency;
- persistent-fork and clean-room public-contract compatibility without transport internals;
- hostile-object, mutation, stale-CAS, retry, cancellation, quota, duplicate/conflict, and version-skew tests;
- execution-disabled static scan;
- syntax, JSON, manifest, protected-blob, and whitespace/diff checks.

## Failure policy

Any missing evidence is a rejection, not an assumption. Round 4 may perform deterministic source transplants and declared shared-file unions only; behavioral repair returns to the owning worker or a new explicitly assigned issue.
