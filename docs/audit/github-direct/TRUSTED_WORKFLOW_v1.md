# GitHub Direct Trusted Workflow v1

## Trust model

The workflow runs only trusted repository-owned code. The workflow implementation is checked out at:

```text
github.workflow_sha
```

The submitted target commit is checked out separately under `target-source` with persisted credentials disabled. It is treated only as inert Git data and is never imported, sourced, built or executed.

## Caller inputs

Only two caller inputs exist:

- a fixed operation from `submit`, `status`, `cancel`, `report`, `capabilities`, `verify-fixture`;
- an exact 40-character target SHA.

The caller cannot select installation ID, report issue, path, URL, command, runner, image, action version, workflow scope or execution mode.

## Repository-owned configuration

```text
GITHUB_DIRECT_INSTALLATION_ID
GITHUB_DIRECT_REPORT_ISSUE
```

Both values are validated as positive integers before CLI invocation.

## Permission isolation

The workflow has `permissions: {}` at the top level and fixed job-specific subsets:

| Job | Permissions |
|---|---|
| read-only | contents: read |
| submit | contents/checks/statuses/issues write; actions read |
| cancel | contents/statuses/issues write |
| report | contents/statuses/issues write; actions read |

No workflow, deployment, package, administration, security-event, environment, secret or identity-token permission is requested.

## Concurrency

All operations for one repository/target share one concurrency group:

```text
audit-direct-v1-<repositoryId>-<targetSha>
```

`cancel-in-progress` is false. This prevents report/cancel/submission publication races from being hidden by automatic workflow cancellation.

## Supply-chain controls

- runner image: fixed `ubuntu-24.04`;
- all actions: full 40-character commit SHAs;
- trusted and target checkouts: separate directories;
- persisted checkout credentials: disabled;
- target SHA: checked against the actual inert checkout before service invocation;
- no untrusted pull-request, workflow-run or repository-dispatch triggers.

## Bounded artifacts

Submit and report may upload:

- validated machine result JSON;
- target repository ID/commit/tree binding JSON;
- at most 10,000 target file names.

Retention is one day. Target source files and artifact bytes are not uploaded by this workflow.

Artifact metadata ingestion later requests and filters the exact name:

```text
audit-direct-result-<repositoryId>-<targetSha>
```

## Publication recovery

Checks, statuses and comments are reconciled before recreation when a journal is missing. Search is bounded to ten pages of 100 records. Existing exact side effects cause journal repair rather than duplicate publication.

## Explicit exclusions

This workflow does not enable submitted analysis execution, RPC simulation, Cloudflare/R2 mode, wallet/signing/transaction work, deployment, workflow approval or main-branch merge.

## Pre-run checklist

1. Confirm default-branch protection is active.
2. Confirm both repository variables are present and correct.
3. Confirm workflow/action SHAs match the reviewed release.
4. Confirm Round 3 compatibility/release manifests validate.
5. Confirm protected simulation/RPC blobs remain unchanged.
6. Run an authorized inert fixture test before considering any broader integration.
