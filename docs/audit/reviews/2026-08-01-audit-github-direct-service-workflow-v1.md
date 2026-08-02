# GitHub Direct Service and Workflow v1 Review

## Recommendation

**ACCEPT — superseding the earlier completion candidate**

The sequence-6 branch now contains the trusted GitHub Direct service, CLI, authorization, reporting and workflow layer plus the complete accepted protocol and ledger repair lineage. It also contains the exact-equivalent adapter/runner trust-boundary repair required by issue #109.

## Assignment and lineage

- Worker: `worker-3`
- Issue: `#104`
- Mailbox sequence: `6`
- Branch: `audit-phase9/github-direct-service-workflow-v1`
- Starting SHA: `2df9cbfd534ab97da9aa26077879433a7fc4a8a4`
- Accepted protocol/ledger repair merge: `9e7f9f4928272404786e701e0bde69cd9e75b98a`
- Final SHA: recorded in the superseding issue report and mailbox completion event after publication.

The merge incorporates issue #106's protocol validation repair and issue #108's closed ledger namespace, operation-class, observation-uniqueness and recovery-correlation repair.

## Adapter/runner repair evidence

Issue #109's seven findings were reproduced against the merged source:

```text
7 tests
0 passed
7 failed
```

After the minimal boundary repair:

```text
7 tests
7 passed
0 failed
```

Repairs include:

1. publication validation before any transport lookup;
2. hostile-safe publication kind inspection;
3. descriptor-safe artifact normalization;
4. exact, bounded and identity-bound repository/commit/blob/contents/ledger/publication responses;
5. complete fixture/unavailable admission correlations;
6. complete outcome/result/fixture correlations;
7. exact result/report ledger path/content binding and Check/status truth binding.

## Service integration corrections

- The mutable jobs index is initialized through CAS-on-absence using the all-zero SHA sentinel; immutable create is forbidden for this path.
- GitHub's actual contents blob SHA is validated as a Git SHA but is not equated with the planner's deterministic content fingerprint.
- Request-publication state survives transition composition.
- Reporting accepts already-validated artifact metadata without weakening raw metadata validation.
- Pure fixture verification uses the repository-owned allowlist directly and does not require write/publication capabilities.

## Final verification

The complete local combined suite covers core protocol, accepted protocol repair, core ledger, accepted ledger repair, adapter, runner, cross-mode, static security, service, CLI, reporting, workflow, transport and issue #109 boundaries.

```text
130 tests
130 passed
0 failed
0 skipped
0 cancelled
```

Additional completion gates require all production modules to pass `node --check`, workflow YAML parsing, whitespace checks, forbidden-capability scans and changed-path review before the superseding report is posted.

## Security result

- No submitted project, package script, command, workflow, runner image or target-controlled path is executed.
- Trusted runner code is selected by `github.workflow_sha`; target code is checked out separately as inert data.
- Tokens remain inside the trusted token-provider/request-header closure.
- No credential enters requests, ledger records, results, reports or logs.
- No Cloudflare/R2 fallback or shared state is introduced.
- Adapter transport returns cannot substitute repository, target SHA, path, blob or publication identity.
- Fixture results, unavailable results and publication truth are cross-record correlated.

## Residual prerequisites

- `audit-direct/control-v1` must exist before first control-ledger mutation.
- Installed GitHub permissions must match the reviewed least-privilege table.
- No live GitHub API call, production token, or real Actions run was exercised by the isolated tests.
- Artifact bytes remain intentionally outside the package.

No dependency installation, build, submitted execution, process/container/RPC, wallet/signing/transaction, deployment, workflow approval, PR or merge to `main` occurred.
