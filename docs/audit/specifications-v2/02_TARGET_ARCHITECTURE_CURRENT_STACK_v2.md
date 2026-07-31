# Target Architecture — Current Stack v2

## Topology

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

Deferred external boundary:
Cloudflare Audit Worker -> approved hardened-compute adapter
```

## Storage as control-plane state

R2 is strongly consistent and supports ETag-conditional writes. The current-stack design therefore uses:

- immutable records for requests, policy decisions, manifests, events, and attestations;
- a small mutable current-state object per workspace, campaign, job, attempt, and fork;
- `onlyIf`/ETag checks for state-machine updates;
- deterministic indexes instead of `ListObjects` in hot paths;
- bundled archives instead of one object per source/artifact file.

## No new infrastructure dependency

This design does not require PostgreSQL, an external queue, an external object store, an external secrets manager, or a selected compute cloud. Workflow dispatch is GitHub-based. Durable state is R2-based. The future hardened executor integrates only through the interface in `15_EXTERNAL_HARDENED_COMPUTE_DEFERRED_INTERFACE_v2.md`.

## Repository structure

```text
apps/audit-api/
apps/audit-web/
packages/audit-protocol/
packages/audit-client/
packages/audit-r2-store/
packages/audit-policy/
packages/audit-workspace/
packages/audit-orchestrator/
packages/audit-evidence/
packages/audit-report/
packages/audit-github-app/
packages/audit-tool-contracts/
packages/audit-result-parsers/
profiles/audit/
infra/audit-cloudflare/
docs/audit/
test/audit/
test/boundary/
```

No Audit package may import from `packages/runner/`. Shared pure validation code may be moved to a neutral package only when Lite behavior remains byte-for-byte compatible under regression tests.
