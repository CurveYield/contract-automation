# GitHub Direct Runner Boundary v1

## Admission

Admission validates the request, capability manifest, exact source commit SHA, repository/install/full-name identity, policy, profile, parser, and result-contract versions.

Required capabilities are:

- `read-source`;
- `write-control-ledger`;
- `publish-check`;
- `publish-status`.

## Repository-owned fixture policy

The fixture allowlist is immutable production data, not request data. A request cannot add a fixture identifier, enable fixture mode, select a command, choose a workflow, choose a runner/image, supply a URL, or enable execution.

An exact allowlist match may produce a deterministic modeled fixture result. It does not execute submitted source.

## Non-fixture behavior

A valid non-fixture request stops truthfully at:

```text
admitted -> awaiting_executor -> execution_plane_unavailable
```

The result manifest uses outcome `execution_unavailable`, execution state `execution_plane_unavailable`, and a null result digest. Checks use a neutral conclusion and commit status uses `error`; neither claims successful execution.

## Fixture behavior

An exact repository-owned inert fixture follows:

```text
admitted -> fixture_running -> publishing -> completed
```

The result remains marked `modeled_fixture` with `executionPerformed: false`.

## Publication

The runner produces data-only plans for:

- immutable result-manifest ledger publication;
- immutable report-index ledger publication;
- GitHub Check publication;
- commit-status publication.

Nested result, report, ledger, and adapter publication contracts are independently validated before a runner publication plan is accepted.
