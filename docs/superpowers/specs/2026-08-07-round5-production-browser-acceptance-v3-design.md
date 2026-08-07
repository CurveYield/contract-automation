# Round 5 Production Browser Acceptance v3 — Design

## Purpose

Routing repair v13 made `preflight.curveyield.online` an active Cloudflare Pages custom domain for the accepted application source and removed the last browser-routing blocker. Production browser acceptance v3 is a fresh, read-only acceptance gate that proves the resulting browser deployment is internally consistent end to end without rerunning the historical v2 acceptance.

## Bound state

- accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- v13 routing run: `31202904539`
- Pages project: `curveyield-preflight`
- Pages hostname: `preflight.curveyield.online`
- API hostname: `api.preflight.curveyield.online`
- active networks: Ethereum and Base only
- default network: Base only

The request is written only after the workflow is preinstalled. `expectedBeforeSha` must equal the request push's `github.event.before` value.

## Required browser-deployment checks

1. Cloudflare Pages ownership: the canonical Pages deployment remains bound to the accepted application source, the exact Pages custom domain is `active`, and zero Worker custom-domain entries own the Pages hostname.
2. Browser asset delivery: `/` and `/app.js` return successfully; the selector exposes exactly Ethereum then Base, Base is the sole default, deferred networks are absent, and client chain synchronization logic is present.
3. API liveness and safe setup surface: health reports the expected service/version and setup reports the expected feature readiness without secret values.
4. Authentication boundary: an unauthenticated chains request is rejected with the expected bounded error.
5. Browser CORS: an OPTIONS preflight from the Pages origin for an authenticated GET is accepted, returns the exact Pages origin, permits GET, and permits the Authorization request header.
6. Authenticated API scope: a browser-origin authenticated chains request returns exactly Ethereum chain ID 1 and Base chain ID 8453 and returns the exact Pages CORS origin.
7. Read-only network connectivity: configured Ethereum and Base RPCs return the exact chain IDs and a nonzero current head.

## Safety boundary

This acceptance is read-only. It performs no job or upload submission, no storage mutation, no GitHub dispatch, no Pages/Worker/DNS/project/deployment/asset mutation, no secret mutation, no wallet/signing capability, and no transaction broadcast. It installs or downloads no dependency and runs no repository build or compiler.

## Receipt

Issue #125 receives a sanitized `always()` receipt with only pass/fail status for each gate, run/source identifiers, active-network scope, and explicit mutation negatives. Secrets, RPC URLs, Cloudflare identifiers, service URLs, response bodies, and raw error messages are not published.
