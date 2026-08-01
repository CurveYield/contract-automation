# Phase 7 Control Storage and Inert Mock Acceptance Review v1

## Final recommendation

**ACCEPT**

The Phase 7 persistent-fork control plane, R2-style state storage, checkpoint/export/restore/delete contracts, and deterministic inert mock adapter satisfy the assigned control/storage-only scope. Real fork execution remains unavailable and is represented only by `awaiting_executor`. The trusted mock is deterministic, bounded, non-networked, non-signing, and non-deploying.

## Assignment identity

- Worker: `worker-0`
- Mailbox sequence: `2`
- Message ID: `worker-0-phase7-control-storage-mock-v1-000002`
- Issue: `#80`
- Branch: `audit-phase7/control-storage-mock-v1`
- Starting SHA: `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c`
- First implementation checkpoint: `cb4b8708b59f55349fb5e4252f2aef452ee85e82`
- Assignment blob SHA: `d21ee6f22385f74f1dfc163bec8afaa2ddb9a1bc`

## Implemented surface

### `packages/audit-fork-protocol`

Provides strict, versioned, exact-key validators and deterministic key builders for:

- immutable fork creation requests and canonical SHA-256 request digests;
- current fork state and immutable transition events;
- bounded fork action requests and deterministic action results;
- checkpoint, export, restore, tombstone, and quota-capability manifests;
- deterministic inert mock requests and results;
- complete fork-state and transition truth tables;
- tenant, attempt, workspace, campaign, profile, chain, block, checkpoint, export, and restore identities.

The protocol rejects mutable block tags, unknown fields, unsafe integers, accessors, cyclic data, unbounded values, credentials, wallets, signers, RPC/network endpoints, transaction/broadcast intent, executable scripts, containers, deployment fields, and dynamic-code capability.

### `packages/audit-forks`

Provides a control/storage service over the accepted neutral audit store interface:

- immutable request/event/action/checkpoint/export/restore/tombstone records;
- compare-and-swap current-state transitions;
- monotonic state versions and terminal-state protection;
- server-owned tenant, checkpoint, and export indexes;
- partial-write reconciliation and idempotent retries;
- checkpoint size/digest/identity verification before publication;
- restore/export reference validation without copying opaque checkpoint bytes;
- deletion through server-owned indexes followed by immutable tombstone publication;
- per-operation billing classification for `put`, `get`, `head`, and `delete`.

No storage `list` or `copy` operation is used.

### `packages/audit-fork-mock-adapter`

Provides a deterministic inert adapter with no external execution:

- synthetic fork creation;
- bounded block/time advancement;
- bounded read-call and state-inspection results;
- bounded state overrides represented only as data;
- deterministic snapshots and restores;
- explicit deterministic failure and cancellation modes;
- byte-identical output for byte-identical input/state.

The adapter does not access a network RPC, wallet, private key, signer, process, container, deployment system, or submitted project.

## State and transition contract

States:

`requested`, `awaiting_executor`, `ready`, `checkpointing`, `restoring`, `exporting`, `deleting`, `deleted`, `failed`, `cancelled`.

Key rules:

- External/real fork creation: `requested -> awaiting_executor` only.
- Trusted inert mock creation: `requested -> ready`.
- Ready forks may enter checkpoint, restore, export, delete, failure, or cancellation workflows.
- Checkpoint/restore/export workflows return to `ready` or terminate in delete/failure/cancellation.
- Delete completes as `deleting -> deleted`.
- `deleted`, `failed`, and `cancelled` are terminal.
- Every transition requires tenant/attempt ownership, the expected current ETag, the expected source state, and a unique transition ID.
- Repeating the same transition ID reconciles the immutable event/index and returns the already-written state rather than advancing twice.

## Storage and index model

Authoritative object families include:

- immutable request: `forks/{forkId}/request-v1.json`;
- CAS current state: `forks/{forkId}/current-v1.json`;
- immutable events: `forks/{forkId}/events/{version}.json`;
- immutable action results: `forks/{forkId}/actions/{actionId}-result-v1.json`;
- opaque checkpoint object and immutable manifest;
- immutable export and restore manifests referencing the exact checkpoint object/digest;
- immutable fork tombstone;
- server-owned tenant/checkpoint/export indexes.

