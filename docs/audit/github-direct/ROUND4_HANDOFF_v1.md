# GitHub Direct Round 4 Handoff v1

## Release inputs

- Repository: `CurveYield/contract-automation`
- Round 3 issue: `#115`
- Round 3 branch: `audit-round3/github-direct-audit-release-v1`
- Starting SHA: `66c3060da74ba79a780847eb86307d0b5641b20a`
- Approved repaired core SHA: `22c22dd9de0e21b066ac29c9e0d9422a73724a31`
- Round 3 code/test candidate SHA: `f6e3ce63b18aed898d6458685026d313feb47440`
- Control branch: `audit-direct/control-v1`
- Ledger root: `.audit-direct/v1`

The final documentation commit SHA is intentionally not embedded here because doing so would make this document self-referential. Use the final issue #115 report and mailbox completion record as the authoritative final branch SHA.

## Deterministic manifests

- `ROUND3_COMPATIBILITY_MANIFEST_v1.json`
  - ID: `direct-compatibility-6d2105b95a084de2c0111311`
  - digest: `sha256:6d2105b95a084de2c011131172f14621a4212b196d527c96cd8816f017ff31cf`
- `ROUND3_RELEASE_MANIFEST_v1.json`
  - ID: `direct-round3-release-acd2105c6842079f26e7092b`
  - digest: `sha256:acd2105c6842079f26e7092b3814a56fbe2ce151a89e89a1431906d9bcc97ea6`
- Protected simulation/RPC manifest digest:
  - `sha256:a0c0e54c48bda474c480d795f470de52bc5195f5eacc02cdf3f216ef744e8e16`

Validate both JSON manifests through the public service exports before integration.

## Public contracts for Worker 1 API intake

Import only from:

```text
packages/audit-github-direct-service/src/index.mjs
```

Supported public schemas:

| Record | Schema |
|---|---|
| service command | `github-direct-service-command-v1` |
| service result | `github-direct-service-result-v2` |
| service error | `github-direct-service-error-v1` |
| compatibility manifest | `github-direct-compatibility-manifest-v1` |
| release manifest | `github-direct-round3-release-manifest-v1` |

Required API boundary behavior:

1. Validate every command before authorization or transport use.
2. Validate every result/error before serialization.
3. Treat `resultId` and `resultDigest` as mandatory for v2 results.
4. Reject v1 service results at the external API boundary. The trusted CLI alone contains a command-bound v1-to-v2 migration adapter for compatibility with the internal legacy implementation.
5. Never accept caller-authored command paths, URLs, shell commands, runner labels, images, credentials, workflow scope, or execution-enable flags.
6. Never expose GitHub tokens, authorization headers, provider objects, or transport internals in results or logs.

## Integration order for Worker 2

Integrate and test in this order:

1. protocol
2. ledger
3. auth
4. adapter
5. runner
6. reporting
7. service
8. CLI
9. trusted workflow

Do not bypass package public indexes. In particular, use the v2 service facade from `packages/audit-github-direct-service/src/index.mjs`; do not import the private legacy `service.mjs` implementation directly.

## State and publication invariants

- Non-fixture `submit` stops at `awaiting_executor` and remains cancellable.
- Only an allowlisted repository-owned fixture may produce a modeled completed result.
- Submitted project source is never imported or executed.
- `report` truthfully terminalizes unavailable execution.
- `cancel` creates immutable `not_executed` result/report records before final cancellation publication.
- Request, current-state, event, jobs-index, result, report, manifest, and publication paths are server-derived.
- Publication reconciliation searches up to ten 100-record pages before creating a Check, status, or comment after a missing journal.
- Publication journals use `.audit-direct/v1/publications/<job>/<publication>.json` only.
- Artifact metadata is queried by the exact name `audit-direct-result-<repositoryId>-<targetCommitSha>` and filtered again locally.

## Trusted workflow configuration

Repository-owned variables required before a real workflow run:

- `GITHUB_DIRECT_INSTALLATION_ID`
- `GITHUB_DIRECT_REPORT_ISSUE`

The workflow accepts only:

- one fixed operation from the declared choice list;
- one exact 40-character target SHA.

Trusted implementation is checked out at `github.workflow_sha`. Target source is checked out separately with persisted credentials disabled and remains inert data. Do not add submitted execution, Cloudflare fallback, untrusted workflow triggers, mutable action tags, caller-selected runners, or broad top-level permissions.

## Permission subsets

| Operation | Permissions |
|---|---|
| status / capabilities / verify-fixture | `contents: read` |
| submit | `contents: write`, `checks: write`, `statuses: write`, `issues: write`, `actions: read` |
| cancel | `contents: write`, `statuses: write`, `issues: write` |
| report | `contents: write`, `statuses: write`, `issues: write`, `actions: read` |

## Round 4 acceptance commands

Run from an isolated exact candidate checkout without installing dependencies:

```text
node --test test/*.test.mjs
find packages/audit-github-direct-* apps/audit-github-direct-cli/src -type f -name '*.mjs' -print0 | xargs -0 -n1 node --check
```

Also parse `.github/workflows/audit-direct-v1.yml`, parse all Round 3 JSON manifests, run whitespace checks, compare all changed paths to issue #115 ownership, and verify each protected simulation/RPC blob against `ROUND3_PROTECTED_BLOBS_v1.json`.

Round 3 observed local result before documentation publication: **100 tests passed, 0 failed, 0 skipped, 0 cancelled**.

## Explicitly unperformed operations

Round 3 did not install dependencies, run submitted code, perform live GitHub/RPC calls from tests, approve or execute the workflow, deploy, sign, transact, open a PR, merge, or modify main.

## Residual operational risks

- Real workflow behavior still requires an authorized run after repository variables are configured; Round 3 was intentionally static/inert.
- Publication recovery is bounded to 1,000 records per side-effect type. A repository exceeding that window before journal repair requires operator reconciliation rather than blind recreation.
- GitHub artifact bytes remain outside this package. Only bounded metadata and target binding are handled.
- Repository administrators must preserve branch protection and prevent modification of trusted workflow source outside the normal reviewed release process.
