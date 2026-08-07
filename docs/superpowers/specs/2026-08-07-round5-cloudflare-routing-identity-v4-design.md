# Round 5 Cloudflare Routing Identity Diagnostic v4 — Design

## Evidence entering v4

GET-only diagnostic v3 (`31183971849`) succeeded and established:

- expected Pages project detail GET: HTTP `404`;
- expected project production deployments GET: HTTP `400`;
- expected project domains-list GET: HTTP `404`;
- exact custom-domain GET under that project: HTTP `404`;
- the live custom domain remains reachable but serves a stale seven-network browser operator.

The v11 deployment (`30832528012`, job `91749723106`, short deployment ID `c3d3e149`) had previously proven a terminal production Pages deployment for accepted browser source `2c6e543dfcaa17ca975bbde3c15302269bbf8072`. Therefore v4 must identify current routing ownership before any recreation, reassociation, deletion, or deployment.

## Goal

Using only Cloudflare GET requests, determine whether:

1. `curveyield-preflight` still exists anywhere in the configured Cloudflare account;
2. `preflight.curveyield.online` is attached to another Pages project in that account;
3. `preflight.curveyield.online` is registered as a Worker custom domain in that account;
4. a discovered Pages-hosted origin serves the same stale content as the production custom domain.

## Exact binding

- repository: `CurveYield/contract-automation`
- release branch: `orchestrator/round4-ci-base-v1`
- required previous release SHA: `bf879a18381a5b2a3e2d240d27e498e79b992d22`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- v11 run/job: `30832528012` / `91749723106`
- v3 run: `31183971849`
- expected Pages project: `curveyield-preflight`
- custom domain: `preflight.curveyield.online`

## Account-wide Pages inventory

Call `GET /accounts/{account_id}/pages/projects?per_page=50` and capture HTTP status independently. On a successful response:

- publish only total bounded project count;
- publish whether exactly one project is named `curveyield-preflight`;
- for every returned project whose name matches a strict Pages-safe project-name pattern, call its Pages domains-list GET and inspect the response only in runner-local transient storage;
- publish only whether the target custom domain is attached to any Pages project, whether that project is the expected project, and whether it is an alternate project;
- retain the associated project's `.pages.dev` subdomain only in runner-local/GitHub environment state for content comparison; never publish project names other than the already-public expected name.

No project, deployment, or domain mutation is permitted.

## Worker custom-domain inventory

Call `GET /accounts/{account_id}/workers/domains?hostname=preflight.curveyield.online` and capture HTTP status independently. If authorized and successful, publish only the number of exact hostname matches and a boolean indicating whether a Worker custom-domain binding exists. Do not publish script/service names, domain IDs, certificate IDs, account IDs, or response bodies.

A `403` is diagnostic evidence of insufficient Worker-read permission, not permission to mutate or broaden credentials.

## Content correlation

Always GET the custom-domain `/` and `/app.js` with bounded timeout and no-cache headers. If an account-wide Pages association yields a valid `.pages.dev` subdomain, GET the same assets there. Classify each target against the accepted browser contract:

- selector options exactly `ethereum`, `base`;
- Base solely selected;
- no deferred network in the selector;
- accepted authenticated chain-synchronization JavaScript contract present.

Also compare paired HTML/JavaScript SHA-256 values in-run. Publish only classification (`accepted`, `stale-or-unexpected`, `unreachable`), option count, and digest-match boolean.

## Diagnosis precedence

1. `pages-project-list-get-failed`
2. `expected-pages-project-present-detail-get-inconsistent`
3. `custom-domain-bound-to-alternate-pages-project`
4. `custom-domain-bound-to-worker`
5. `expected-pages-project-missing-routing-origin-unresolved`
6. `expected-pages-project-present-no-target-domain-association`
7. `expected-pages-project-present-target-domain-associated`

If Worker-domain inventory is unauthorized and no Pages association exists, diagnosis must remain `expected-pages-project-missing-routing-origin-unresolved`; v4 must not infer that no Worker binding exists.

## Safety

- Cloudflare API methods are GET only.
- No dependency installation/download or package-manager invocation.
- No repository compilation/build.
- No Pages create/update/delete/deploy/retry/rollback/domain mutation.
- No Worker deploy/update/delete/domain mutation.
- No R2 or secret mutation.
- No API job/upload submission.
- No blockchain RPC call, wallet operation, signing, or transaction broadcast.
- No rerun of v11, v2, v3, or any other historical workflow.
- All Cloudflare bodies and discovered service identifiers are transient and deleted under `always()`.

## Next action

A repair is allowed only after this diagnostic identifies routing ownership. The repair must use a fresh whole-number version, exact-parent guard, the smallest necessary mutation, and a fresh GET-only acceptance gate afterward.
