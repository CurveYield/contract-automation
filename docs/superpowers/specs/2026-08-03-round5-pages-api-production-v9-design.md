# Round 5 Pages API Production Deployment v9 — Design

## Problem

Pages deployment attempts v5, v6, and v7 all created immutable hash deployments while the custom production domain continued serving the stale seven-network UI. v6 and v7 also downloaded Wrangler at runtime despite the account-owner prohibition on dependency downloads.

The v7 full-history experiment falsified the missing-commit-object hypothesis: the exact application commit object existed, the deployment command succeeded, and the custom domain still remained stale.

## Decision

Stop using Wrangler for this correction. Use the Cloudflare Pages REST API directly with the nine static assets already stored by prior successful uploads.

## Trust boundary

The workflow is a one-time push gate on `orchestrator/round4-ci-base-v1` and requires exact `github.event.before` parent `70719851d8e18faf89e65027858b9f4f728d979d`.

The accepted application source remains `2c6e543dfcaa17ca975bbde3c15302269bbf8072`. The workflow must prove `apps/web/public` is byte-identical to that source with `git diff --quiet` before constructing a manifest.

## Asset manifest

A repository-owned Python script implements the unkeyed BLAKE3 algorithm without third-party imports. It validates itself against the official empty-string and `abc` vectors before hashing any asset.

For each regular file under `apps/web/public`, the Cloudflare Pages asset hash is:

1. base64-encode the exact file bytes;
2. append the extension without the leading period;
3. BLAKE3-hash the resulting UTF-8 bytes;
4. use the first 32 hexadecimal characters.

The script emits:

- a Pages manifest mapping `/<relative-path>` to the Pages asset hash;
- a hash list for the missing-asset check;
- a sanitized metadata record containing relative paths, sizes, SHA-256 digests, and Pages hashes.

No file contents are printed.

## Fail-closed no-upload rule

The workflow obtains a project upload token, sends all manifest hashes to `/pages/assets/check-missing`, and requires an empty result. If any hash is missing, the job fails and performs no upload. The workflow must not call `/pages/assets/upload` or `/pages/assets/upsert-hashes`.

## Deployment request

The workflow posts multipart form data directly to the Pages deployment endpoint with:

- `manifest`;
- explicit `commit_hash` equal to the accepted application source;
- an explicit bounded `commit_message`;
- `commit_dirty=false`.

The `branch` field is intentionally omitted so the Pages API applies the project's configured production branch.

## Acceptance of the API response

The deployment response must report all of the following before the custom domain is queried:

- API success;
- a deployment ID and URL;
- `environment: production`;
- trigger metadata branch exactly `orchestrator/round4-ci-base-v1`;
- trigger metadata commit hash exactly `2c6e543dfcaa17ca975bbde3c15302269bbf8072`;
- latest deployment stage status `success`;
- production/custom-domain alias binding for `preflight.curveyield.online`.

The workflow then fetches the deployment by ID and re-verifies the same immutable binding.

## Custom-domain verification

With bounded retries and cache-busting query parameters, fetch `index.html` and `app.js` from `preflight.curveyield.online` and require:

- exactly Ethereum and Base selector values;
- Base as the sole default;
- no deferred network selectable;
- the client synchronization contract from authenticated `/api/v1/chains`.

## Safety

The v9 gate performs no:

- dependency installation or package-manager execution;
- repository compilation, tests, lint, or build in the trusted live workflow;
- asset upload;
- API Worker deployment;
- secret, R2, or GitHub configuration mutation;
- API job or user upload submission;
- RPC call;
- wallet operation, signing, or public-chain broadcast;
- deferred-network test;
- rerun of a historical or failed workflow.

The issue #125 report is sanitized and runs under `always()`.
