# GitHub Direct Service and Workflow v1 Review

## Recommendation

**ACCEPT — superseding the earlier sequence-6 candidate and report**

The sequence-6 branch implements the trusted GitHub Direct service, CLI, authorization, reporting, metadata-only artifact, and protected workflow layer on top of the only approved repaired core: `22c22dd9de0e21b066ac29c9e0d9422a73724a31` from issues #106, #108, and #109.

## Assignment and lineage

- Worker: `worker-3`
- Issue: `#104`
- Mailbox sequence: `6`
- Branch: `audit-phase9/github-direct-service-workflow-v1`
- Starting SHA: `2df9cbfd534ab97da9aa26077879433a7fc4a8a4`
- Approved repaired core: `22c22dd9de0e21b066ac29c9e0d9422a73724a31`
- Approved-core merge: `430fd250b790c5983406caf3a291b4af89281ef2`
- Final SHA: recorded in the superseding issue report and mailbox completion event after publication.

The earlier candidate `c55eb6dd9ca2b1f9b79e0a35d48723a7efc403e4` and issue comment `5154135020` predated the mandatory repaired-core lineage and are superseded.

## Service integration over the accepted core

The accepted adapter requires mutation responses to repeat the ledger planner's deterministic content fingerprint. GitHub's native contents blob SHA is a different value. The trusted transport therefore:

- computes and exposes the deterministic fingerprint to ledger/service CAS;
- keeps the native Git blob SHA private for GitHub Contents API `sha` preconditions;
- compares existing canonical content fingerprints to planner expectations;
- returns only exact adapter-approved response shapes.

The accepted adapter intentionally exposes contents metadata, not decoded control records. A separate trusted ledger snapshot reader in the same fixed-host transport module reads only server-derived `.audit-direct/v1/**` paths, decodes JSON, and returns content plus the deterministic fingerprint. Request data cannot select snapshot paths.

The mutable jobs index is first-created through CAS-on-absence using the all-zero 40-character sentinel; it is never written with an immutable-create operation.

## Lifecycle and reporting

- Normal submission reaches `awaiting_executor`, publishes one neutral Check, and remains cancellable.
- `report` creates truthful execution-unavailable result/report records, advances terminally, and publishes status/comment without duplicating the Check.
- `cancel` creates a `cancelled` / `not_executed` result/report and publishes status/comment.
- An exact repository-owned inert fixture may complete with `executionPerformed:false`.
- Identical retries converge; conflicting publication replay rejects.

## Test-first and repair evidence

Preserved sequence-6 RED stages:

- package map: `0/5`;
- initial integration: `22/25`;
- workflow: `37/39`;
- adversarial: `45/49`;
- lifecycle correction: `1/6` focused behavior passed before implementation.

Accepted repaired-core evidence includes the #109 ten-test RED/GREEN boundary suite and the accepted #106/#108 repair suites.

Fresh combined verification against the exact accepted core and final service integration:

```text
133 tests
133 passed
0 failed
0 skipped
0 cancelled
```

Additional gates:

- 36 production `.mjs` modules pass `node --check`;
- workflow YAML parses successfully;
- whitespace gate is clean;
- all changed paths remain within issue #104 and accepted repair-lineage ownership.

## Security result

- Trusted implementation is selected by `github.workflow_sha`; target source is checked out separately as inert data.
- No submitted project, script, command, workflow, runner image, RPC, wallet, transaction, deployment, or dynamic code is executed.
- Tokens remain inside a trusted token-provider/request-header closure and never enter requests, ledger records, results, reports, comments, or logs.
- No Cloudflare/R2 fallback or shared mutable state is introduced.
- Adapter transport responses are exact and identity-bound.
- Admission, outcome, result, ledger, Check, and status truth is cross-record correlated by the accepted core.

## Residual prerequisites

- `audit-direct/control-v1` must exist before the first control-ledger mutation.
- Installed GitHub workflow/App permissions must match the reviewed permission table.
- No live GitHub API call, production token, or real Actions run was exercised by the isolated tests.
- Artifact bytes remain intentionally outside this package.

No dependency installation, build, submitted execution, process/container/RPC, wallet/signing/transaction, deployment, workflow approval, PR, or merge to `main` occurred.
