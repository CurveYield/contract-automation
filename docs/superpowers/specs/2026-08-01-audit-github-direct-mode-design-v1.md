# Audit GitHub Direct Mode Design v1

## Status

- Design version: `audit-github-direct-mode-design-v1`
- Date: 2026-08-01
- Repository: `CurveYield/contract-automation`
- Governing branch: `agent-control-plane-v1`
- Intended roadmap placement: Phase 9, with Phase 10 production-hardening gates
- Implementation status: design only; no runtime, workflow, credential, execution, or deployment change is authorized by this document

## 1. Purpose

Add a separate **Audit GitHub Direct** operating mode that allows approved clients to coordinate with the CurveYield Audit suite through the dedicated GitHub App and GitHub Actions without requiring a Cloudflare Worker, Cloudflare Pages, R2, Cloudflare credentials, Cloudflare routing, or Cloudflare availability.

The existing Cloudflare-backed Audit mode remains unchanged. GitHub Direct is an explicit parallel mode, not a replacement, transparent fallback, failover path, or shared transport layer.

## 2. Required mode separation

The suite exposes two independently selected modes:

1. `cloudflare-audit-v1`
   - existing Cloudflare Audit Worker/API;
   - R2-backed durable state and evidence;
   - existing web and control-plane behavior.

2. `github-direct-audit-v1`
   - direct GitHub App and GitHub Actions coordination;
   - GitHub-native job ledger, workflow state, checks, comments, and artifacts;
   - zero Cloudflare or R2 dependency.

A request must select exactly one mode before admission. The system must never silently switch modes. A failure in one mode must be reported in that mode and must not trigger the other mode.

## 3. Non-goals

GitHub Direct v1 does not:

- replace, modify, proxy, or degrade the Cloudflare-backed Audit mode;
- place a GitHub App private key, installation token, user token, or signing key in browser code;
- expose GitHub credentials through reports, logs, artifacts, checks, comments, or committed manifests;
- use R2 as hidden storage or require any Cloudflare binding;
- make GitHub Actions a claimed hostile-code sandbox;
- enable submitted-project execution while the hardened-compute feature gate remains closed;
- import from CurveYield Lite runtime packages or modify Lite behavior;
- dispatch deployments, sign transactions, access wallets, broadcast calls, or accept arbitrary RPC destinations;
- provide automatic Cloudflare fallback or automatic GitHub fallback.

## 4. Recommended architecture

```text
Approved client
- ChatGPT GitHub connector
- local CLI
- GitHub web action / repository UI
        |
        v
Dedicated CurveYield Audit GitHub App
- installation authorization
- repository allowlist
- least-privilege token minting
- request creation and status retrieval
        |
        v
Dedicated audit-direct control branch
- immutable request manifests
- append-only transition records
- deterministic current-state pointer
- no submitted source copied into control records
        |
        v
GitHub Actions audit-direct workflow
- validates request and exact target commit
- enforces capability and execution gates
- runs only repository-owned fixtures until hardened execution is approved
- coordinates approved future executor through the existing deferred adapter boundary
        |
        +----> GitHub Checks / commit statuses
        +----> issue or pull-request comments
        +----> GitHub Actions artifacts
        +----> audit-direct control-branch result manifests
```

Cloudflare Worker, Pages, R2, Cloudflare tokens, and Cloudflare routes are absent from this topology.

## 5. GitHub identity and authentication

The mode uses the existing dedicated CurveYield Audit GitHub App identity described by the current Audit specification. It does not create a second permanent App private key.

### 5.1 Workflow authentication

- Use the automatic per-run `GITHUB_TOKEN` when its explicitly declared permissions are sufficient.
- Mint a short-lived installation token only when an approved operation cannot be performed by `GITHUB_TOKEN`.
- Installation tokens must be restricted to the target installation, approved repository, and minimum required permissions.
- The App private key may exist only in an approved secret store or trusted local operator environment.
- The App private key must never be accepted as a workflow input, repository variable, browser value, committed file, job manifest field, report field, or artifact.

### 5.2 Local client authentication

