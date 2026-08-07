# Round 5 Pages Routing Diagnostic v2 — Design

## Problem

Cloudflare accepted the v11 Pages deployment created by trusted run `30832528012`, job `91749723106`. The deployment was classified as production, bound to release branch `orchestrator/round4-ci-base-v1`, bound to accepted application source `2c6e543dfcaa17ca975bbde3c15302269bbf8072`, and reached terminal stage `deploy` / `success`. The created deployment short ID was `c3d3e149`.

Despite that successful deployment state, twelve bounded cache-busted reads of `preflight.curveyield.online` continued to expose the stale seven-network operator rather than the accepted Ethereum/Base-only application. The v11 run is historical evidence and must never be rerun.

The older draft diagnostic in PR #154 predates v11 and only compares a selected successful release-branch deployment with the custom domain. It does not bind the exact v11 deployment, inspect the production-only deployment list, inspect Pages domain association/status, or distinguish the project `pages.dev` subdomain from the immutable deployment URL.

## Decision

Create a fresh exact-parent v2 diagnostic that performs only authenticated Cloudflare Pages GET requests plus unauthenticated public asset GETs. It will compare five independent facts:

1. the Pages project reports the trusted release branch as `production_branch` and exposes a bounded project subdomain;
2. the production-only deployment list contains the exact successful v11 deployment bound to the accepted application source and trusted release branch;
3. the exact v11 deployment fetched by deployment ID reports `environment: production`, exact branch/commit metadata, terminal `deploy` / `success`, and a valid immutable `pages.dev` URL;
4. Pages domain metadata lists `preflight.curveyield.online`, and the exact domain record reports an active association rather than pending/error/deactivated/blocked state;
5. served `index.html` and `app.js` at the immutable deployment URL, project subdomain, and custom domain are classified against the accepted Ethereum/Base-only browser contract and compared by SHA-256 without publishing response bodies or service URLs.

Cloudflare's current Pages API documents GET endpoints for project metadata, production-filtered deployment lists, exact deployment information, domain lists, and exact domain information. This diagnostic uses only those read paths and no mutation endpoint.

## Exact binding

- Repository: `CurveYield/contract-automation`
- Release branch: `orchestrator/round4-ci-base-v1`
- Required previous release SHA: `1f81be09b16614b24d81c57fa388447231dd629a`
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Historical v11 run: `30832528012`
- Historical v11 job: `91749723106`
- Expected v11 deployment short ID: `c3d3e149`
- Pages project: repository variable `PAGES_PROJECT_NAME`, required value `curveyield-preflight`
- Production custom domain: `preflight.curveyield.online`
- Active browser networks: exactly `ethereum`, `base`
- Static default: exactly `base`

## Metadata gate

The workflow performs authenticated GET requests to:

- `/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT_NAME`
- `/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT_NAME/deployments?env=production&per_page=50`
- `/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT_NAME/deployments/{deployment_id}`
- `/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT_NAME/domains`
- `/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT_NAME/domains/preflight.curveyield.online`

The production deployment list is searched for exactly one candidate whose deployment ID begins with `c3d3e149`, `environment` is `production`, branch metadata equals the trusted release branch, commit metadata equals the accepted application source, and terminal stage is `deploy` / `success`. The full deployment ID is kept only in runner-local transient state and is not published.

The exact deployment GET must independently reproduce those bindings. Its `url` must be HTTPS and under `.pages.dev`.

The project metadata must report the exact production branch and a project subdomain under `.pages.dev`. Domain metadata must show the exact custom-domain name associated with the project; the exact domain record's status must be `active` to satisfy the routing-configuration gate. No Cloudflare account identifier, domain identifier, validation payload, certificate detail, or response body is published.

## Served-content gate

For each of the following targets, fetch `/` and `/app.js` with bounded timeouts; also perform cache-busted reads for the project subdomain and custom domain:

- immutable exact-v11 deployment URL returned by Cloudflare;
- project subdomain returned by Cloudflare;
- `https://preflight.curveyield.online`.

Classify content using the accepted application contract:

- HTML contains `<select id="chain">` with option values exactly `ethereum`, then `base`;
- only `base` is statically selected;
- no deferred network is present in the selector;
- JavaScript contains the authenticated `/api/v1/chains` synchronization behavior used by the accepted application.

For each target publish only a bounded classification (`accepted`, `stale-or-unexpected`, `unreachable`) and booleans/counts. SHA-256 digests may be compared in-run but raw digests and fetched bodies are not required in the public receipt.

## Diagnosis precedence

Derive exactly one bounded diagnosis in this order:

1. `exact-v11-deployment-metadata-mismatch`
2. `production-deployment-list-mismatch`
3. `pages-production-branch-mismatch`
4. `pages-domain-association-or-status-mismatch`
5. `immutable-deployment-content-mismatch`
6. `project-subdomain-routing-mismatch`
7. `custom-domain-routing-mismatch`
8. `no-current-routing-mismatch-detected`

The project-subdomain diagnosis means the exact immutable deployment is correct but the project's canonical `pages.dev` subdomain is not serving equivalent accepted content. The custom-domain diagnosis means both Cloudflare deployment metadata and Pages-hosted content are correct while the custom domain is not serving equivalent accepted content.

## Safety

- No dependency installation or download.
- No package-manager or Wrangler invocation.
- No repository compilation, build, or contract execution.
- Cloudflare API methods are GET only.
- No Pages deployment, retry, rollback, domain add/edit/delete, Worker mutation, secret mutation, or R2 mutation.
- No API job/upload submission.
- No blockchain RPC call, wallet operation, signing, or public-chain broadcast.
- No secret, authorization header, account identifier, service URL, response body, validation payload, or raw RPC URL is published.
- The request is exact-parent and one-time; failed or historical workflow reruns are forbidden.

## Promotion contract

The v2 request/workflow may execute only from a merge push to the exact trusted release branch that changes the versioned request path and whose `github.event.before` equals `1f81be09b16614b24d81c57fa388447231dd629a` plus any deliberately promoted v2 documentation/test commits included in the branch history through the exact-parent promotion strategy. The final request itself must encode the release parent that immediately precedes its merge-triggering commit; no floating branch identity is accepted.

If the live result identifies a repository-fixable Cloudflare routing defect, any mutation requires a fresh higher-version exact-parent repair request and failing test. v2 itself never mutates production.
