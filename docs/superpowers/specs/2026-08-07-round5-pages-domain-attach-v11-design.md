# Round 5 Pages Production-Domain Attach v11 — Idempotent Design

## Proven state

Read-only v9 run `31187717248` proved the recreated Pages project has canonical production deployment `db5d91bc`, the immutable deployment serves the accepted Ethereum/Base-only browser, the former Worker custom-domain binding is absent, the Pages custom-domain association is absent, and `preflight.curveyield.online` is unreachable.

V10 was promoted at source SHA `d10f2eaea3ef87b1d0d3f3e7dfabed792ed3526d`, but no durable issue receipt was observed. V11 must therefore be safe whether V10 never ran or merely completed late.

## Goal

Make `preflight.curveyield.online` active on the already-verified `curveyield-preflight` Pages project, while preventing a race with V10 and performing no Worker, asset, deployment, or project mutation.

## Exact binding

- repository: `CurveYield/contract-automation`
- release branch: `orchestrator/round4-ci-base-v1`
- required previous release SHA: `d10f2eaea3ef87b1d0d3f3e7dfabed792ed3526d`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- verified Pages deployment short ID: `db5d91bc`
- v9 state run: `31187717248`
- Pages project: `curveyield-preflight`
- production hostname: `preflight.curveyield.online`

## Concurrency and idempotence

V11 uses the exact V10 concurrency group `curveyield-preflight-pages-domain-attach-v10` with `cancel-in-progress: false`. Therefore V10 and V11 cannot mutate the hostname concurrently.

After acquiring the lock, V11 reads current ownership:

- Worker custom-domain count for the target hostname must be exactly zero.
- Pages target-domain count may be zero or one only.
- If the Pages count is zero, V11 performs exactly one Pages domain POST.
- If the Pages count is one, V11 performs no POST and treats the existing association as the candidate state to verify.
- Any Worker count other than zero or Pages count greater than one is a fail-closed routing conflict.

## Deployment precondition

Before any attach attempt, the Pages project GET must prove its canonical deployment is `db5d91bc`, production, bound to the trusted release branch and accepted application commit, and terminal `deploy/success`. The exact canonical deployment GET must reproduce that binding. Cache-busted immutable `/` and `/app.js` must still satisfy the accepted browser contract:

- selector values exactly `ethereum`, `base`;
- Base solely selected;
- no deferred networks in the selector;
- authenticated chain synchronization JavaScript remains present.

## Attach and authority check

If attachment is needed, POST only `{ "name": "preflight.curveyield.online" }` to the Pages project domain endpoint. Capture bounded HTTP status, but do not infer semantic success from the POST body.

Poll the exact Pages domain GET until the exact hostname reports `active`. Once active, poll cache-busted production `/` and `/app.js` until they satisfy the accepted browser contract.

Final authority requires:

1. exact Pages domain status `active`;
2. Worker target-hostname count `0`;
3. production UI accepted with exactly two selector options.

## Allowed mutation

Only one mutation is permitted, and only when the target Pages domain is absent:

- `POST /accounts/{account_id}/pages/projects/{project_name}/domains` for `preflight.curveyield.online`.

## Prohibited

- Worker-domain or Worker-script mutation;
- Pages project/deployment/asset mutation;
- dependency installation/download, package manager, Wrangler, compile, or build;
- R2/secret/job/upload/RPC/wallet/signing/public-chain mutation;
- failed or historical workflow rerun;
- publication of account/domain identifiers, response bodies, service URLs, or secret values.

## Acceptance

V11 succeeds only when the production hostname itself serves the accepted Ethereum/Base-only browser, Pages reports the domain active, and Worker reports zero custom-domain matches. If V10 already completed, V11 must verify that state without repeating the attach mutation.
