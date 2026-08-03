# Accepted Work Ledger — 2026-08-03 09:25 PDT — v4

This ledger is additive. Preserve all earlier ledgers unchanged. GitHub live state remains authoritative.

## Current release and application binding

- Trusted release branch: `orchestrator/round4-ci-base-v1`
- Current release head: `23a6ec8d8cc89d3aaa5d6a19d843bc37544358b5`
- Current release-head source: PR #160
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Accepted application source PR: #150
- Last verified API Worker deployment: run `30808377849`, job `91668946456`, success
- Pages current-source acceptance: **not accepted**
- Current-source production smoke acceptance: **not accepted**

## PR #159 / v9 — rejected before run creation

- merge SHA: `11036211d5448e0bd32bb4c4fdd85bf638caa53d`
- no workflow run or job was created
- cause: `${{ runner.temp }}` was used in `jobs.deploy-pages.env`, where the `runner` context is unavailable
- issue #125 rejection comment: `5168839979`
- no Cloudflare request or production mutation occurred

## PR #160 / v10 — rejected live gate

### Test-first evidence

- RED-only head: `7a548d391a548fa6f7bc6de8544829da48e8693f`
- GitHub-Native run `30830941133`, job `91744410559`
- Live Fork run `30830942537`, job `91744413926`
- intended failure: missing `.github/workflows/deploy-v10.yml`
- all other 484 tests passed

### Final exact-head GREEN

- exact parent: `11036211d5448e0bd32bb4c4fdd85bf638caa53d`
- verified PR head: `44f0d2817964a27596dc0d1754645b782def3161`
- GitHub-Native run `30831344432`, job `91745775440`, success
- Live Fork run `30831348494`, job `91745789846`, success
- every recorded PR-CI step succeeded
- changed files: exactly five intended v10 files
- comments, reviews and inline threads: none
- mergeability: true
- exact-head merge guard: satisfied
- merge SHA: `23a6ec8d8cc89d3aaa5d6a19d843bc37544358b5`

### Trusted live run

- run: `30831520420`
- job: `91746369253`
- conclusion: failure
- issue #125 sanitized result: `5168944968`
- issue #125 rejection checkpoint: `5168973009`

Every job step was inspected:

1. setup — success
2. exact checkout — success
3. one-time request — success
4. accepted source and immutable manifest — success
5. configured production branch — success
6. direct deployment and combined poll — failure
7. custom-domain content check — skipped
8. cleanup — success
9. sanitized report — success
10. checkout cleanup — success
11. completion — success

The direct deployment response passed API success, deployment ID/URL, `environment: production`, exact release branch and exact application commit checks. All nine asset hashes were already present and no upload occurred.

The bounded poll incorrectly required both terminal deployment stage success and an exact entry in `.result.aliases`. Cloudflare Wrangler source treats alias discovery as optional; deployment completion is accepted from `latest_stage.name == "deploy"` and `latest_stage.status == "success"`.

Run `30831520420` must never be rerun.

## Active PR #161 / v11

- branch: `orchestrator/round5-pages-api-production-v11`
- exact parent: `23a6ec8d8cc89d3aaa5d6a19d843bc37544358b5`
- RED-only head: `8828513c42bdea060edc2cb523fefc399f0632bf`
- changed files at checkpoint: one focused v6 test only
- purpose: accept terminal deployment stage without aliases, record deployment short ID before polling, then verify the custom production domain separately by served HTML and JavaScript
- implementation added: false
- merge allowed: false

Require the natural missing-v11-gate RED before adding implementation.

## Failed runs that must never be rerun

- `30800918581`
- `30805768611`
- `30813209037`
- `30814064657`
- `30815289252`
- `30815965400`
- `30831520420`

## Network scope

Active only:

- Ethereum — chain ID `1` — `RPC_ETHEREUM`
- Base — chain ID `8453` — `RPC_BASE`

Deferred and prohibited:

- Arbitrum
- Fraxtal
- Katana
- Optimism
- Polygon

## Next action

Inspect the naturally triggered PR CI for v11 RED-only head `8828513c42bd...`. After the intended failure is captured, add a fresh exact-parent v11 request and workflow. Do not require deployment aliases. Require terminal deploy stage name/status and verify the custom domain by actual served content.

## Safety checkpoint

No secret value, raw RPC URL, authorization header, wallet key, signing method, deferred-network request, or public-chain transaction was recorded or used. v10 performed no dependency installation, asset upload, Worker deployment, R2 mutation, blockchain RPC call, signing or broadcast. No failed or historical workflow was rerun. No worker-owned ACK or STATUS file was modified.
