# Round 5 Pages Routing Diagnostic v3 — HTTP-Status Isolation Design

## Evidence from v2

Production diagnostic run `31183446228` checked out exact source `2a2ef752b82fc9e4f16bd973bb065d000e768c22` and successfully verified the one-time request. The next step, `Read Pages project deployment and domain metadata`, exited with curl code 22 after one authenticated Cloudflare Pages GET returned HTTP 404. Because v2 used `curl --fail` for all four initial metadata reads, the workflow aborted before recording which endpoint returned 404 and before any content comparison ran.

No Cloudflare mutation, dependency installation, repository compilation, historical-run retry, job submission, RPC call, wallet action, signing, or transaction broadcast occurred in v2.

## Goal

Identify exactly which Pages routing metadata boundary returns 404, without treating an expected 404 domain-state result as an infrastructure failure, and continue to collect all other safe routing evidence that remains reachable.

## Exact binding

- Repository: `CurveYield/contract-automation`
- Release branch: `orchestrator/round4-ci-base-v1`
- Required previous release SHA: `2a2ef752b82fc9e4f16bd973bb065d000e768c22`
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Historical v11 run/job: `30832528012` / `91749723106`
- Historical v11 deployment short ID: `c3d3e149`
- Failed v2 run/job: `31183446228` / `92882075058`
- Pages project: `curveyield-preflight`
- Custom domain: `preflight.curveyield.online`
- Active browser networks: exactly Ethereum and Base; Base is the sole static default.

## Read-only metadata method

For each Cloudflare Pages endpoint below, use an authenticated GET that writes the response body only to runner-local transient storage and separately captures the HTTP status. Do **not** use curl fail-on-HTTP-status behavior for these metadata reads.

1. project GET;
2. production-filtered deployments GET;
3. Pages project domains-list GET;
4. exact custom-domain GET;
5. exact v11 deployment GET, only after a unique v11 deployment ID can be resolved from the production list.

Transport failure is distinct from an HTTP response. Public output may contain only bounded HTTP status strings such as `200`, `404`, or `transport-error`; API response bodies, Cloudflare account identifiers, validation data, and service URLs remain private.

## Metadata interpretation

- `200` plus Cloudflare `success: true` is required before parsing a response as successful.
- A domains-list `200` that omits `preflight.curveyield.online` proves the custom domain is not associated with the Pages project.
- An exact-domain `404` is diagnostic evidence and must not abort the workflow.
- A production-deployments `200` must resolve exactly one deployment whose short ID is `c3d3e149`; the bound deployment is independently checked for production environment, trusted release branch, accepted application commit, and terminal `deploy/success` stage.
- Project `production_branch` and project subdomain are parsed only from a successful project GET.

## Content interpretation

Continue public GET classification even if one metadata boundary is missing:

- custom-domain HTML/JavaScript is always attempted;
- project-subdomain content is attempted when project metadata yielded a valid `.pages.dev` host;
- immutable exact-v11 deployment content is attempted when the exact deployment can be resolved and yields a valid `.pages.dev` URL.

The accepted browser contract is unchanged from v2: selector options exactly `ethereum`, `base`; Base solely selected; no deferred network in the selector; JavaScript contains the accepted authenticated chain-option synchronization contract. Compare paired HTML/JavaScript SHA-256 values only in-run and publish booleans, never raw bodies or hashes.

## Bounded diagnosis precedence

1. `pages-project-get-failed`
2. `production-deployments-get-failed`
3. `pages-domains-list-get-failed`
4. `custom-domain-not-associated-with-pages-project`
5. `exact-custom-domain-get-failed`
6. `exact-v11-deployment-get-failed`
7. `exact-v11-deployment-metadata-mismatch`
8. `production-deployment-list-mismatch`
9. `pages-production-branch-mismatch`
10. `pages-domain-status-mismatch`
11. `immutable-deployment-content-mismatch`
12. `project-subdomain-routing-mismatch`
13. `custom-domain-routing-mismatch`
14. `no-current-routing-mismatch-detected`

A `404` exact-domain result plus an absent domains-list association should resolve to `custom-domain-not-associated-with-pages-project`, not to a generic transport/infrastructure diagnosis.

## Safety

- Cloudflare methods: GET only.
- No Pages deployment, retry, rollback, domain add/edit/delete, Worker mutation, secret mutation, or R2 mutation.
- No package-manager invocation or dependency installation/download.
- No repository compilation/build.
- No API job/upload submission.
- No blockchain RPC, wallet operation, signing, or transaction broadcast.
- No rerun of v2, v11, or any failed/historical workflow.
- Transient Cloudflare response bodies are deleted under `always()`.

## Next action after v3

If v3 proves the custom domain is not associated with the Pages project, create a fresh higher-version exact-parent repair that performs the single diagnosed Pages-domain association mutation, then verify domain status and production content with a fresh GET-only acceptance gate. If a different boundary is isolated, repair only that boundary under a fresh higher version.
