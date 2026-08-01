# Audit GitHub Direct Mode v1

## 1. Governing decision

`github-direct-audit-v1` is a separate explicit operating mode for the CurveYield Audit suite. It coordinates approved audit-control operations directly through the dedicated CurveYield Audit GitHub App, a repository-native control ledger, GitHub Actions, GitHub reporting surfaces, and bounded GitHub Actions artifacts.

It does not replace, proxy, fail over to, or automatically invoke `cloudflare-audit-v1`. Cloudflare mode remains unchanged. GitHub Direct has no Cloudflare Worker, Pages, R2, Cloudflare credential, binding, route, account ID, endpoint, or availability dependency.

## 2. Execution boundary

GitHub Direct is a control and coordination plane. GitHub Actions is not the hostile-code sandbox.

Until the separate hardened-compute project passes the required acceptance suite:

- submitted-project execution is disabled;
- non-fixture jobs terminate at `awaiting_executor` or `execution_plane_unavailable`;
- only trusted repository-owned fixtures may exercise profile, parser, result, evidence, and report contracts;
- no request may provide an arbitrary command, script, package-manager argument, workflow file, Action repository, runner label, image, URL, RPC endpoint, credential, key, wallet, calldata, signed transaction, broadcast instruction, or deployment target.

A future approved executor may be coordinated only through the signed, replay-protected, exact-job-bound deferred interface in document 15.

## 3. Topology

```text
Approved client
- ChatGPT GitHub connector
- local audit-direct CLI
- approved repository UI action
        |
        v
Dedicated CurveYield Audit GitHub App
- installation and repository allowlist
- exact target commit resolution
- least-privilege short-lived authorization
        |
        v
Dedicated branch: audit-direct/control-v1
- immutable request manifests
- append-only events
- compare-and-swap current pointers and indexes
- immutable result and report manifests
        |
        v
GitHub Actions audit-direct-v1 workflow
- exact request and source revalidation
- policy and capability admission
- execution-disabled fixture operation
- bounded cancellation, timeout, and artifact publication
        |
        +----> Checks / commit statuses
        +----> issue or pull-request summaries
        +----> bounded Actions artifacts
        +----> control-branch result/report manifests
```

## 4. Required isolation

The following boundaries are mandatory:

- separate mode IDs and top-level schemas;
- separate application entry points;
- separate mutable state, indexes, and storage adapters;
- no automatic request migration or fallback;
- no direct-mode import from `apps/audit-api`, `packages/audit-r2-store`, or `infra/audit-cloudflare`;
- no Cloudflare environment variable, binding, token, endpoint, account ID, route, or R2 operation accepted or used by direct mode;
- no GitHub App private key or installation token delivered to browser code or persisted in Cloudflare by this feature;
- reports prominently identify their producing mode;
- only transport-neutral pure profile, parser, result, evidence, report, fork, and clean-room contracts may be shared.

A Cloudflare request must be rejected by GitHub Direct, and a GitHub Direct request must be rejected by the Cloudflare API.

## 5. GitHub identity

The mode uses the existing dedicated CurveYield Audit GitHub App identity. It does not create a second permanent App key.

- Use the automatic per-run `GITHUB_TOKEN` when declared permissions are sufficient.
- Mint a short-lived installation token only for an approved operation that requires it.
- Restrict installation tokens to approved installations, repositories, permissions, and bounded lifetime.
- Keep the App private key only in an approved secret store or separately protected trusted local administrative environment.
- Never accept the private key as a workflow input, request field, CLI argument, repository variable, report field, artifact, Check, comment, or browser value.
- Never expose key/token details to untrusted pull-request jobs.

The optional CLI should use GitHub App user authorization through device flow or an equivalent short-lived user authorization flow.

Expected repository permission categories are:

- metadata: read;
- contents: read for audited source and narrowly scoped write for the direct control branch;
- Actions: dispatch/read where required;
- checks/statuses: write;
- issues/pull requests: read/write only when reporting is requested;
- packages: read only for approved immutable profile metadata.

Organization administration, billing, members, secrets administration, environment administration, and unrelated repositories remain excluded.

## 6. Control branch and paths

Each enabled repository uses:

```text
audit-direct/control-v1
```

Recommended paths:

