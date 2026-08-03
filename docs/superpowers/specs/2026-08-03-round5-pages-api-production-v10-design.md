# Round 5 Pages API Production Deployment v10 — Design

## Problem

PR #159 merged the dependency-free Pages API production gate at release SHA `11036211d5448e0bd32bb4c4fdd85bf638caa53d`, but GitHub created no workflow run or job. The workflow referenced `${{ runner.temp }}` in `jobs.deploy-pages.env`, where the `runner` context is unavailable because no runner has been assigned yet.

No Cloudflare request or production mutation occurred under v9.

## Decision

Create a fresh exact-parent v10 request. Preserve the accepted direct Pages API behavior and change only transient-directory initialization:

1. remove every pre-run `${{ runner.* }}` expression;
2. enter the first trusted shell step;
3. set `V10_TEMP_DIR="$RUNNER_TEMP/pages-v10"`;
4. persist it through `$GITHUB_ENV` for later steps;
5. create the directory before writing any transient file.

## Exact binding

- Release branch: `orchestrator/round4-ci-base-v1`
- Required previous release SHA: `11036211d5448e0bd32bb4c4fdd85bf638caa53d`
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- One-time request: `.agent-control/v1/orchestrator/DEPLOY_REQUEST_v10.json`
- Active networks: Ethereum and Base only

## Preserved deployment contract

The workflow must continue to:

- download no dependency and invoke no package manager or Wrangler;
- prove `apps/web/public` is byte-identical to the accepted application source;
- run the repository-owned BLAKE3 self-test before manifest generation;
- require all nine expected asset hashes already exist;
- fail closed without calling asset upload or hash-upsert endpoints;
- omit the Pages deployment `branch` form field;
- require Cloudflare to return a production deployment bound to the exact release branch and accepted application commit;
- require terminal success and custom-domain alias binding;
- verify the production domain exposes exactly Ethereum and Base, Base as sole default, no deferred network, and authenticated chain synchronization code;
- post a sanitized result to issue #125 under `always()`.

## Safety

The v10 live gate performs no repository compilation, dependency installation, asset upload, API Worker deployment, secret mutation, R2 mutation, API job/upload submission, blockchain RPC call, wallet operation, signing, deferred-network test, or public-chain broadcast.

A v10 failure must be preserved. It must never be manually rerun; any correction requires a fresh versioned exact-parent request.
