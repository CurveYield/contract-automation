# Testing and Acceptance v2

## Shared current-stack test layers

- protocol and schema unit tests;
- deterministic serialization, hashing, and identity tests;
- hostile-object and defensive-clone tests;
- trusted GitHub Actions fixture tests for every parser/profile/result contract;
- UI/report/Check/comment escaping and hidden-resource tests;
- exact source commit and authorization binding tests;
- cancellation, timeout, retry, and idempotency tests;
- Lite boundary regression tests;
- cross-mode isolation and no-fallback tests.

## Cloudflare mode test layers

- in-memory R2 adapter tests;
- R2 billing-class mapping tests;
- conditional-write conflict tests;
- object key and manifest integrity tests;
- lifecycle and quota tests;
- Cloudflare Worker component tests;
- browser upload and retrieval tests;
- Cloudflare-mode GitHub App token/permission fixtures.

## R2 acceptance

- no hot-path `ListObjects` calls;
- per-function A/B estimates match adapter call traces;
- bundles remain within caps;
- expired prefixes are deleted under lifecycle tests;
- status overwrites do not accumulate object versions in application indexes;
- ETag conflicts do not lose transitions;
- one conservative audit-job fixture stays within 75 Class A, 46 Class B, and 0.0342 GB-month under free-development assumptions;
- admin usage report matches synthetic operation traces;
- same-account mode subtracts configured Lite reserve.

These requirements apply to `cloudflare-audit-v1` only.

## GitHub Direct protocol and ledger acceptance

- exact request, event, current-state, capability, result-index, and report-index schemas;
- unknown and forbidden fields fail with stable bounded codes and paths;
- every job binds to exact repository ID, installation ID, target commit SHA, requester, profile versions, policy version, request digest, and execution-gate state;
- request and event records are immutable;
- current pointers and deterministic indexes use current blob-SHA compare-and-swap;
- stale writes, duplicate requests/events/results/reports, and partial retries are deterministic and idempotent;
- no mutable branch or tag is authoritative source identity;
- control-branch writes are confined to `.audit-direct/v1/**`;
- production protocol/ledger packages have no filesystem enumeration, process execution, network, credential, wallet, transaction, deployment, Cloudflare, R2, or Lite capability.

## GitHub App adapter acceptance

- approved installation and repository allowlists are enforced;
- operation-specific permission maps are exact and least privilege;
- `GITHUB_TOKEN` is preferred where sufficient;
- installation tokens are short lived and repository/permission scoped;
- token expiry, revocation, rate limiting, retries, and redaction are deterministic;
- branch compare-and-swap, workflow dispatch/status, Check/status, issue/PR comment, and artifact metadata fixtures are idempotent;
- GitHub response bodies, headers, tokens, key details, stack traces, and local paths do not enter public errors;
- no Cloudflare endpoint, credential, package, binding, route, or R2 operation is used.

## GitHub Direct workflow acceptance

- only approved direct-mode dispatch or control-branch request paths trigger the workflow;
- the workflow reads and revalidates one exact immutable request blob;
- exact repository, installation, request digest, target SHA, profile, policy, and capability identities are checked;
- permissions default to read-only and are elevated per job only where required;
- untrusted pull requests cannot access App private-key or installation-token minting jobs;
- `pull_request_target` never checks out or executes untrusted pull-request code;
- no manifest may select an arbitrary command, script, workflow, Action repository, runner label, image, URL, RPC endpoint, credential, wallet, calldata, signed transaction, or deployment target;
- execution-disabled non-fixture requests stop at `awaiting_executor` or `execution_plane_unavailable`;
- trusted repository-owned fixtures produce normalized bounded results;
- timeouts and cancellation produce terminal immutable manifests;
- artifacts are size capped and retention/expiration is recorded;
- Check/comment/report publication is bounded and idempotent;
- third-party Actions are pinned to immutable commit SHAs for production acceptance;
- no Cloudflare step, secret, binding, URL, package, or account value is present.

## GitHub Direct CLI acceptance

- the selected mode, repository, and exact commit SHA are shown before a write;
- device-flow or equivalent short-lived user authorization is used;
- App private-key material is not accepted through ordinary CLI arguments;
- submit, status, report, cancel, and capabilities commands use versioned contracts;
- local credential output is redacted;
- retries do not duplicate jobs, events, Checks, comments, or reports;
- all Cloudflare credentials may be absent.

## Cross-mode regression acceptance

- a `cloudflare-audit-v1` request cannot be admitted by GitHub Direct;
- a `github-direct-audit-v1` request cannot be admitted by the Cloudflare API;
- failure of either mode never invokes the other;
- mode-specific current state, indexes, credentials, artifacts, and reports never overlap;
- direct-mode production modules do not import from `apps/audit-api`, `packages/audit-r2-store`, or `infra/audit-cloudflare`;
- Cloudflare-mode behavior remains unchanged where byte compatibility is required;
- shared profile/parser/result/evidence/report contracts produce the same canonical normalized envelope for the same trusted fixture;
- removing or disabling GitHub Direct does not break Cloudflare Audit;
- removing Cloudflare credentials does not break GitHub Direct;
- Lite boundary tests continue to pass.

## Execution-disabled acceptance

- submitted projects cannot advance beyond `awaiting_executor` or an equivalent explicit execution-plane-unavailable state;
- no workflow accepts an uploaded project path or arbitrary ref as executable input;
- trusted fixtures are clearly marked and repository owned;
- external executor callbacks are rejected unless signed, replay protected, exact-job bound, and capability checked;
- feature flags are false by default in every deployment environment;
- GitHub Actions and Cloudflare Workers are never represented as the hostile-code sandbox.

## GitHub Direct production acceptance gate

GitHub Direct v1 is accepted only when:

- the complete direct-mode path operates with every Cloudflare and R2 credential absent;
- static and runtime tests prove no Cloudflare/R2 dependency in direct-mode production paths;
- no browser receives a GitHub App private key or installation token;
- all repository writes are confined to approved control-branch and reporting surfaces;
- exact-source, identity, permission, branch-protection, idempotency, rate-limit, artifact, retention, cancellation, incident, and recovery tests pass;
- submitted-project execution remains disabled unless the separate hardened-compute acceptance gate has passed;
- the existing Cloudflare Audit mode and CurveYield Lite remain unchanged.
