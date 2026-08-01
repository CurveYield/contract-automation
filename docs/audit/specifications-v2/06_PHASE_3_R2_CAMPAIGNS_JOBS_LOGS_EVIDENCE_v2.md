# Phase 3 — R2 Campaigns, Jobs, Logs, and Evidence v2

## State model

Each logical resource uses immutable creation records, ETag-protected mutable current state, immutable event batches, and deterministic child indexes. Server-side services read and merge their own indexes; callers may provide an expected ETag but never author the authoritative index or full status record.

`ListObjects` is forbidden in user-facing and polling paths. Reads use deterministic keys from indexes or manifests.

## Job lifecycle

```text
submitted -> validating -> admitted -> queued -> awaiting_executor
awaiting_executor -> provisioning -> running -> collecting_evidence
terminal: completed | failed | cancelled | timed_out | policy_rejected
```

Public jobs stop at `awaiting_executor` and return `execution_plane_unavailable`. Fixture-only continuation requires an internal signed, replay-protected request and an explicit disabled-by-default deployment flag.

## Heartbeats and completion

Heartbeats read the authoritative job status, validate the current attempt, and conditionally overwrite that status. Normal cost is **1 Class A and 1 Class B operation**.

Completion reads authoritative status and the campaign job index, then writes final status, a terminal event batch, and the merged campaign index. Normal cost is **3 Class A and 2 Class B operations**.

## Logs

- deterministic `job-logs/` keys;
- one MB target chunks;
- monotonically increasing sequence numbers;
- current status carries the highest committed sequence;
- one authoritative status read, one chunk write, and one conditional status write per chunk;
- seven-day lifecycle retention;
- maximum 64 chunks per attempt;
- exact partial writes are retryable.

One log chunk costs **2 Class A and 1 Class B operation**. Reading a typical eight-chunk set costs **9 Class B operations**.

## Large artifacts, evidence, and reports

Large bundle bytes never travel inside the Worker JSON request. A trusted producer uploads to a deterministic one-day ingress key and sends an `audit-object-reference-v1` callback containing the key, digest, size, type, and expiry. The reference expires within one hour and is bound to the active job attempt.

Raw artifacts are copied to `job-artifacts/` with seven-day retention. Upload plus publication costs **3 Class A and 2 Class B operations**.

Evidence acceptance reads status and ingress, writes a quarantine copy, validates it, writes accepted evidence, manifest, and a control-plane-generated Ed25519 attestation, then deletes the quarantine copy for free. Upload plus acceptance costs **5 Class A and 2 Class B operations**. Caller-authored attestations are forbidden.

Report publication reads status, ingress, and the server-owned report index, then writes the report bundle, manifest, and merged index. Upload plus publication costs **4 Class A and 3 Class B operations**.

## Production truth

Function-valued adapters are test-only and require `AUDIT_TEST_MODE=true`. Production capability/readiness responses derive booleans from deployable R2 bindings and configured secrets. Evidence acceptance and report publication remain unavailable in production until their trusted producer, validator, and signer integrations are configured.

## Cancellation and resume

Cancellation and resume are durable R2 state transitions. They become active executor commands only after a hardened compute adapter is connected.