The optional local CLI should prefer GitHub App user authorization through device flow or an equivalent short-lived user authorization flow. A local daemon using the App private key is an optional administrative deployment and is not required for normal direct-mode use.

### 5.3 Repository permissions

Permissions are split and minimized by operation. Expected categories are:

- metadata: read;
- contents: read for audited source, narrowly scoped write for the dedicated control branch only;
- Actions: dispatch/read as required;
- checks and statuses: write;
- issues and pull requests: read/write only when reporting is requested;
- packages: read only when approved profile metadata requires it.

Organization administration, billing, members, unrelated repositories, secrets administration, environments administration, and broad deployment administration remain excluded.

## 6. Repository-native job ledger

### 6.1 Dedicated branch

Each enabled repository uses a dedicated control branch, recommended name:

`audit-direct/control-v1`

The branch is separate from the audited source branch and from the Cloudflare Audit branch chain. Direct-mode writes must never modify the target source commit or source branch.

### 6.2 Paths

```text
.audit-direct/v1/jobs/<job-id>/request_v1.json
.audit-direct/v1/jobs/<job-id>/events/<sequence>_<event-id>_v1.json
.audit-direct/v1/jobs/<job-id>/status/CURRENT_v1.json
.audit-direct/v1/jobs/<job-id>/results/result_manifest_v1.json
.audit-direct/v1/jobs/<job-id>/reports/report_index_v1.json
.audit-direct/v1/indexes/jobs_v1.json
```

Request and event files are immutable. `CURRENT_v1.json` and deterministic indexes are mutable only through compare-and-swap using the current blob SHA. Result and report manifests are immutable once published.

### 6.3 Job identity

A job identity binds at minimum:

- schema version;
- direct-mode version;
- job ID;
- repository ID and canonical repository name;
- exact target commit SHA;
- requester identity and installation identity;
- selected profile IDs and versions;
- policy version;
- request digest;
- creation timestamp;
- execution-gate state;
- expected result-contract versions.

Branch names and mutable refs are informative only. The authoritative audited source is always an exact commit SHA resolved before admission.

## 7. Request contract

Recommended top-level request shape:

