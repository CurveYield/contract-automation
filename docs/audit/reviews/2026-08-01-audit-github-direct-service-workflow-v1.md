# GitHub Direct Service and Workflow v1 Review

## Recommendation

**ACCEPT**

The sequence-6 package completes the trusted GitHub Direct service, CLI, injected authorization, reporting and workflow layer around the accepted core from issue #98. Non-fixture jobs remain cancellable at `awaiting_executor` and close truthfully as `execution_plane_unavailable`; exact inert fixtures may complete without executing submitted source.

## Assignment

- Worker: `worker-3`
- Issue: `#104`
- Mailbox sequence: `6`
- Branch: `audit-phase9/github-direct-service-workflow-v1`
- Starting SHA: `2df9cbfd534ab97da9aa26077879433a7fc4a8a4`
- Exact final SHA: recorded in the final issue report and mailbox completion event after this review is committed.

## Implemented packages

- `audit-github-direct-auth`: token-free authorization attestation and hostile-safe closed transport validation.
- `audit-github-direct-service`: strict command/result/error contracts and resumable lifecycle orchestration.
- `audit-github-direct-reporting`: phased Check/status/comment reporting, cancellation records and metadata-only artifacts.
- `audit-github-direct-cli`: fixed bounded parser, deterministic JSON, stable exit codes, trusted GitHub transport and workflow host.
- `.github/workflows/audit-direct-v1.yml`: protected-default-branch trusted workflow with pinned Actions and inert target checkout.

## Test-first evidence

- package-map RED: `0/5`;
- first integrated RED: `22/25`;
- workflow RED: `37/39`;
- adversarial RED: `45/49`;
- lifecycle correction RED: `1/6` focused behavior passed before implementation;
- final direct suite: `63/63`.

## Security and adversarial evidence

Explicit vectors include:

- 38 top-level one-field service-command mutations;
- 9 prohibited service fields;
- 5 prohibited CLI flags;
- 5 authorization identity/capability/expiry/shape drifts;
- 4 repository/install/requester/SHA substitutions;
- 6 hostile accessor/prototype/symbol/revoked-proxy cases;
- partial request, fixture publication and cancellation recovery;
- stale CAS, terminal cancellation race and unsupported report-state rejection;
- identical and conflicting publication replay;
- artifact size and extra URL/byte rejection;
- workflow branch, pin, permission, input and target-trust attacks.

At least 61 explicit mutation/substitution vectors are asserted separately from lifecycle and partial-write scenarios.

## Workflow trust result

The workflow implementation is checked out at `github.workflow_sha`; the submitted target is checked out separately with credentials disabled and is never executed or selected as a working directory. The job is gated to the protected default branch. Action references are full verified commit SHAs. Request identity is stable across runs for the same repository, target and authenticated actor.

## Static boundary

New production code creates no submitted execution, process-spawn, container, RPC, wallet, signing, transaction, broadcast, deployment or dynamic-code capability. Network creation is confined to the trusted GitHub Actions transport with fixed `https://api.github.com`. Credential material is held only by a token-provider closure and request header construction.

## Residual risks and prerequisites

- `audit-direct/control-v1` must exist before the first ledger write.
- A different authenticated actor derives a different requester-bound job identity and cannot manage the original actor's job.
- The numeric report issue is workflow input; comments remain bounded and confined to the same repository.
- The final installed GitHub App/workflow permission configuration must match the reviewed permission table.
- No live GitHub API, real workflow run or production token was exercised in this isolated package.
- Artifact metadata is repository-scoped and bounded, but the package intentionally does not download or cryptographically verify artifact bytes.

No dependency was installed or downloaded. No submitted project, external audit tool, process/container/RPC, wallet, signing, transaction, deployment, workflow approval, PR or merge to `main` occurred.
