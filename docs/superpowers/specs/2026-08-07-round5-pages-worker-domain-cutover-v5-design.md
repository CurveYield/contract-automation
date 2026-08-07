# Round 5 Pages / Worker-Domain Cutover v5 — Design

## Proven state entering v5

GET-only v4 run `31184375729` established that `preflight.curveyield.online` has exactly one Worker custom-domain binding and that the production hostname serves the stale seven-network operator. The expected Pages project detail GET for `curveyield-preflight` returns `404`. The previous v11 direct Pages deployment (`30832528012`, job `91749723106`) proved the accepted Ethereum/Base-only application source and dependency-free Pages deployment path before the routing state drifted.

The v11 browser contract remains authoritative:

- application source `2c6e543dfcaa17ca975bbde3c15302269bbf8072`;
- selector values exactly Ethereum and Base;
- Base is the sole static default;
- authenticated `/api/v1/chains` synchronization remains present;
- custom-domain served content is the final binding proof.

## Goal

Re-establish the intended Pages browser deployment and move only `preflight.curveyield.online` from its stale Worker custom-domain binding to the verified Pages project, without modifying or deleting the Worker script itself.

## Exact binding

- repository: `CurveYield/contract-automation`
- release branch: `orchestrator/round4-ci-base-v1`
- required previous release SHA: `4867e5ee29b36acd4f32c74ee1f6eb8fe8ada6e6`
- accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- v11 run/job: `30832528012` / `91749723106`
- v4 routing-identity run: `31184375729`
- Pages project: `curveyield-preflight`
- production custom domain: `preflight.curveyield.online`

## Stage 1 — fail-closed source and routing preflight

Before any mutation:

1. verify the exact one-time v5 request and release-parent SHA;
2. prove `apps/web/public` is byte-identical to the accepted application source;
3. validate the accepted Ethereum/Base-only browser contract;
4. build the same nine-file immutable Pages manifest used by v11 with repository-owned Python tooling only;
5. GET the Pages project list without pagination query parameters and require API success;
6. require the expected Pages project to be absent from the returned page and independently require its exact detail GET to return `404`;
7. GET Worker custom domains filtered by the target hostname and require exactly one exact match;
8. retain that match's domain ID, Worker service name, zone ID, and zone name only in runner-local transient storage so the original binding can be restored if the cutover fails.

No mutation is allowed if any preflight condition fails.

## Stage 2 — stage a new Pages project and production deployment

Create only the expected Pages project with:

- `name: curveyield-preflight`;
- `production_branch: orchestrator/round4-ci-base-v1`.

Then independently GET the project and require the exact name, production branch, and a valid `.pages.dev` subdomain.

Reuse the v11 dependency-free direct Pages API procedure:

1. GET a Pages upload token;
2. call the Pages asset `check-missing` endpoint with the immutable manifest hashes;
3. require missing asset count to be zero and fail closed if any asset upload would be necessary;
4. create one production deployment with the immutable manifest and accepted application commit;
5. poll the exact deployment until it reports environment `production`, exact release branch, exact application commit, and terminal `deploy/success`;
6. fetch the immutable deployment URL and require its HTML/JavaScript to satisfy the accepted Ethereum/Base-only browser contract before changing production routing.

No project compilation, dependency installation, Wrangler, asset upload, API job submission, blockchain RPC, or wallet action is permitted.

## Stage 3 — narrow routing cutover

Only after Stage 2 is fully green:

1. re-GET the Worker-domain hostname and require the same single binding still exists;
2. detach that one Worker custom domain by its immutable domain ID;
3. poll the Worker-domain list until no binding exists for `preflight.curveyield.online`;
4. add `preflight.curveyield.online` to `curveyield-preflight` with the Pages Add Domain API;
5. poll the exact Pages domain until status is `active`;
6. fetch cache-busted production HTML and JavaScript until they satisfy the accepted browser contract;
7. require the Pages project domain list to contain the target domain and require the Worker-domain list to contain zero matches.

The Worker script is never updated or deleted.

## Rollback contract

The original Worker binding data is captured before mutation. If the Worker domain was detached but Pages domain creation, activation, or final content acceptance fails, v5 must attempt to restore the prior routing state:

1. if a Pages domain was created, delete only that Pages domain and verify it no longer reports active association;
2. PUT the original hostname back onto the exact original Worker service using the retained zone identity;
3. GET Worker custom domains filtered by the hostname and require exactly one match to the original service;
4. report rollback status explicitly.

The newly staged Pages project/deployment is intentionally retained after a routing rollback because it is a verified recovery target and deleting it would add unrelated destructive mutation.

If rollback itself fails, the issue receipt must explicitly classify a hard routing-recovery blocker for account-owner intervention.

## Allowed Cloudflare mutations

Only the following mutations are allowed in v5:

- `POST /accounts/{account_id}/pages/projects` — create the exact Pages project;
- `POST /pages/assets/check-missing` — non-upload asset-cache check used by the proven v11 procedure;
- `POST /accounts/{account_id}/pages/projects/{project_name}/deployments` — create the exact manifest-bound deployment;
- `DELETE /accounts/{account_id}/workers/domains/{domain_id}` — detach the single stale Worker custom domain;
- `POST /accounts/{account_id}/pages/projects/{project_name}/domains` — attach the production hostname to Pages;
- rollback only: `DELETE /accounts/{account_id}/pages/projects/{project_name}/domains/{domain_name}` and `PUT /accounts/{account_id}/workers/domains`.

No other Cloudflare mutation is permitted.

## Safety

- no dependency installation or download;
- no package-manager or Wrangler invocation;
- no repository compilation/build;
- no asset upload/hash-upsert;
- no Worker script deploy/update/delete;
- no R2 or secret mutation;
- no API job/upload submission;
- no blockchain RPC call, wallet operation, signing, or transaction broadcast;
- no rerun of v11, v2, v3, v4, or any failed/historical workflow;
- Cloudflare bodies, Worker service identity, zone identifiers, domain IDs, upload tokens, and service URLs remain transient and are deleted under `always()`.

## Acceptance

V5 is successful only when the production custom domain itself serves the exact accepted Ethereum/Base-only browser contract and the hostname is no longer present in the Worker custom-domain list. Any failure is preserved as evidence and corrected only with a fresh whole-number version.
