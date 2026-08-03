# Cloudflare R2 Capability Diagnostic Design

## Goal

Determine why trusted deployment run `30800918581` failed at R2 bucket provisioning without revealing Cloudflare secrets or mutating Cloudflare resources.

## Scope

The diagnostic performs one authenticated read-only request against Cloudflare's `GET /accounts/{account_id}/r2/buckets/{bucket_name}` endpoint for bucket `curveyield-preflight`. It records only HTTP status, Cloudflare success boolean, numeric error codes, and a derived bucket state (`present`, `absent`, or `unauthorized-or-unknown`). It never records response messages, headers, account IDs, token values, or response bodies.

## Trigger and Authority

A one-time request file is merged into `orchestrator/round4-ci-base-v1`. The diagnostic workflow:

- requires the GitHub `production` environment;
- is restricted to the exact release branch and request path;
- verifies the expected parent SHA and one-time request ID;
- receives only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`;
- has `contents: read` and `issues: write` repository permissions;
- has no workflow-dispatch, rerun, deployment, Worker, Pages, R2 write, wallet, signing, or transaction path.

## Result

The workflow posts sanitized diagnostic metadata to issue #125 and exits successfully after reporting, regardless of Cloudflare authorization outcome. The result determines whether the next step is an idempotency repair or an account-owner token-permission correction.
