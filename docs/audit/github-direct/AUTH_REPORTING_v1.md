# GitHub Direct Authorization and Reporting v1

## Authorization boundary

`createInjectedAuthorizationBroker()` receives only canonical repository/install/full-name/requester/target-SHA identity and a closed capability list. The provider returns:

- a token-free authorization attestation;
- an opaque transport implementing the fixed adapter methods.

Tokens and authorization headers remain inside the trusted provider/transport closure. They are not command fields, result fields, reporting records, ledger content, logs or artifacts.

## Capability-to-permission mapping

| Capability | GitHub resource/access |
|---|---|
| `read-source` | contents: read |
| `write-control-ledger` | contents: write |
| `publish-check` | checks: write |
| `publish-comment` | issues/comments: write |
| `publish-status` | statuses: write |
| `read-artifact-metadata` | actions artifact metadata: read |

`validatePermissionManifest()` enforces exact fields, canonical ordering, duplicate absence, allowed pairs, identity, digest and derived ID.

## Operation capability subsets

| Operation | Capabilities |
|---|---|
| submit | read source, write ledger, Check/comment/status publication, artifact metadata read |
| status | read source |
| cancel | read source, write ledger, comment/status publication |
| report | read source, write ledger, comment/status publication, artifact metadata read |
| capabilities | read source |
| verify-fixture | read source |

## Reporting contracts

Public validators cover:

- submission bundle;
- terminal/fixture bundle;
- cancellation bundle;
- artifact metadata index.

They bind:

- job ID and target SHA;
- result/report identities and timestamps;
- immutable ledger operation order, path classes and exact content;
- publication order, kind, identity, timestamp and expected truth;
- duplicate-free artifact identities.

The service-result v2 validator also cross-correlates nested reporting, permission, state, transition, outcome, artifact and publication records with the outer command/job/SHA.

## Publication reconciliation

Publication journals live only at:

```text
.audit-direct/v1/publications/<jobId>/<publicationId>.json
```

Before creating a side effect after a missing journal, the trusted transport searches up to ten pages of 100 records:

- comments by hidden `publicationId` marker;
- Checks by external idempotency key and conclusion;
- statuses by context, state and description.

If found, the transport fills the missing journal without creating a duplicate. If the search bound is exceeded, operator reconciliation is required.

## Artifact metadata

The transport requests the exact target artifact name:

```text
audit-direct-result-<repositoryId>-<targetCommitSha>
```

It filters the response again locally and returns bounded metadata only. Artifact bytes, submitted execution and arbitrary repository artifacts remain outside this package.

## Error handling

Transport errors normalize to stable redacted service errors. Raw GitHub messages, URLs, authorization headers, tokens and response bodies are never surfaced through public output contracts.