```text
.audit-direct/v1/jobs/<job-id>/request_v1.json
.audit-direct/v1/jobs/<job-id>/events/<sequence>_<event-id>_v1.json
.audit-direct/v1/jobs/<job-id>/status/CURRENT_v1.json
.audit-direct/v1/jobs/<job-id>/results/result_manifest_v1.json
.audit-direct/v1/jobs/<job-id>/reports/report_index_v1.json
.audit-direct/v1/indexes/jobs_v1.json
```

Request and event records are immutable. `CURRENT_v1.json` and deterministic indexes are mutable only through current blob-SHA compare-and-swap. Result and report manifests are immutable after publication.

Direct-mode writes must never modify the target source commit or audited source branch. The control branch must be protected against ordinary source pushes and unapproved writers.

## 7. Job identity and request contract

A job identity binds at minimum:

- schema version and direct-mode version;
- job ID;
- repository ID and canonical repository name;
- installation ID;
- exact target commit SHA;
- requester identity;
- selected profile IDs and versions;
- parser/result-contract versions;
- policy version;
- request digest;
- creation timestamp;
- execution-gate state.

Mutable branches and tags are informative only. An exact commit SHA is required before admission.

Minimum request shape:

```json
{
  "schemaVersion": "audit-github-direct-request-v1",
  "mode": "github-direct-audit-v1",
  "jobId": "ajob_...",
  "repository": {
    "repositoryId": 0,
    "fullName": "owner/repository",
    "installationId": 0,
    "targetCommitSha": "40-hex-sha"
  },
  "profiles": [
    {
      "profileId": "solidity-compile-v1",
      "profileVersion": 1,
      "parserVersion": "...",
      "resultContractVersion": "tool-result-v1"
    }
  ],
  "reporting": {
    "checkRun": true,
    "issueNumber": null,
    "pullRequestNumber": null
  },
  "execution": {
    "requested": false,
    "gateVersion": "audit-execution-gate-v1"
  }
}
```

Validators reject unknown fields, mutable-only source identity, unsafe objects, arbitrary commands/scripts, arbitrary actions/workflows/runners/images, package-manager arguments, arbitrary URLs/RPCs, credentials, keys, wallets, calldata, signed transactions, broadcast instructions, deployment targets, and Cloudflare configuration.

## 8. State and data flow

1. The approved client resolves the installation, repository, and exact target commit.
2. The client validates the request through the pure direct protocol package.
3. The adapter creates the immutable request manifest through a compare-and-swap control-branch update.
4. A push-triggered or explicitly dispatched workflow reads the exact request blob.
5. The workflow revalidates request digest, installation, repository, target SHA, profiles, policy, permissions, and execution gate.
6. The ledger writes an admitted or rejected event and conditionally updates current state.
7. While execution is disabled, non-fixture jobs stop at an explicit executor-unavailable state; trusted fixtures may run bounded contract tests.
8. Normalized results are validated against accepted result contracts.
9. The workflow publishes immutable result/report manifests, a bounded artifact bundle, and requested GitHub reporting output.
10. The final state records `mode: github-direct-audit-v1`, `cloudflareUsed: false`, retention state, and terminal classification.

Retries use bounded reread/revalidate/reapply behavior and must not duplicate immutable requests, events, Checks, comments, artifacts, results, or reports.

## 9. Persistence and retention

GitHub Direct uses only GitHub-native persistence:

- committed manifests for durable identities, transitions, summaries, and indexes;
- workflow run metadata for coordination records;
- bounded Actions artifacts for logs, raw output, rendered reports, and evidence bundles;
- Checks/statuses/issues/PR comments for human-facing summaries.

Artifact retention is explicit and never represented as permanent. Durable manifests record run ID, artifact ID, digest, byte size, expiration metadata, and authoritative normalized summary.

The control branch must not contain unbounded logs, generated dependencies, build trees, compiler caches, extracted workspaces, `node_modules`, secrets, or raw hostile output.

## 10. Packages and interfaces

### Pure protocol

`packages/audit-github-direct-protocol/`

Responsibilities:

- request, event, state, capability, result-index, and report-index validation;
- deterministic serialization and hashing;
- job/event identity generation;
- recursive forbidden-field rejection;
- frozen defensive canonical clones;
- no filesystem, network, GitHub, Cloudflare, execution, credential, or deployment capability.

### Ledger

