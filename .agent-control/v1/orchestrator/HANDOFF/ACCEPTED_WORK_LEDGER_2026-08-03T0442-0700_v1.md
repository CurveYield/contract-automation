# Accepted Work Ledger — 2026-08-03 04:42 PDT

This ledger exists to prevent accepted work from being lost, overlooked, or repeated by a replacement orchestrator.

GitHub live state remains authoritative. Re-fetch the referenced PRs, runs, jobs, comments, SHAs, and branch heads before acting. When live state matches this ledger, treat the work as complete historical evidence. Do not redo it merely to reconstruct context.

## Current trusted production source

- Repository: `CurveYield/contract-automation`
- Release branch: `orchestrator/round4-ci-base-v1`
- Current source and deployed SHA: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Source PR: #150
- Production deployment v4 run: `30808377849`
- Production deployment v4 job: `91668946456`
- Deployment v4 conclusion: `success`
- Active networks: Ethereum and Base only
- Deferred and prohibited networks: Arbitrum, Fraxtal, Katana, Optimism, Polygon

All deployment v4 steps succeeded, including exact-source checkout, request verification, configuration-name checks, existing R2 verification, tests, lint, Pages build, Worker deployment, secret upload without value logging, API-domain deployment, health verification, Pages deployment, custom-domain verification, and sanitized issue reporting.

## Promoted pull requests — do not repeat

| PR | Purpose | Merge SHA | State |
|---:|---|---|---|
| #139 | Round 4 accepted static integration | `42a54988b7b5135ddb6cba90891ad2706356363c` | merged/accepted |
| #140 | Round 5 production-test preparation and Ethereum/Base scope | `6e2ec3d4ac3b8a454ecf605195cd8a43049de6ca` | merged/accepted |
| #141 | Trusted deployment preflight hardening | `819fa7e90cebc4287eebda8e9ecbd0486522d33c` | merged/accepted |
| #142 | One-time trusted deployment trigger | `81b7d3b2f4cf4636f204ae778617103804c30012` | merged/accepted |
| #143 | Secretless deployment observer | `de350bcfce68ddbdbbb88b826fdd5f7614bce69a` | merged/accepted |
| #144 | GET-only Cloudflare R2 diagnostic | `8734852cbf6a08d6cfa65d611035e98a30494f50` | merged/accepted |
| #145 | GET-only Cloudflare auth/account/R2 classification | `4eeeb50ddfbc4c16d5694a8a5bd96a1b24b9856b` | merged/accepted |
| #146 | Replacement Cloudflare-token re-verification | `4a4cf0f85ba1fdf9a31e7e7dfa4341256bebb667` | merged/accepted |
| #147 | Fresh Ethereum/Base deployment v2 | `bb500321d084dfc9336304898f9cdd8b65bd9e1b` | merged; deployment attempt failed at lifecycle format |
| #148 | Native R2 lifecycle repair and deployment v3 | `fbe27b824da8084970915b31f2051679abe39cfc` | merged/accepted |
| #149 | Read-only production smoke acceptance for `fbe27b...` | `ec6c5c3c99a767dbed5505846a3ce4efee9290ca` | merged/accepted for old source; superseded by #150 source change |
| #150 | Restrict production UI to Ethereum/Base and redeploy v4 | `2c6e543dfcaa17ca975bbde3c15302269bbf8072` | merged/deployed/accepted |

## Accepted test-first evidence — preserve

### Round 4 and static Round 5

- Round 4 exact-tree digest: `22ee6ee759c027189b9e8887e584c976e378a6de917a20acb0e5275e3a1afc16`
- Round 4 static acceptance: `ACCEPT`
- Round 5 static package digest: `e79602477befb743a51052a245e8ffc86e308c5488c98f80a936fba11bc463e3`
- Round 5 static production-test readiness: `ACCEPT`

Do not recompute historical digests from a later mutable tree. Verify immutable manifest/source bindings instead.

### Cloudflare replacement-token verification — PR #146

RED:
- GitHub-Native run `30805035537`: expected failure
- Live Fork run `30805034978`: expected failure
- 474 tests passed; only missing re-verification workflow failed

GREEN at `ca38720839d89352f8d47d6ac7f991c675400650`:
- GitHub-Native run `30805161917`, job `91658716465`: success
- Live Fork run `30805161911`, job `91658716895`: success
- Token, configured account scope, and existing R2 bucket were later verified as accessible without recording values or response bodies

### Deployment v2 — PR #147

