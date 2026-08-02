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

## Exact transport response contracts

Every injected transport response is validated before it is returned to service code. Repository and commit responses must repeat the exact repository ID/full name or target SHA. Blob and contents responses must repeat the requested blob/path and, when supplied, the exact source or control ref. Ledger mutation responses are limited to an applied flag, a valid Git blob SHA, and an optional commit SHA. Publication responses must repeat the validated publication ID. Hostile getters, revoked proxies, unknown fields, malformed identities, and under-specified responses reject with bounded errors.

The planner's deterministic `nextContentBlobSha` is a content fingerprint used for retry modeling; it is not asserted equal to GitHub's repository blob SHA. The transport validates both domains independently.

## Approved repaired-core lineage

The production adapter and runner contracts are the exact accepted versions from consolidated repaired-core SHA `22c22dd9de0e21b066ac29c9e0d9422a73724a31`. Mutation responses expose the planner's deterministic content fingerprint. GitHub's native blob SHA is retained only inside the trusted transport for Contents API writes and is never substituted into planner records.
