# GitHub Direct Round 4 Handoff v1

## Verified release inputs

- Repository: `CurveYield/contract-automation`
- Round 3 issue: `#115`
- Round 3 branch: `audit-round3/github-direct-audit-release-v1`
- Starting SHA: `66c3060da74ba79a780847eb86307d0b5641b20a`
- Approved repaired core SHA: `22c22dd9de0e21b066ac29c9e0d9422a73724a31`
- Verified Round 3 candidate SHA: `46873f805199e2212af3902c8525c0f3e4501721`
- Control branch: `audit-direct/control-v1`
- Ledger root: `.audit-direct/v1`

The final documentation commit is intentionally recorded in issue #115 and the Worker 3 mailbox rather than embedded self-referentially in this document.

## Deterministic manifests

### Compatibility

- File: `ROUND3_COMPATIBILITY_MANIFEST_v1.json`
- ID: `direct-compatibility-2a7b937fd31fac897e936414`
- Digest: `sha256:2a7b937fd31fac897e93641457d79f15e367dffa5c1bd685398b92c2dcfca708`

### Release

- File: `ROUND3_RELEASE_MANIFEST_v1.json`
- ID: `direct-round3-release-418edd6cf9b65dbd77032a08`
- Digest: `sha256:418edd6cf9b65dbd77032a08f3cb8236374771835a550935ec99cddca1bf82db`

### Protected simulation/RPC boundary

- Digest: `sha256:a0c0e54c48bda474c480d795f470de52bc5195f5eacc02cdf3f216ef744e8e16`

Validate both JSON manifests through the public service exports before integration.

## Worker 1 API intake

Import only from:

```text
packages/audit-github-direct-service/src/index.mjs
```

Public schemas:

- command: `github-direct-service-command-v1`
- result: `github-direct-service-result-v2`
- error: `github-direct-service-error-v1`
- compatibility manifest: `github-direct-compatibility-manifest-v1`
- release manifest: `github-direct-round3-release-manifest-v1`

Validate every command before authorization/transport use and every result/error before serialization. Reject private v1 service results at external boundaries; only the trusted CLI may perform its command-bound migration to v2.

## Worker 2 integration order

1. protocol
2. ledger
3. auth
4. adapter
5. runner
6. reporting
7. service
8. CLI
9. trusted workflow

Do not bypass package public indexes or import private legacy service internals.

## State and publication invariants

- Non-fixture submission stops at `awaiting_executor` and remains cancellable.
- Only an allowlisted repository-owned inert fixture may produce a modeled completed result.
- Submitted source is never imported or executed.
- `report` truthfully terminalizes unavailable execution.
- `cancel` creates immutable not-executed result/report records before cancellation publication.
- All request/current/event/index/result/report/manifest/publication paths are server-derived.
- Missing-journal recovery searches at most ten pages of 100 records before creating a Check, status or comment.
- Publication journals use `.audit-direct/v1/publications/<job>/<publication>.json`.
- Artifact metadata is queried and filtered for `audit-direct-result-<repositoryId>-<targetCommitSha>`.

## Trusted workflow prerequisites

Repository-owned variables:

- `GITHUB_DIRECT_INSTALLATION_ID`
- `GITHUB_DIRECT_REPORT_ISSUE`

Caller inputs are limited to one declared operation and one exact 40-character target SHA. Trusted implementation is checked out at `github.workflow_sha`; submitted target source is checked out separately with persisted credentials disabled and remains inert data.

Permission subsets:

| Operation | Permissions |
|---|---|
| status / capabilities / verify-fixture | `contents: read` |
| submit | `contents: write`, `checks: write`, `statuses: write`, `issues: write`, `actions: read` |
| cancel | `contents: write`, `statuses: write`, `issues: write` |
| report | `contents: write`, `statuses: write`, `issues: write`, `actions: read` |

## Minimal Round 4 acceptance

From an isolated checkout of the verified candidate:

```text
node --test test/*.test.mjs
find packages/audit-github-direct-* apps/audit-github-direct-cli/src -type f -name '*.mjs' -print0 | xargs -0 -n1 node --check
```

Also parse `.github/workflows/audit-direct-v1.yml`, validate both Round 3 manifests, run whitespace checks, enforce issue #115’s changed-path allowlist and verify every protected simulation/RPC blob.

Round 3 reconstructed result:

```text
100 tests passed
0 failed
0 skipped
0 cancelled
```

## Explicit exclusions

Round 3 did not install dependencies, run submitted code, perform live GitHub/RPC calls from tests, approve or execute the workflow, deploy, sign, transact, open a PR, merge, or modify `main`.

## Residual operational risks

- A real workflow run remains an authorized Round 4 task after repository variables and branch protection are reviewed.
- Publication recovery is bounded to 1,000 records per side-effect type; older unmatched records require operator reconciliation.
- GitHub artifact bytes and submitted execution remain outside this package.
- Repository administrators must preserve trusted workflow source and branch protection.