RED:
- GitHub-Native run `30805505626`: expected failure
- Live Fork run `30805505787`: expected failure

GREEN at `cc819ae54d9b27c6f8688742765f8b1b80621837`:
- GitHub-Native run `30805645360`, job `91660265846`: success
- Live Fork run `30805645379`, job `91660266022`: success

Live deployment run `30805768611` failed because `infra/r2-lifecycle.json` used the S3-style lifecycle schema. The failed run was not rerun. Preserve it as diagnostic evidence; do not repeat it.

### R2 lifecycle repair and deployment v3 — PR #148

RED at `119af8bd43dce470b218582b71d482e021af6bec`:
- GitHub-Native run `30806016538`, job `91661452406`: expected failure
- Live Fork run `30806016525`: expected failure
- 476 tests passed; only the demonstrated lifecycle-schema mismatch failed

GREEN at `72b504f4624f35ab93ea5aed59b818f129d997b8`:
- GitHub-Native run `30806220776`, job `91662095938`: success
- Live Fork run `30806221042`, job `91662096780`: success

Deployment v3:
- run `30806403201`
- job `91662681725`
- source `fbe27b824da8084970915b31f2051679abe39cfc`
- conclusion `success`

### Production smoke acceptance v1 — PR #149

RED at `7da218720b2134a64063230365ea6ce62507a0bf`:
- GitHub-Native run `30806682972`: expected failure
- Live Fork run `30806683013`, job `91663568616`: expected failure

GREEN at `06cd80e02b21ce7841536dbd071edf71c4004a09`:
- GitHub-Native run `30807185547`, job `91665169896`: success
- Live Fork run `30807185516`, job `91665169873`: success

Live smoke acceptance:
- run `30807373463`
- deployed source under test `fbe27b824da8084970915b31f2051679abe39cfc`
- acceptance source `ec6c5c3c99a767dbed5505846a3ce4efee9290ca`
- result `success`
- Pages, health, setup readiness, unauthorized rejection, Ethereum/Base allowlist, CORS, Ethereum chain/head, and Base chain/head passed
- no jobs, uploads, signing, wallet methods, or transaction broadcasts were performed

This smoke evidence remains valid historical evidence for `fbe27b...`, but it cannot close acceptance for the later UI-changed source `2c6e543...`.

### Production UI scope repair and deployment v4 — PR #150

RED at `28fa01f266e0f59fb87276ee3c8a1ec10beaafba`:
- GitHub-Native run `30807973561`: expected failure
- Live Fork run `30807973599`, job `91667674788`: expected failure
- focused live-fork tests passed
- full suite failed on the demonstrated seven-network/Polygon-default selector and absent v4 request/workflow

GREEN at `e0441639defca2bbcd47e004c38b955a2148460e`:
- GitHub-Native run `30808227875`: success
- Live Fork run `30808227864`, job `91668477191`: success
- focused suites, complete repository tests, lint, Pages build, and JavaScript syntax checks succeeded

Deployment v4:
- run `30808377849`
- job `91668946456`
- deployed source `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- conclusion `success`

## Explicit anti-duplication rules

1. Do not rerun failed or historical workflow runs listed above.
2. Do not recreate accepted PRs or redo their RED/GREEN sequences.
3. Do not recompute historical acceptance digests from the current mutable tree.
4. Do not repeat token diagnostics unless live evidence shows the credential state changed.
5. Do not repeat deployment v3 or v4 merely to verify that they happened; inspect their recorded runs/jobs.
6. Do not treat smoke run `30807373463` as current-source acceptance. A new smoke gate is required only because PR #150 changed the deployed application source.
7. Any new gate must bind the exact current parent SHA and use a new one-time request. Never rerun a superseded gate.
8. Preserve all issue #125 comments and PR descriptions as durable evidence.

## Exact next work

The next orchestrator must first re-fetch the current release branch and deployment v4 job. If they remain `2c6e543...` and success, create one fresh exact-parent read-only production smoke gate for the v4 source. It must include the previous API/RPC checks plus deployed UI checks proving only Ethereum/Base are selectable, Base is the default, and the client synchronizes from `/api/v1/chains`.

After current-source smoke acceptance, continue the remaining issue #125 stages without redoing accepted work: bounded API identity separation, R2 and GitHub workflow tests, trusted Ethereum/Base V27 regression, web/operator acceptance, observability, recovery, idempotent redeploy, rollback, duplicate-publication reconciliation, and one non-production application-key rotation when explicitly authorized.
