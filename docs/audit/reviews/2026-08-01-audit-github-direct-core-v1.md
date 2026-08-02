# GitHub Direct Core v1 Review

## Recommendation

**ACCEPT**

The isolated GitHub Direct core implements a runtime-neutral, repository-native control plane without importing or modifying the existing Cloudflare audit path. It provides strict request/state/publication contracts, an exact repository ledger, a dependency-injected least-privilege adapter, and an execution-disabled runner with repository-owned inert fixture modeling only.

## Assignment

- Worker: `worker-3`
- Issue: `#98`
- Mailbox sequence: `5`
- Branch: `audit-phase9/github-direct-core-v1`
- Starting SHA: `c1f624cee5de9644736d6ab8f967661e6ae348fd`
- Mode ID: `github-direct-audit-v1`
- Control branch: `audit-direct/control-v1`
- Automatic fallback: `false`
- Exact final SHA: recorded in the final issue report and mailbox completion event after this review is committed.

The issue-named approved specification and implementation-plan files were absent at the assigned SHA, default branch, and searchable repository branches. Issue #98 was therefore used as the authoritative complete contract. No external interface was invented outside its sixteen ordered sections.

## Package map

### `audit-github-direct-protocol`

Eight focused modules implement constants, bounded errors, runtime-neutral SHA-256, hostile object boundaries, exact requests, lifecycle records, and result/report/capability publication contracts.

### `audit-github-direct-ledger`

Seven focused modules implement exact `.audit-direct/v1/**` paths, immutable/CAS mutation plans, server-owned indexes, state transitions, request publication, validators, and deterministic partial-write recovery.

### `audit-github-direct-adapter`

Six focused modules implement least-privilege permission projection, redacted transport errors, deterministic Check/comment/status plans, metadata-only artifacts, publication validation/reconciliation, and exact identity-bound injected dispatch.

### `audit-github-direct-runner`

Five focused modules implement the immutable fixture allowlist, exact admission, execution-disabled orchestration, truthful result/report publication planning, and a stable facade.

## Test-first evidence

### Initial package-map RED

```text
node --test test/audit-github-direct-cross-mode-v1.test.mjs
5 tests
0 passed
5 failed
```

### Protocol checkpoint

```text
19 tests
19 passed
0 failed
```

### Ledger checkpoint

```text
31 tests
31 passed
0 failed
```

### Adapter checkpoint

```text
42 tests
42 passed
0 failed
```

### Runner and security completion candidate

```text
node --test test/audit-github-direct-*.test.mjs
57 tests
57 passed
0 failed
0 cancelled
0 skipped
```

## Mutation and hostile-input totals

- protocol top-level one-field mutations: 73;
- ledger top-level output mutations: 35;
- runner admission/outcome/publication mutations: 46;
- aggregate direct one-field mutation total: 154;
- additional hostile reflection, accessor, prototype, sparse-array, cycle, unsafe integer, control-character, mutable-ref, credential, URL, command, workflow, runner/image, and execution-flag cases are separate from that total.

Every invalid contract result is bounded by deterministic code/path data.

## Request identity table

| Field | Requirement |
|---|---|
| Repository | Numeric ID plus canonical full name |
| Authorization | Numeric installation ID and requester ID |
| Policy | Versioned policy slug |
| Tool contract | Versioned profile and parser |
| Output contract | Versioned result and report contracts |
| Source | Exact lowercase 40-hex commit SHA |
| Replay | Canonical timestamp and idempotency key |

Mutable refs, credentials, commands, workflows, runner labels, images, URLs, RPC endpoints, and execution flags are not accepted fields.

## Ledger truth table

| Operation | Preconditions | Result |
|---|---|---|
| Immutable create | Ledger path; no expected SHA | Create-only plan |
| Immutable retry | Existing digest equals planned digest | Converged no-op |
| Immutable conflict | Existing digest differs | Reject |
| CAS update | Current blob SHA equals expected | Conditional update |
| CAS retry | Current equals planned next SHA | Converged no-op |
| Stale CAS | Current differs from expected/next | Reject |

No prefix listing or repository-path discovery exists.

## Adapter permission and publication table

The adapter projects only `contents:read/write`, `checks:write`, `issues-comments:write`, `statuses:write`, and Actions artifact metadata read. It never accepts or serializes credential material.

Publication reconciliation is create/no-op/conflict. The adapter validates all publication fields and hashes before dispatch. Fake-transport tests prove exact method traces and no duplicate publication on replay.

## Runner admission/outcome table

| Admission | Terminal truth | Check | Status |
|---|---|---|---|
| Exact repository-owned inert fixture | `modeled_fixture`, `executionPerformed:false` | `success` | `success` |
| Valid non-fixture | `execution_unavailable`, null result digest | `neutral` | `error` |
| Source/identity/capability drift | Reject | None | None |
| Request-selected execution/fixture/command/workflow | Reject request | None | None |

No submitted project is executed.

## Security boundary

Production packages contain no:

- Cloudflare/R2/API/web/Lite imports;
- automatic fallback to `cloudflare-audit-v1`;
- Node built-in imports;
- filesystem, repository enumeration, process, shell, worker, network client, RPC, socket, or dynamic-code capability;
- package-manager, container, wallet, signer, transaction, deployment, workflow, PR, or merge capability;
- credential, bearer-token, private-key, mnemonic, signed-URL, or authorization-header serialization.

The adapter requires an injected transport; tests use inert fakes. The runner is data-only and execution-disabled.

## Documentation

- `docs/audit/github-direct/CORE_PROTOCOL_v1.md`
- `docs/audit/github-direct/REPOSITORY_LEDGER_v1.md`
- `docs/audit/github-direct/INJECTED_ADAPTER_v1.md`
- `docs/audit/github-direct/RUNNER_BOUNDARY_v1.md`

## Blocked checks and residual risks

- Live GitHub transport integration is intentionally outside this package and requires independent review.
- No real GitHub API, Check, status, comment, artifact, or contents mutation was executed.
- Repository-owned fixture identities remain explicit code changes and require review when expanded.
- Future execution adapters must be separate, disabled by default, and may not reinterpret modeled fixture results as external execution.
- Operation permissions must be revalidated against the final GitHub App installation configuration.

No dependencies were installed or downloaded. No compilation, submitted-project execution, process, network call, container, RPC, wallet, signing, transaction, deployment, workflow change, PR, or merge to `main` occurred.
