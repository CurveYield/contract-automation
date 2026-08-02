# GitHub Direct Trusted Workflow v1

## Trust model

```text
protected default-branch workflow SHA
            |
            v
checkout trusted-runner at github.workflow_sha
            |
            +---- validate fixed inputs
            |
            +---- checkout target SHA separately as inert data
            |          |
            |          +---- verify exact commit SHA
            |          +---- record tree SHA and bounded file index
            |          +---- never execute or use as working directory
            |
            v
run trusted CLI with short-lived GITHUB_TOKEN
            |
            +---- repository ledger / Check / status / bounded issue comment
            +---- metadata-only artifact listing
```

The submitted target commit is data. It cannot modify the workflow implementation, CLI, validators, runner, policy, profile, command, runner label, image or credential selection.

## Trigger and branch gate

The workflow has only `workflow_dispatch`. It has no `pull_request` or `pull_request_target` trigger. The job runs only when `github.ref` is the repository default branch and `github.ref_protected` is true.

## Inputs

Only four workflow inputs exist:

- fixed operation choice;
- exact lowercase 40-character target SHA;
- positive installation ID;
- positive bounded report issue number.

All command, profile, parser, result-contract and report-contract identifiers are fixed by trusted workflow code.

## Permissions

| Permission | Access | Purpose |
|---|---|---|
| `contents` | write | Read target data and mutate the control ledger |
| `checks` | write | Publish the exact-SHA Check |
| `statuses` | write | Publish terminal commit status |
| `issues` | write | Publish bounded issue comments |
| `actions` | read | Read bounded artifact metadata |

No workflow, id-token, package, deployment, administration or security-events permission is granted.

## Action pins

- `actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955`
- `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`

Both are full commit SHAs verified against their official repositories.

## Source binding and artifacts

The target checkout is verified against the input SHA. The workflow records:

- target commit SHA;
- target tree SHA;
- deterministic request timestamp;
- at most 10,000 displayed file-index lines.

The output, binding record and bounded file index are retained for one day. No target artifact bytes are fetched by the service or executed.

## Concurrency and failure behavior

Concurrency is scoped by repository ID and target SHA with cancellation enabled. The trusted job has a ten-minute timeout, strict shell error propagation and exact CLI exit propagation.
