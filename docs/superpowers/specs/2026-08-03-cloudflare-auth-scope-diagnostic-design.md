# Cloudflare Authentication and Account-Scope Diagnostic Design

## Goal

Resolve whether Cloudflare R2 HTTP `403` / error code `10000` is caused by an invalid token, an incorrect or inaccessible account ID, or missing account-level R2 permission.

## Read-only probes

The workflow performs exactly three authenticated GET requests:

1. `GET /user/tokens/verify` — determines whether the configured API token is active.
2. `GET /accounts/{account_id}` — determines whether the configured token can address the configured account.
3. `GET /accounts/{account_id}/r2/buckets/curveyield-preflight` — confirms R2 bucket-endpoint authorization.

## Sanitized output

For each probe, the workflow records only HTTP status, Cloudflare success boolean, and numeric error codes. For token verification it may also record the enum status `active`, `disabled`, `expired`, or `unknown`. It does not record token IDs, account IDs, names, messages, headers, or response bodies.

The derived diagnosis is one of:

- `token-invalid-disabled-or-expired`
- `account-id-or-token-account-scope-invalid`
- `missing-workers-r2-storage-permission`
- `r2-authorized-bucket-present`
- `r2-authorized-bucket-absent`
- `indeterminate`

## Trigger and authority

A one-time request is merged into `orchestrator/round4-ci-base-v1`, exact-parent bound to `8734852cbf6a08d6cfa65d611035e98a30494f50`. The workflow requires the `production` environment and receives only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. It has repository permissions `contents: read` and `issues: write` and cannot dispatch, rerun, deploy, write Cloudflare resources, read wallets, sign, or broadcast transactions.
