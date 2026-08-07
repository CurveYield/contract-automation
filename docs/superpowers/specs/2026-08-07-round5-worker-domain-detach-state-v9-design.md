# Round 5 Worker-Domain Detach State v9 — Canonical Deployment Design

## Goal

Replace the v8 deployment-list read that returned HTTP 400 with the Pages project's canonical-deployment metadata, then freeze the current Pages/Worker ownership and browser-content state using GET only.

## Exact binding

- release parent: `f14bddb27107c3f4295d6932e9c3432bf389fa7d`
- accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- v7 deployment short ID: `db5d91bc`
- v8 run/job: `31187427226` / `92895412422`
- Pages project: `curveyield-preflight`
- hostname: `preflight.curveyield.online`

## Checks

1. Pages project GET succeeds and `production_branch` equals `orchestrator/round4-ci-base-v1`.
2. `canonical_deployment` is production, has short ID `db5d91bc`, branch `orchestrator/round4-ci-base-v1`, commit `2c6e543dfcaa17ca975bbde3c15302269bbf8072`, and terminal `deploy/success`.
3. Exact canonical deployment GET reproduces that binding and its immutable `.pages.dev` URL still serves the accepted Ethereum/Base-only browser.
4. Pages domain list reports target-domain count and active count.
5. Worker custom-domain list filtered by hostname reports exact target count.
6. Production hostname is classified by selector option count and accepted/stale/unreachable state.

## Diagnosis

- Worker `1`, Pages target `0`, immutable accepted, production stale => `worker-domain-detach-remains-only-routing-blocker`.
- Worker `0`, Pages target `0` => `worker-domain-detached-pages-domain-not-attached`.
- Worker `0`, Pages active `1`, production accepted => `routing-already-complete`.
- Worker `1` and Pages target nonzero => `conflicting-worker-and-pages-domain-state`.
- Any canonical Pages mismatch => `pages-canonical-deployment-discrepancy`.

## Safety

Cloudflare and public methods are GET only. No dependency installation/download, package manager, Wrangler, compile/build, Pages/Worker/R2/secret mutation, asset upload, deployment creation, job/upload submission, RPC, wallet, signing, transaction broadcast, or historical workflow rerun.
