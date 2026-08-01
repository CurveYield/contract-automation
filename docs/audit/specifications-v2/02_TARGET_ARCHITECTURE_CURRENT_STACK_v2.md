# Target Architecture — Current Stack v2

## Explicit mode selection

Every Audit request selects exactly one operating mode before admission:

- `cloudflare-audit-v1` — the existing Cloudflare Worker/Pages and R2-backed control plane;
- `github-direct-audit-v1` — a separate GitHub App/GitHub Actions and repository-native control plane.

Neither mode is a replacement, proxy, failover path, or automatic fallback for the other. A failure remains in the selected mode. Shared profile, parser, result, evidence, and report contracts are transport-neutral pure dependencies; mutable state, credentials, storage adapters, entry points, and indexes remain mode-specific.

## Cloudflare mode topology

```text
Browser / API client
        |
        v
Cloudflare Audit Worker
- authentication and scopes
- schema validation
- upload grants
- R2 conditional writes
- policy admission
- status and evidence retrieval
- no project execution
        |
        +----> Audit R2 Standard bucket
        |      - immutable source/layer bundles
        |      - indexes and current state
        |      - event and log chunks
        |      - artifacts/evidence/reports
        |      - fork control records/checkpoints
        |
        +----> GitHub App / GitHub Actions
               - repository coordination
               - trusted control-plane tests
               - trusted fixture parser/profile tests
               - deployment workflows
               - no submitted-project execution
```

Deferred external boundary:

```text
Cloudflare Audit Worker -> approved hardened-compute adapter
```

## GitHub Direct mode topology

```text
Approved client
- ChatGPT GitHub connector
- local CLI
- approved repository UI action
        |
        v
Dedicated CurveYield Audit GitHub App
- installation and repository authorization
- exact target commit resolution
- least-privilege short-lived token use
        |
        v
Dedicated control branch: audit-direct/control-v1
- immutable request manifests
- append-only transition records
- compare-and-swap current pointers and indexes
- immutable result/report manifests
        |
        v
GitHub Actions audit-direct workflow
- revalidates the exact request blob and target SHA
- enforces capability and execution gates
- runs trusted repository-owned fixtures only while execution is disabled
- coordinates any future approved executor only through the deferred adapter boundary
        |
        +----> GitHub Checks / commit statuses
        +----> issue or pull-request comments
        +----> bounded GitHub Actions artifacts
        +----> control-branch result/report manifests
```

Cloudflare Worker, Pages, R2, Cloudflare tokens, bindings, routes, account IDs, and Cloudflare availability are absent from the GitHub Direct production path.

Deferred external boundary:

```text
GitHub Direct workflow -> approved hardened-compute adapter
```

GitHub Actions remains coordination infrastructure and is not the claimed hostile-code sandbox.

## Cloudflare storage as control-plane state

R2 is strongly consistent and supports ETag-conditional writes. Cloudflare mode therefore uses:

- immutable records for requests, policy decisions, manifests, events, and attestations;
- a small mutable current-state object per workspace, campaign, job, attempt, and fork;
- `onlyIf`/ETag checks for state-machine updates;
- deterministic indexes instead of `ListObjects` in hot paths;
- bundled archives instead of one object per source/artifact file.

## GitHub Direct repository state

GitHub Direct uses:

- immutable request and event files on `audit-direct/control-v1`;
- mutable current pointers and deterministic indexes updated only through current blob-SHA compare-and-swap;
- exact GitHub repository ID, installation ID, and target commit SHA binding;
- immutable result and report manifests;
- GitHub run and artifact identifiers with explicit retention/expiration metadata;
- bounded Checks, statuses, issues, or pull-request comments for summaries.

GitHub Actions artifacts are not represented as permanent storage. Durable manifests preserve identities, digests, sizes, run/artifact IDs, normalized summaries, and expiration state without storing secrets or unbounded raw output in Git.

## No new infrastructure dependency

This design does not require PostgreSQL, an external queue, an external object store, an external secrets manager, or a selected compute cloud. Cloudflare mode uses R2-based durable state. GitHub Direct uses GitHub-native durable control records and bounded artifacts. The future hardened executor integrates only through the interface in `15_EXTERNAL_HARDENED_COMPUTE_DEFERRED_INTERFACE_v2.md`.

## Repository structure

```text
apps/audit-api/
apps/audit-web/
apps/audit-github-direct-cli/
packages/audit-protocol/
packages/audit-client/
packages/audit-r2-store/
packages/audit-policy/
packages/audit-workspace/
packages/audit-orchestrator/
packages/audit-evidence/
packages/audit-report/
packages/audit-github-app/
packages/audit-github-direct-protocol/
packages/audit-github-direct-ledger/
packages/audit-github-direct-adapter/
packages/audit-github-direct-runner/
packages/audit-tool-contracts/
packages/audit-result-parsers/
profiles/audit/
infra/audit-cloudflare/
docs/audit/
test/audit/
test/boundary/
.github/workflows/audit-direct-v1.yml
```

No Audit package may import from `packages/runner/`. GitHub Direct production packages may not import from `apps/audit-api`, `packages/audit-r2-store`, or `infra/audit-cloudflare`. Cloudflare production entry points may not admit a `github-direct-audit-v1` request. Shared pure validation code may be moved to a neutral package only when Cloudflare Audit behavior and Lite behavior remain unchanged under regression tests.
