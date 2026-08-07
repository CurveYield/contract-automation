# Round 5 Pages Production-Domain Attach v10 — Design

## Proven state entering v10

Read-only v9 run `31187717248` proved:

- Pages canonical deployment binding is valid;
- exact deployment binding is valid;
- immutable deployment `db5d91bc` serves the accepted Ethereum/Base-only browser with two options and Base as sole default;
- Pages target-domain count is `0`;
- Worker target-domain count is `0`;
- `preflight.curveyield.online` is currently unreachable;
- diagnosis: `worker-domain-detached-pages-domain-not-attached`.

Therefore the only remaining browser-routing mutation is attaching the production hostname to the already-verified Pages project.

## Exact binding

- release parent: `7abbf2d0c090d8bc6344014e2d326ffbcb2ccafe`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Pages deployment short ID: `db5d91bc`
- Pages project: `curveyield-preflight`
- production hostname: `preflight.curveyield.online`
- v9 run: `31187717248`

## Preflight

Before mutation, GET the Pages project and require canonical deployment `db5d91bc`, production environment, trusted release branch, accepted commit, and terminal `deploy/success`. GET the Pages domain list and require target count zero. GET Worker custom domains filtered by hostname and require exact target count zero. Cache-bust the immutable deployment and require the accepted two-network browser contract.

## Mutation

POST exactly `{name: "preflight.curveyield.online"}` to the Pages project domain endpoint. Capture the POST HTTP status for evidence, but do not decide semantic success from the POST body alone. Poll the exact Pages-domain GET; success is established only when the exact hostname reports status `active`.

No Worker mutation is permitted in v10.

## Final acceptance

After Pages reports the domain active:

1. cache-bust production `/` and `/app.js` until they serve the accepted Ethereum/Base-only browser;
2. re-read the exact Pages domain and require active status;
3. re-read Worker custom domains and require target count zero;
4. publish bounded state to issue #125.

## Safety

- only mutation: one Pages custom-domain POST for the exact production hostname;
- no Pages project/deployment/asset mutation;
- no Worker-domain or Worker-script mutation;
- no R2/secret/job/upload/RPC/wallet/signing/public-chain mutation;
- no dependency installation/download, package manager, Wrangler, compile, or build;
- no failed or historical workflow rerun;
- no account/domain identifiers, service URLs, response bodies, or secret values published.

## Failure handling

If Pages-domain activation fails, the workflow records the POST status and bounded exact-domain status but performs no destructive cleanup. The verified Pages deployment remains intact. Because v9 proved the former Worker binding is already absent and its service identity was intentionally not persisted, restoring that historical Worker binding is outside v10's safe information boundary and would require separate account-owner-supported recovery only if Pages cannot be activated.