`packages/audit-github-direct-ledger/`

Responsibilities:

- deterministic control paths;
- immutable-record and compare-and-swap transition planning;
- state-machine and idempotency enforcement;
- server-owned index mutation planning;
- no network transport or credential ownership.

### GitHub adapter

`packages/audit-github-direct-adapter/`

Responsibilities:

- installation/repository resolution;
- short-lived token use;
- branch and blob compare-and-swap operations;
- workflow dispatch/status retrieval;
- Checks/statuses/issues/PR reporting;
- artifact metadata retrieval;
- typed bounded GitHub error normalization;
- no Cloudflare or R2 imports.

### Runner

`packages/audit-github-direct-runner/`

Responsibilities:

- read one exact request;
- admission and capability checks;
- execution-disabled state transitions;
- trusted-fixture orchestration only;
- normalized result/report publication planning;
- cancellation, timeout, and idempotency handling.

### CLI

`apps/audit-github-direct-cli/`

Minimum commands:

```text
audit-direct auth
audit-direct submit --repo <owner/repo> --sha <commit> --profile <id>
audit-direct status --job <id>
audit-direct report --job <id>
audit-direct cancel --job <id>
audit-direct capabilities
```

The CLI displays selected mode, repository, and exact commit before a write and does not accept App private-key material through ordinary arguments.

### Workflow

`.github/workflows/audit-direct-v1.yml`

The workflow uses explicit least-privilege permissions, bounded concurrency, timeouts, cancellation handling, artifact caps, exact-ref checkout, immutable action pins for production acceptance, and no Cloudflare secret or step.

## 11. Error contract

Stable non-secret categories include:

- `installation_not_found`;
- `repository_not_authorized`;
- `target_commit_not_found`;
- `target_commit_changed`;
- `control_branch_conflict`;
- `request_already_exists`;
- `request_digest_mismatch`;
- `profile_contract_mismatch`;
- `workflow_dispatch_failed`;
- `workflow_not_authorized`;
- `workflow_timed_out`;
- `workflow_cancelled`;
- `artifact_unavailable`;
- `artifact_expired`;
- `report_publication_failed`;
- `execution_plane_unavailable`;
- `capability_disabled`;
- `rate_limited`.

GitHub response bodies, headers, tokens, private-key details, stack traces, local paths, and secret names never enter public errors.

## 12. Security requirements

- exact target commit SHA before admission;
- no App secrets in untrusted pull-request jobs;
- no `pull_request_target` checkout/execution of untrusted code;
- read-only workflow permissions by default;
- protected token-minting boundaries where installation tokens are needed;
- immutable Action pins for production acceptance;
- attacker-controlled artifact/log/report content escaped before rendering;
- bounded Checks and comments using normalized summaries;
- branch-protected control ledger;
- cancellation and reruns bound to exact job and current attempt;
- no request-selected workflow, Action, runner, command, image, URL, or secret.

## 13. Capability record

Every status and result exposes a frozen truthful capability record:

```json
{
  "mode": "github-direct-audit-v1",
  "cloudflareRequired": false,
  "cloudflareUsed": false,
  "r2Required": false,
  "githubAppRequired": true,
  "githubActionsRequired": true,
  "submittedExecutionEnabled": false,
  "hostileCodeIsolationProvided": false
}
```

## 14. Acceptance

GitHub Direct v1 is accepted only when:

- it operates with every Cloudflare/R2 credential absent;
- static and runtime tests prove no Cloudflare/R2 dependency in production paths;
- all writes remain inside approved control-branch and reporting surfaces;
- exact source, installation, repository, identity, policy, permission, idempotency, cancellation, artifact, retention, and error tests pass;
- the App private key and installation tokens never reach browser code, request fields, logs, reports, or artifacts;
- untrusted PRs cannot reach protected credentials;
- submitted execution remains disabled until the external hardened-compute gate passes;
- Cloudflare Audit and CurveYield Lite remain unchanged.

## 15. Phase placement

Phase 9 implements the direct protocol, ledger, adapter, runner, workflow, CLI, reporting, and fixture-only capability surfaces.

Phase 10 production-hardens permission manifests, branch protection, Action pins, rate limits, quotas, concurrency, timeout, retention, token rotation/revocation, incident controls, index recovery, and staged repository allowlisting.
