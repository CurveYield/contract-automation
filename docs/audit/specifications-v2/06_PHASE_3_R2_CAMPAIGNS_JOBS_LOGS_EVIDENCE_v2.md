# Phase 3 — R2 Campaigns, Jobs, Logs, and Evidence v2

## State model

Each logical resource has:

- one immutable creation record;
- one mutable current-state object updated with ETag conditions;
- immutable event batches containing up to 32 events or five minutes;
- deterministic child indexes.

`ListObjects` is forbidden in user-facing and polling paths because it is Class A. All reads use known keys from indexes or manifests.

## Job lifecycle

```text
submitted -> validating -> admitted -> queued -> awaiting_executor
awaiting_executor -> provisioning -> running -> collecting_evidence
terminal: completed | failed | cancelled | timed_out | policy_rejected
```

Until the external executor is approved, valid jobs stop at `awaiting_executor` and return `execution_plane_unavailable`. Fixture-only jobs may continue under an internal trusted-fixture scope.

## Logs

- one MB target chunks;
- monotonically increasing sequence numbers;
- one PUT per chunk;
- current status carries the highest committed sequence;
- no per-poll object listing;
- seven-day free-development retention;
- maximum 64 chunks per attempt unless an operator raises the profile cap.

## Heartbeats

The default worker heartbeat interval is 60 seconds. Heartbeats overwrite one current-status key and therefore consume one Class A operation but do not accumulate storage. Immutable lifecycle events are batched separately.

## Artifacts and evidence

Raw artifacts are one compressed bundle plus one manifest. Evidence acceptance writes a quarantine bundle, accepted bundle, manifest, and attestation. Reports are bundled rather than split into many objects.

## Cancellation and resume

Cancellation and resume are durable R2 state transitions. They become active executor commands only after a hardened compute adapter is connected. Before then, they are fully testable as state-machine and authorization behavior.
