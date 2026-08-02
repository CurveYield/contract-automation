# GitHub Direct Repository Ledger v1

## Branch and layout

All ledger mutations target `audit-direct/control-v1`. Data paths are confined to:

```text
.audit-direct/v1/requests/{jobId}.json
.audit-direct/v1/current/{jobId}.json
.audit-direct/v1/events/{jobId}/{eventId}.json
.audit-direct/v1/results/{jobId}/{resultId}.json
.audit-direct/v1/reports/{jobId}/{reportId}.json
.audit-direct/v1/manifests/{jobId}.json
.audit-direct/v1/indexes/jobs-v1.json
```

Callers cannot provide arbitrary ledger paths, use `..`, select `latest`, or trigger prefix discovery.

## Mutation model

Immutable records use create-only plans with no expected blob SHA. Mutable current pointers and server-owned indexes use exact lowercase 40-hex blob-SHA compare-and-swap plans.

| Condition | Result |
|---|---|
| Immutable path absent | Create immutable record |
| Same immutable digest already observed | Idempotent convergence |
| Different immutable digest observed | `immutable_conflict` |
| Current blob SHA equals expected | CAS update |
| Current blob SHA already equals planned next blob SHA | Idempotent convergence |
| Current blob SHA differs from expected and next | `stale_blob_sha` |

## State machine

Canonical paths include:

```text
requested -> validating -> admitted
admitted -> awaiting_executor -> execution_plane_unavailable
admitted -> fixture_running -> publishing -> completed
```

Failure, cancellation, and policy rejection are explicit. Terminal states cannot transition. Every accepted transition plans one immutable event, one current-pointer CAS update, and one server-owned index CAS update.

## Recovery

Partial-write recovery validates every supplied plan, rejects duplicate planned paths, compares exact immutable digests, and evaluates current blob SHAs without listing repository contents. Repeated recovery with identical observations is byte-stable.
