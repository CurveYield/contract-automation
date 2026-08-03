# Accepted Work Ledger — 2026-08-03 06:01 PDT — v2

This ledger is additive. Preserve the prior ledger `ACCEPTED_WORK_LEDGER_2026-08-03T0442-0700_v1.md` unchanged for PRs #139–#150 and earlier evidence. GitHub live state remains authoritative.

## Current release and application binding

- Trusted release branch: `orchestrator/round4-ci-base-v1`
- Current release head: `3c37394f814c40b1fc6fff134d2de698635bd185`
- Current head source: PR #156
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Accepted application source PR: #150
- API Worker last verified deployment: run `30808377849`, job `91668946456`
- Production Pages custom domain does **not** currently have accepted current-source UI evidence; it remains observed with the stale seven-network selector.

Do not describe `3c37394...` as an accepted deployed application. It is a release-branch deployment-request merge whose live Pages gate failed.

## Accepted historical evidence retained

### Deployment v3

- Source: `fbe27b824da8084970915b31f2051679abe39cfc`
- Run: `30806403201`
- Job: `91662681725`
- Conclusion: success

### Production smoke v1

- Source: `fbe27b824da8084970915b31f2051679abe39cfc`
- Run: `30807373463`
- Conclusion: success
- Current status: valid historical evidence, superseded for current-source acceptance by PR #150.

### Deployment v4

- Source/application: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Run: `30808377849`
- Job: `91668946456`
- Conclusion: success
- All recorded job steps succeeded.
- Later live evidence showed the Pages custom domain did not serve the PR #150 selector. Preserve the deployment receipt, but do not infer current Pages acceptance from it.

## New promoted PRs after the prior ledger

### PR #153 — current-source production smoke v2

- Merge source added a fresh read-only smoke workflow.
- Live run: `30813209037`
- Result: failure.
- Passed before failure: Pages availability, API health/setup, unauthorized rejection, authenticated Ethereum/Base allowlist, and CORS.
- Failed: production custom-domain selector exposed unexpected chain options.
- Ethereum/Base RPC checks were skipped after the UI failure.
- Do not rerun.

### PR #155 — Pages production-target deployment v5

- Release merge SHA: `669591985d27a7c9e7a3dee8be1ff1ab8821d2e2`
- Live run: `30814064657`
- Job: `91687395097`
- Result: failure.
- Wrangler uploaded accepted assets but inferred detached branch `HEAD`, producing a preview deployment while the custom domain remained stale.
- Do not rerun.

### PR #156 — explicit Pages production deployment v6

- Exact PR head: `7c17885b18bb99d2ce3711a7df1309f8e35c4858`
- Release merge SHA: `3c37394f814c40b1fc6fff134d2de698635bd185`
- Live run: `30815289252`
- Job: `91691417740`
- Job conclusion: failure
- Issue #125 result comment: `5166529795`

Exact step conclusions:

1. Set up job — success
2. Check out exact trusted source — success
3. Verify one-time explicit production request v6 — success
4. Verify committed static Pages assets — success
5. Verify configured Pages production branch — success
6. Deploy static assets with explicit production identity — success
7. Verify production custom domain serves explicit production deployment — failure
8. Report Production Pages explicit deployment v6 result — success
9. Post-checkout cleanup — success
10. Complete job — success

Observed deployment short ID: `1e0bf5b9`. The custom domain failed all six bounded selector checks.

Independent rejection finding:

- request: `dependencyInstallationAllowed: false`
- workflow action: `npm exec --yes --package=wrangler@4.116.0`
- decision: rejected because the workflow downloaded a runtime dependency contrary to its own immutable request and the account-owner instruction.

Root-cause correction:

- the log emitted `fatal: bad object 2c6e543...` while Wrangler attempted to infer an omitted commit message;
- current Wrangler source catches this metadata-discovery failure and continues with supplied branch and commit hash;
- the missing object is therefore not established as the production-routing cause.

Do not rerun v6.

## Active blocked candidate

### PR #157 — preserve Pages application commit object v7

- Branch: `orchestrator/round5-pages-commit-object-v7`
- Exact base: `3c37394f814c40b1fc6fff134d2de698635bd185`
- Last reviewed head: `0c457b8236bc673e11ea3e2fa888eff4f8fb5ae1`
- State: draft, mergeable, **blocked**
- Durable blocking comment: `5166610889`

Blockers:

1. It still downloads Wrangler with `npm exec --yes --package=wrangler@4.116.0`.
2. Its v7 request omits the earlier `dependencyInstallationAllowed: false` field rather than satisfying it.
3. Full checkout only repairs commit-message discovery; it does not prove production classification.
4. It does not require Cloudflare deployment response `environment: production`.
5. It does not require exact production/custom-domain alias binding before acceptance.

Do not merge the reviewed head and do not allow its live workflow to execute.

## Required next candidate behavior

Correct PR #157 or supersede it with a fresh exact-parent candidate that:

- uses no package manager and downloads no dependency;
- uses Cloudflare Pages API directly against the already-uploaded asset manifest;
- fails closed and performs no upload if any expected asset is missing;
- uses the configured Pages production branch by API contract;
- requires response `environment: production`;
- requires trigger metadata branch `orchestrator/round4-ci-base-v1`;
- requires exact production/custom-domain binding and then verifies the custom domain serves only Ethereum and Base with Base default and API-driven synchronization;
- performs no repository compilation, Worker deployment, secret mutation, R2 mutation, API job/upload submission, RPC call, signing, wallet action, or transaction broadcast;
- does not rerun any failed or historical workflow.

## Failed runs that must never be rerun

- `30800918581` / job `91645019455`
- `30805768611`
- `30813209037`
- `30814064657` / job `91687395097`
- `30815289252` / job `91691417740`

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

## Remaining issue #125 stages

1. Correct Pages production binding.
2. Run fresh current-source production smoke acceptance.
3. Test API identity separation and bounded negative cases.
4. Run bounded API/R2/GitHub compile-only workflow and cleanup.
5. Test GitHub bridge and Direct behavior.
6. Run trusted Ethereum/Base-only V27 live-fork regression.
7. Complete web/operator desktop, tablet, mobile, accessibility, and hostile-content acceptance.
8. Complete observability, redaction, retention, redeploy, rollback, partial-publication, duplicate-publication, and authorized key-rotation recovery evidence.
9. Publish final production acceptance record.

## Safety checkpoint

No secret value, raw RPC URL, authorization header, wallet key, signing method, or public-chain transaction was recorded or used in the v6 inspection or the PR #157 blocking review. No deferred network was tested. No historical workflow was rerun. No worker-owned ACK or STATUS file was modified.
