# Round 5 Pages Production-Target Deployment V5 Design

## Problem

Deployment v4 built the corrected Ethereum/Base-only web assets from source `2c6e543dfcaa17ca975bbde3c15302269bbf8072`, but invoked `wrangler pages deploy` with `--branch=orchestrator/round4-ci-base-v1`. Cloudflare created a branch preview deployment while `preflight.curveyield.online` continued serving the prior production deployment. Current-source smoke run `30813209037` therefore failed only at the live UI selector check with `unexpected chain option scope`.

## Selected approach

Create a one-time, exact-parent deployment v5 from release head `b31c79a2b48b3d1390e050489e2b9307f1fb75af`. Reuse the already accepted web source without changing application code. Build and deploy only Pages, omit `--branch`, and verify the production custom domain returns the exact expected HTML and client synchronization contract before reporting success.

## Scope

The deployment may:

- read Cloudflare Pages project metadata;
- run repository tests, syntax checks, and the static Pages build in trusted GitHub Actions;
- deploy `dist/web` to the Pages production target;
- issue bounded GET requests to `https://preflight.curveyield.online/` and `/app.js`;
- post sanitized evidence to issue #125.

It must not:

- redeploy the API Worker;
- upload or alter Worker secrets;
- mutate R2;
- submit jobs or uploads;
- sign or broadcast transactions;
- rerun deployment v4 or failed smoke run `30813209037`;
- test deferred networks.

## Production binding

The workflow must query the Pages project and require a non-empty production branch. It must deploy without a preview `--branch` argument. After deployment, bounded retries must verify:

1. the live selector contains exactly `ethereum` then `base`;
2. Base is the sole selected option;
3. deferred networks are absent from the selector;
4. live `app.js` contains `syncChainOptions(response.chains)`, `Object.entries(chains)`, `elements.chain.replaceChildren`, and the Base preference;
5. no cache-busting value or response content is logged beyond generic success/failure labels.

## Evidence and continuation

A guaranteed `always()` report records the workflow run, exact source SHA, production-target truth, UI verification result, and all safety flags. A successful v5 deployment does not itself close production acceptance; it enables a fresh exact-parent read-only acceptance v3. Historical v2 failure remains immutable evidence and is never rerun.
