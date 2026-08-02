# GitHub Direct Authorization and Reporting v1

## Injected authorization

The authorization broker accepts only an injected provider function. The provider receives token-free identity and requested capabilities. It returns:

- authorization kind (`github-token` or `app-installation-token`);
- exact repository, installation, full-name and target-SHA attestation;
- issued and expiry timestamps;
- the exact requested capability set;
- an opaque transport implementing the closed adapter method set.

Transport objects are inspected through property descriptors. Accessors, revoked proxies, custom prototypes, extra methods and missing methods reject without invoking attacker-controlled getters.

Tokens are not request fields, manifest fields, result fields, report fields, log fields or persisted ledger data.

## Operation capabilities

| Operation | Capabilities |
|---|---|
| submit | read source, write ledger, Check, status/comment for fixture completion, artifact metadata |
| status | read source/control contents |
| cancel | read source, write ledger, status and comment |
| report | read source, write ledger, status/comment and artifact metadata |
| capabilities | read source |
| verify-fixture | read source |

## Publication phases

Normal non-fixture submission publishes one neutral Check and remains at `awaiting_executor`. Terminal reporting later publishes status and comment without replacing the Check.

Fixture completion publishes Check, status and comment together. Cancellation publishes a `not_executed` result/report plus status and comment.

Publication records use deterministic kind/job idempotency slots:

- absent record: create;
- byte-identical record: no-op;
- conflicting record: reject.

Terminal replays use the stored outcome timestamp, so a later report invocation with identical content reconciles rather than duplicating.

## Artifact boundary

Artifact ingestion accepts at most 100 metadata entries. Each entry is limited to ID, bounded name, byte size, digest, expiry flag and timestamps. Artifact bytes, download URLs, signed URLs, archives and executable content are never fetched by this package.
