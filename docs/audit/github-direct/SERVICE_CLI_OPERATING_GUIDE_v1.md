# GitHub Direct Service and CLI Operating Guide v1

## Public entry points

Use only:

```text
packages/audit-github-direct-service/src/index.mjs
apps/audit-github-direct-cli/src/main.mjs
```

Do not import private `service.mjs` directly. The public service facade emits the self-attesting v2 result contract.

## Public schemas

| Record | Schema |
|---|---|
| command | `github-direct-service-command-v1` |
| result | `github-direct-service-result-v2` |
| error | `github-direct-service-error-v1` |

Every v2 result includes a deterministic `resultId` and `resultDigest`. Validate every command before execution and every result/error before serialization.

## Commands

| Command | Purpose |
|---|---|
| `submit` | publish the request/admission records; non-fixtures stop at `awaiting_executor` |
| `status` | read the server-derived current pointer |
| `cancel` | publish immutable cancellation result/report and terminalize the job |
| `report` | publish truthful terminal or execution-unavailable reporting |
| `capabilities` | return the least-privilege permission manifest |
| `verify-fixture` | perform pure exact-SHA allowlist verification without execution |

No command accepts arbitrary paths, URLs, shell commands, workflow scope, runner labels, images, credentials, mutable refs or submitted-execution flags.

## CLI behavior

The CLI:

1. parses only the fixed command-specific flags;
2. creates and validates the command contract;
3. invokes the injected service;
4. validates the returned service error or v2 result;
5. emits stable sorted JSON and a stable exit code.

The trusted CLI contains a narrow command-bound migration adapter for an internally injected legacy v1 result. It verifies mode, command kind, job, target SHA and fallback truth, then reconstructs and validates a v2 result. External APIs must not accept v1.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | completed or accepted successfully |
| 2 | invalid CLI input |
| 3 | authorization denied |
| 4 | stale state or publication conflict |
| 5 | execution plane unavailable |
| 6 | malformed response or other service failure |

## Required request identity

Every command binds:

- numeric repository ID;
- numeric installation ID;
- canonical lowercase repository full name;
- requester ID;
- policy/profile/parser/result/report versions;
- exact 40-character target commit SHA;
- canonical timestamps;
- idempotency key.

Mixed-case GitHub repository names normalize to lowercase before job IDs and digests are derived.

## State behavior

- Non-fixture `submit` ends at `awaiting_executor`, publishes one neutral Check and remains cancellable.
- Allowlisted inert fixture `submit` may publish a modeled completed result with `executionPerformed:false`.
- `report` from `awaiting_executor` moves truthfully to `execution_plane_unavailable`.
- `cancel` creates immutable cancellation result/report records and publishes status/comment records.
- Exact replay converges to no-op publication decisions; changed replay content conflicts.

## Workflow configuration

Repository-owned variables:

```text
GITHUB_DIRECT_INSTALLATION_ID
GITHUB_DIRECT_REPORT_ISSUE
```

Workflow callers provide only a fixed operation and exact target SHA. Trusted runner source comes from `github.workflow_sha`; target source is checked out separately as inert data.

## Verification

```text
node --test test/*.test.mjs
find packages/audit-github-direct-* apps/audit-github-direct-cli/src -type f -name '*.mjs' -print0 | xargs -0 -n1 node --check
```

Also parse the workflow YAML and Round 3 JSON manifests, run whitespace checks, verify issue-owned changed paths, and verify protected simulation/RPC blobs.

## Prohibited operations

Do not install dependencies, execute submitted project code, add Cloudflare/R2 fallback, expose credentials, perform wallet/signing/transaction work, deploy, approve workflows, or merge from this package.
