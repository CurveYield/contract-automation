# Phase 9 — Web, Reports, and GitHub Integrations v2

## Explicit operating modes

Phase 9 exposes two independently selected integration surfaces:

- `cloudflare-audit-v1` — the existing Audit Pages/Worker/API and R2-backed state;
- `github-direct-audit-v1` — a separate GitHub App/GitHub Actions and repository-native state path.

Neither mode replaces or automatically invokes the other. Requests, mutable state, storage adapters, credentials, entry points, indexes, capability declarations, and reports identify their producing mode explicitly.

## Cloudflare web application

The Audit Pages application provides workspace, layer, profile, campaign, job, attempt, log, artifact, evidence, report, fork, quota, and integration views for Cloudflare mode. It never receives R2 credentials or the GitHub App private key.

### Cloudflare retrieval strategy

- status polling reads one current-state object;
- log polling requests only sequences newer than the client cursor;
- artifact/evidence/report downloads use one bundled object each;
- the UI never lists bucket prefixes;
- browser cache/ETag requests are used where safe.

## GitHub Direct application surfaces

GitHub Direct is coordinated through:

- the dedicated CurveYield Audit GitHub App;
- a versioned pure protocol package;
- a GitHub adapter using least-privilege short-lived tokens;
- a dedicated `audit-direct/control-v1` branch;
- `.github/workflows/audit-direct-v1.yml`;
- an optional local CLI;
- GitHub Checks/statuses, issue/PR summaries, workflow metadata, and bounded artifacts.

The direct mode has no Cloudflare Worker, Pages, R2, binding, token, route, account ID, or Cloudflare endpoint dependency.

## GitHub Direct job ledger

Recommended durable paths:

```text
.audit-direct/v1/jobs/<job-id>/request_v1.json
.audit-direct/v1/jobs/<job-id>/events/<sequence>_<event-id>_v1.json
.audit-direct/v1/jobs/<job-id>/status/CURRENT_v1.json
.audit-direct/v1/jobs/<job-id>/results/result_manifest_v1.json
.audit-direct/v1/jobs/<job-id>/reports/report_index_v1.json
.audit-direct/v1/indexes/jobs_v1.json
```

Requests and events are immutable. Current pointers and deterministic indexes use current blob-SHA compare-and-swap. Result and report manifests are immutable after publication. Every job binds to an exact repository ID, installation ID, target commit SHA, requester identity, profile versions, policy version, request digest, execution-gate state, and expected result-contract versions.

Mutable branch or tag names are informative only; the authoritative audited source is the exact target commit SHA resolved before admission.

## GitHub identity

One dedicated Audit GitHub App private key is stored as `AUDIT_GITHUB_MASTER_KEY`. The App ID and approved installation/repository identities are non-secret variables. GitHub Actions uses its automatic per-run `GITHUB_TOKEN` when its declared permissions are sufficient and mints a short-lived installation token only for an approved operation that requires it.

The App private key must never enter browser code, a request manifest, workflow input, repository variable, report, log, Check, comment, or artifact. The optional CLI should use GitHub App user authorization through device flow or an equivalent short-lived user flow; ordinary CLI arguments must not accept App private-key material.

## GitHub Direct workflow boundary

The workflow:

- reads one exact immutable request blob;
- revalidates repository, installation, exact target SHA, profiles, policy, and execution gate;
- uses explicit least-privilege permissions, bounded concurrency, timeouts, cancellation, and artifact caps;
- does not accept arbitrary commands, scripts, workflows, actions, runner labels, images, URLs, RPC endpoints, credentials, wallets, calldata, signed transactions, or deployment targets;
- does not use `pull_request_target` to check out or execute untrusted pull-request code;
- runs only trusted repository-owned fixture/profile/parser/result tests while submitted execution is disabled;
- may coordinate a future approved executor only through the signed, replay-protected deferred-executor interface.

GitHub Actions is not the hostile-code sandbox.

## Reports

Cloudflare mode writes the bundled render, manifest, and report index to its R2-backed report store.

GitHub Direct writes an immutable report index to the control branch and may publish a bounded artifact bundle plus a Check, status, issue, or PR summary. The durable report index records mode, exact source SHA, workflow run ID, artifact ID, digest, byte size, retention/expiration metadata, normalized summary, and authoritative evidence references. Artifact retention is explicit and must not be represented as permanent.

Reports from both modes reference authoritative evidence IDs and digests rather than silently duplicating evidence. Every report prominently records either `cloudflare-audit-v1` or `github-direct-audit-v1` and whether Cloudflare/R2 were required or used.

## Capability declaration

A GitHub Direct result exposes a frozen truthful capability record including:

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

No client may infer submitted execution availability from the existence of a workflow, runner, profile, or artifact.
