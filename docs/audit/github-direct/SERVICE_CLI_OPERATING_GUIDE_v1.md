# GitHub Direct Service and CLI Operating Guide v1

## Scope

The service completes the trusted control plane around `github-direct-audit-v1`. It composes the accepted protocol, repository ledger, injected adapter, and execution-disabled runner. It never falls back to `cloudflare-audit-v1` and never executes submitted source.

## Commands

| Command | Required behavior | Successful service state |
|---|---|---|
| `submit` | Create/reconcile request, admission and current state; publish one Check | `accepted` at `awaiting_executor`, or `completed` for an exact inert fixture |
| `status` | Read the exact derived current pointer | `completed` |
| `cancel` | Publish non-executed cancellation result/report and transition current state | `cancelled` |
| `report` | Publish terminal result/report, status and comment | `execution_plane_unavailable`, `completed`, or `cancelled` |
| `capabilities` | Return the operation-specific permission projection | `completed` |
| `verify-fixture` | Model only an exact repository-owned fixture tuple | `completed` or `execution_plane_unavailable` |

All commands require the same repository ID, installation ID, canonical full name, requester, policy/profile/parser/result/report versions, exact target SHA, request timestamp and idempotency key used for submission.

## Lifecycle

A normal submitted target remains cancellable:

```text
requested -> validating -> admitted -> awaiting_executor
```

A later `report` truthfully closes it:

```text
awaiting_executor -> execution_plane_unavailable
```

An exact repository-owned inert fixture follows:

```text
requested -> validating -> admitted -> fixture_running -> publishing -> completed
```

No lifecycle path sets `executionPerformed` to true.

## Stable request identity in the workflow

The workflow derives `requestedAt` from the exact target commit timestamp and derives the idempotency key from repository ID, target SHA and authenticated actor ID. Separate workflow runs by the same actor therefore address the same job. A different actor cannot silently substitute the original requester.

## CLI input boundary

The CLI accepts only fixed flags for the six commands. It does not accept a command string, source path, URL, workflow, runner, image, token, credential, policy override outside the fixed profile, RPC endpoint or execution switch.

Exit codes are stable:

| Code | Meaning |
|---:|---|
| `0` | Successful command |
| `2` | Invalid bounded input |
| `3` | Authorization denied |
| `4` | State or publication conflict |
| `5` | Execution plane unavailable |
| `6` | Other bounded service failure |

Output is one deterministic JSON object followed by one newline. Errors never include raw transport text or credentials.

## Operational prerequisites

- The control branch `audit-direct/control-v1` must exist.
- The workflow must be dispatched from the protected default branch.
- The GitHub token or injected installation capability must match the repository and installation in the request.
- Follow-up commands must use the same authenticated requester and exact target identity as submission.