Indexes are deterministic, sorted, CAS-updated, and recoverable from a partial write without caller-authored snapshots. The implementation intentionally does not enumerate the bucket.

## Quota, retention, and operation-cost contract

Free-development limits:

- checkpoint target: 250 MB;
- checkpoint hard maximum: 1 GB;
- active checkpoints per fork: 8;
- active checkpoint retention: 1 day;
- exported checkpoint retention: 7 days;
- real execution: disabled / awaiting external executor.

Fresh measured operation traces:

| Operation | Class A | Class B | Free |
|---|---:|---:|---:|
| Trusted mock create | 6 | 4 | 0 |
| Checkpoint publication | 3 | 3 | 0 |
| Export manifest publication | 2 | 3 | 0 |

Each trace is generated by the service wrapper and classified through the accepted R2 operation classifier. Tests assert that no `list` or `copy` operation appears.

## Test-first evidence

### RED

Initial command:

```text
node --test test/audit-phase7-*.test.mjs
```

Observed result before production modules existed:

```text
tests 11
pass 0
fail 11
```

All eleven behavior tests failed because the assigned Phase 7 modules were absent. Additional isolated RED cases were demonstrated for the restore contract and restore-service persistence path before implementation.

### GREEN

Final commands:

```text
node --check <every Phase-7 production and focused test module>
node --test test/audit-phase7-*.test.mjs
```

Final result:

```text
tests 25
pass 25
fail 0
cancelled 0
skipped 0
duration_ms 722.75451
```

Coverage includes:

- exact public contracts and immutable identities;
- canonical digests and strict graph validation;
- complete transition truth table;
- tenant/attempt authorization;
- compare-and-swap and stale-state rejection;
- idempotent transition/create retries;
- partial-write recovery and server-owned index reconciliation;
- bounded action schemas and forbidden-capability rejection;
- checkpoint object/manifest verification and eight-checkpoint quota;
- one-day/seven-day retention contracts;
- export without copying byter;
- restore manifest persistence;
- delete/tombstone behavior;
- exact operation-class traces;
- deterministic mock replay, checkpoint, restore, state overrides, failure, and cancellation.

## Static boundary evidence

The final production and focused test tree passed:

- JavaScript syntax checking;
- package JSON parsing;
- forbidden network/process/dynamic-code/execution-capability scan;
- accepted-neutral-import allowlist scan;
- absence of storage `list()` and `.copy()` calls;
- explicit execution-disabled/awaiting-executor contract checks;
- trailing-whitespace scan.

The starting-SHA comparison for checkpoint `cb4b8708...` contains exactly 25 authorized paths under the three assigned packages and focused Phase-7 test prefixes. It contains no API, web, workflow, CurveYield Lite, Phase 1–2, Phase 4–6 tool implementation, production secret, deployment, or unrelated path.

## Blocked checks

Not run because the assignment prohibits or the connector-only environment cannot support them:

- dependency installation or package-manager commands;
- compilation or build commands;
- full repository test suite requiring a complete checkout;
- real RPC/fork execution;
- submitted-project or external audit-tool execution;
- container execution;
- deployment or workflow approval.

No success is claimed for those checks.

## Residual risks and follow-up boundaries

1. **No real executor integration.** Real fork requests intentionally remain `awaiting_executor`. A later phase must provide a separately authorized hardened executor adapter.
2. **Opaque checkpoint trust boundary.** The control plane verifies declared bytes, digest, size, chain and block identity but cannot interpret executor-private checkpoint bytes.
3. **Index lifecycle metadata.** Delete removes checkpoint/export objects and manifests and writes a tombstone; server-owned indexes retain lifecycle metadata for deterministic audit/reconciliation rather than disappearing.
4. **In-memory acceptance store.** Behavioral tests use the accepted in-memory neutral store. A later integration phase must rerun the same contracts against the production R2 binding without weakening CAS behavior.
5. **No API/web exposure in this assignment.** Route/auth/UI features integration remains outside this package-only scope.

## Security confirmation

No dependency was installed or downloaded. No compilation, build, network/RPC request, wallet/signing operation, submitted project, external audit tool, container, deployment, workflow approval, production secret, AWS resource, CurveYield Lite path, Phase 1–6 path, Phase 4​6 tool implementation, PR merge, or `main` merge was performed.
