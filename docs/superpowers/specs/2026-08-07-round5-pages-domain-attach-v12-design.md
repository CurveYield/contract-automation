# Round 5 Pages Production-Domain Attach v12 — Preinstalled Trigger Design

## Why v12 exists

V9 proved the deployment/routing state is ready for a single Pages-domain attachment: canonical deployment `db5d91bc` is accepted, the Worker hostname binding is absent, the Pages hostname association was absent, and production was unreachable. V10 and v11 were promoted with their workflow definitions and one-time request files in the same release-ref promotion, but no durable issue #125 receipt was observed.

V12 removes that trigger ambiguity by using two release pushes:

1. first install the v12 workflow, design, and test **without** the request file;
2. after that workflow already exists on the release branch, create the v12 request in a second one-file push.

The second push is the only v12 execution trigger.

## Exact-parent contract

The workflow does not hard-code a circular parent SHA. Instead, the one-time request records `expectedBeforeSha`, and the running workflow must prove at runtime that:

- `github.event.before == request.expectedBeforeSha`;
- the current ref is exactly `orchestrator/round4-ci-base-v1`;
- the checked-out SHA equals `github.sha`.

The request is created only after the workflow-installation release SHA is known, so this remains exact-parent while allowing the workflow to preexist its trigger.

## Immutable deployment binding

- repository: `CurveYield/contract-automation`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- verified Pages deployment short ID: `db5d91bc`
- v9 state run: `31187717248`
- Pages project: `curveyield-preflight`
- hostname: `preflight.curveyield.online`
- active networks: exactly Ethereum and Base
- static default: Base only

Before mutation, the Pages project canonical deployment and exact deployment GET must prove production environment, trusted release branch, accepted source commit, and terminal `deploy/success`. The immutable deployment must still serve the accepted browser contract.

## Idempotent routing state

V12 shares concurrency group `curveyield-preflight-pages-domain-attach-v10` with v10/v11 and uses `cancel-in-progress: false`.

After acquiring the lock:

- Worker hostname count must be exactly zero.
- Pages hostname count may be zero or one only.
- If Pages count is zero, POST exactly `{ "name": "preflight.curveyield.online" }` once.
- If Pages count is one, do not POST; verify the existing association.
- Any other state fails closed without mutation.

Semantic success is established by post-operation state, not the POST response body: the exact Pages domain must become `active`, production `/` and `/app.js` must serve the accepted two-network browser, and the final Worker hostname count must remain zero.

## Mutation boundary

Allowed only when needed:

- `POST /accounts/{account_id}/pages/projects/curveyield-preflight/domains` for exactly `preflight.curveyield.online`.

Forbidden:

- Worker-domain or Worker-script mutation;
- Pages project, deployment, or asset mutation;
- dependency installation/download, package manager, Wrangler, compile, or build;
- R2/secret/job/upload/RPC/wallet/signing/public-chain mutation;
- failed or historical workflow rerun;
- publication of secrets, account/domain identifiers, response bodies, raw service URLs, or credential material.

## Acceptance

V12 is complete only when issue #125 records all of the following from the second request-only push: exact-parent request verification, canonical/exact deployment verification, Pages domain active, production browser accepted with two options, final Pages domain active, final Worker hostname count zero, and final routing acceptance `success`.