```json
{
  "schemaVersion": "audit-github-direct-request-v1",
  "mode": "github-direct-audit-v1",
  "jobId": "ajob_...",
  "repository": {
    "repositoryId": 0,
    "fullName": "owner/repository",
    "targetCommitSha": "40-hex-sha"
  },
  "profiles": [
    {
      "profileId": "solidity-compile-v1",
      "profileVersion": 1,
      "parserVersion": "..."
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

The runtime validator must reject unknown fields, mutable-only source identity, arbitrary commands, scripts, package-manager arguments, Dockerfiles, custom images, arbitrary URLs, arbitrary RPC endpoints, credentials, keys, wallets, calldata, signed transactions, broadcast instructions, deployment targets, and Cloudflare configuration.

## 8. Data flow

1. The approved client resolves the repository installation and exact target commit.
2. The client validates the request locally with the shared pure direct-mode schema package.
3. The GitHub App creates the immutable request manifest on `audit-direct/control-v1` using a compare-and-swap branch update.
4. A push-triggered or explicitly dispatched workflow reads the exact request blob.
5. The workflow revalidates the request, repository identity, installation, target SHA, profile contracts, policy version, and current execution gate.
6. The workflow writes an admitted or rejected event and updates `CURRENT_v1.json` conditionally.
7. While submitted execution is disabled, non-fixture requests terminate as `awaiting_executor` or `execution_plane_unavailable`; repository-owned trusted fixtures may exercise profile/parser/result contracts.
8. When a separately approved hardened executor exists, the workflow may coordinate it only through the existing signed, replay-protected deferred-executor interface. GitHub Actions must not itself be reclassified as the hostile-code sandbox.
9. Normalized results are validated against the phase result contracts before publication.
10. The workflow publishes immutable result/report manifests, a bounded artifact bundle, and requested GitHub Check or comment output.
11. The final state records `mode: github-direct-audit-v1` and `cloudflareUsed: false`.

## 9. Storage and retention

GitHub Direct uses only GitHub-native persistence:

- committed control-branch manifests for durable job identity, transitions, and result indexes;
- GitHub Actions run metadata for workflow execution records;
- GitHub Actions artifacts for bounded logs, raw outputs, rendered reports, and evidence bundles;
- GitHub Checks, statuses, issues, or pull-request comments for human-facing summaries.

Artifact retention is explicit in the result manifest and must not be represented as permanent. Durable manifests contain digests, sizes, artifact IDs, run IDs, expiration metadata, and authoritative normalized summaries, but never secrets.

Large raw outputs must be bundled and capped. The workflow must not commit unbounded logs, generated dependencies, build trees, node_modules, compiler caches, or extracted submitted workspaces to the control branch.

## 10. Public interfaces

### 10.1 Pure package

Recommended package:

`packages/audit-github-direct-protocol/`

Responsibilities:

- request, event, state, result-index, and report-index validation;
- deterministic serialization and hashing;
- job and event identity generation;
- capability declaration;
- recursive forbidden-field rejection;
- no filesystem, network, GitHub, Cloudflare, execution, credential, or deployment capability.

### 10.2 GitHub adapter package

Recommended package:

`packages/audit-github-direct-adapter/`

Responsibilities:

- installation/repository resolution;
- short-lived token use;
- control-branch compare-and-swap operations;
- workflow dispatch and status retrieval;
- Checks/issues/PR reporting;
- artifact metadata retrieval;
- typed GitHub error normalization.

It must not import Cloudflare or R2 packages.

### 10.3 CLI

Recommended path:

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

The CLI must display the selected mode and repository before any write. It must not accept App private-key material through ordinary command-line arguments.

### 10.4 GitHub workflow

Recommended path:

`.github/workflows/audit-direct-v1.yml`

The workflow has explicit least-privilege permissions, bounded concurrency, job timeouts, cancellation handling, artifact caps, exact-ref checkout, and no Cloudflare secrets or steps.

## 11. Capability declaration

Every direct-mode status and result exposes a frozen capability record similar to:

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

Capability output must be truthful for the exact deployed version. No UI or client may infer execution availability from the existence of a workflow alone.

## 12. Isolation from Cloudflare mode

The following boundaries are mandatory:

- separate mode IDs and top-level schemas;
- separate application entry points;
- separate workflow and control-branch state;
- separate storage adapters and result indexes;
- no direct-mode import from `apps/audit-api`, `packages/audit-r2-store`, or `infra/audit-cloudflare`;
- no Cloudflare environment variable, binding, token, endpoint, or account ID accepted by direct mode;
- no GitHub App private key or installation token persisted in Cloudflare by this feature;
- no automatic cross-mode request migration;
- no shared mutable current-state record;
- reports display their producing mode prominently;
- identical transport-neutral profile and result contracts may be reused as pure dependencies.

## 13. Error handling

Errors are normalized into stable, non-secret categories, including:

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

GitHub response bodies, request headers, tokens, private-key details, stack traces, local paths, and secret names are never copied into public errors.

Conditional-write conflicts are retried only through bounded reread/revalidate/reapply logic. A retry must never duplicate immutable requests, events, checks, comments, or reports.

## 14. Security boundaries

- Exact commit SHA is required before job admission.
- Pull-request code from forks is never granted installation secrets.
- Workflows triggered by untrusted pull requests must not receive App private-key access.
- `pull_request_target` must not check out or execute untrusted pull-request code.
- Workflow permissions default to read-only and are elevated per job only where required.
- Environment approvals may protect any future installation-token minting job.
- Action dependencies are pinned to immutable commit SHAs under production hardening.
- Artifact and log content is treated as attacker-controlled and escaped before rendering.
- Checks and comments are bounded and use summarized normalized results.
- The direct control branch must be branch-protected against ordinary source pushes.
- Cancellation and rerun operations bind to the exact job and current attempt.
- No job manifest may select an arbitrary workflow file, action repository, runner label, command, image, URL, or secret.

## 15. Testing and acceptance

### 15.1 Unit and contract tests

- exact request/event/state/result schemas;
- unknown and forbidden-field rejection;
- deterministic serialization and digest stability;
- hostile object/accessor/prototype boundaries;
- mode and capability truthfulness;
- exact commit and installation identity binding;
- conditional update conflict handling;
- duplicate request/event/report prevention;
- stable error code and path behavior.

### 15.2 GitHub adapter fixture tests

- installation and repository allowlists;
- least-privilege permission maps;
- token redaction and expiry handling;
- branch creation and compare-and-swap fixtures;
- dispatch/status/check/comment/artifact fixtures;
- rate-limit and retry fixtures;
- no Cloudflare endpoint or credential use.

### 15.3 Workflow tests

- only direct-mode paths trigger the workflow;
- exact request blob and exact source SHA are checked;
- untrusted PRs cannot access installation credentials;
- execution-disabled requests stop safely;
- trusted repository-owned fixtures produce normalized bounded results;
- timeouts and cancellation produce terminal manifests;
- artifacts are capped and retention is recorded;
- check/comment/report publication is idempotent;
- workflow permissions match an allowlisted manifest;
- no Cloudflare step, secret, binding, URL, or package is present.

### 15.4 Cross-mode regression tests

- Cloudflare mode remains byte-for-byte unchanged where required;
- a Cloudflare request cannot be admitted by direct mode;
- a direct request cannot be admitted by Cloudflare mode;
- failure of either mode does not invoke the other;
- mode-specific state and indexes never overlap;
- shared profile/result contracts produce the same canonical normalized envelope for the same trusted fixture;
- Lite boundary tests continue to pass.

### 15.5 Acceptance gate

GitHub Direct v1 is accepted only when:

- the complete direct-mode implementation operates with all Cloudflare credentials absent;
- static and runtime tests prove no Cloudflare/R2 dependency in direct-mode production paths;
- the browser never receives a GitHub private key or installation token;
- all repository writes are confined to approved direct-mode paths and reporting surfaces;
- exact-source, identity, idempotency, permission, artifact, cancellation, and error tests pass;
- submitted-project execution remains disabled unless the separate hardened-compute acceptance gate has passed;
- the existing Cloudflare Audit mode and CurveYield Lite remain unchanged.

## 16. Roadmap integration

### Phase 9

Add:

- GitHub Direct protocol and GitHub adapter packages;
- dedicated GitHub App direct-mode surfaces;
- control-branch job ledger;
- workflow coordination;
- CLI and API-facing direct-mode client interfaces;
- Checks/issues/PR reporting;
- GitHub artifact and report indexes;
- explicit mode selection and capability display.

### Phase 10

Add:

- permission and branch-protection audit;
- immutable action pinning;
- rate-limit, quota, concurrency, timeout, retention, and incident controls;
- token rotation and revocation drills;
- audit-log review;
- disaster recovery for control-branch indexes;
- production feature gate and staged repository allowlist.

### Phases 4–8 compatibility requirement

Profile, parser, result, evidence, report, fork, and clean-room contracts must remain transport-neutral pure contracts so they can be consumed by either Cloudflare mode or GitHub Direct mode without embedding either transport.

## 17. Rollout

1. Commit and approve this design.
2. Amend the canonical Audit roadmap, architecture, Phase 9, secrets/identity, testing, and capability-traceability documents through a versioned specification update.
3. Create a test-first implementation plan with isolated work packages and non-overlapping ownership.
4. Implement pure schemas and negative boundary tests first.
5. Implement GitHub adapter fixtures and control-branch state next.
6. Add workflow and CLI only after protocol acceptance.
7. Keep real submitted execution disabled.
8. Run cross-mode and Lite regression gates.
9. Enable only for an explicit repository allowlist after Phase 10 hardening.

## 18. Design decisions

The following decisions are final for v1:

- separate direct mode, never a replacement;
- no automatic fallback in either direction;
- same dedicated CurveYield Audit GitHub App identity, no second permanent App key;
- GitHub App + GitHub Actions is the primary runtime;
- optional local CLI uses short-lived user authorization;
- dedicated direct-mode control branch and schemas;
- GitHub-native storage only;
- no Cloudflare or R2 dependency;
- no browser-held App private key;
- GitHub Actions is coordination infrastructure, not the claimed hostile-code sandbox;
- implementation belongs primarily to Phase 9 and hardening to Phase 10.
