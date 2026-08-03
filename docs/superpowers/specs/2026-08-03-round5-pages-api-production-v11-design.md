# Round 5 Pages API Production Deployment v11 — Design

## Problem

PR #160 promoted the valid v10 workflow at release SHA `23a6ec8d8cc89d3aaa5d6a19d843bc37544358b5`. Trusted run `30831520420`, job `91746369253`, successfully verified the exact request, accepted static source, immutable manifest, configured production branch, and that all nine asset hashes already existed. The direct Pages deployment response also passed the exact production environment, release branch, and application commit checks.

The workflow then failed because its bounded poll coupled terminal deployment-stage acceptance to an exact entry in the deployment object's optional `aliases` array. The production custom-domain content check was skipped.

Cloudflare Wrangler treats aliases as optional display metadata. Its deployment completion check requires `latest_stage.name == "deploy"` and `latest_stage.status == "success"`.

## Decision

Create a fresh exact-parent v11 request. Keep the dependency-free direct Pages API path unchanged, but separate two independent gates:

1. accept the created deployment only after the fetched deployment object reports the exact production environment, release branch, application commit, terminal stage name `deploy`, and terminal stage status `success`;
2. verify the production custom domain separately by fetching its HTML and JavaScript and checking the deployed Ethereum/Base-only application contract.

The optional deployment `aliases` array is not part of terminal-stage acceptance.

## Exact binding

- Release branch: `orchestrator/round4-ci-base-v1`
- Required previous release SHA: `23a6ec8d8cc89d3aaa5d6a19d843bc37544358b5`
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Superseded run: `30831520420`
- Superseded job: `91746369253`
- One-time request: `.agent-control/v1/orchestrator/DEPLOY_REQUEST_v11.json`
- Active networks: Ethereum and Base only

## Deployment-stage gate

After the direct deployment response passes its immediate environment, branch, and commit assertions, the workflow records the bounded deployment short ID before polling. The fetched deployment object must report:

- API success;
- `environment: production`;
- exact release-branch metadata;
- exact accepted application commit metadata;
- `latest_stage.name: deploy`;
- `latest_stage.status: success`.

No alias field is required or inspected.

## Custom-domain content gate

After terminal-stage acceptance, the workflow fetches cache-busted copies of the production-domain root and `app.js` with bounded retries. It requires:

- exactly Ethereum and Base selector values;
- Base as the sole static default;
- no deferred network in the selector;
- the authenticated `/api/v1/chains` synchronization code.

This served-content check is the authoritative custom-domain binding evidence.

## Preserved deployment contract

The workflow continues to:

- download no dependency and invoke no package manager or Wrangler;
- initialize transient storage from `$RUNNER_TEMP` only after a runner exists;
- prove `apps/web/public` is byte-identical to the accepted application source;
- run the repository-owned official-vector BLAKE3 self-test before manifest generation;
- require all nine expected asset hashes already exist;
- fail closed without calling asset-upload or hash-upsert endpoints;
- omit the Pages deployment `branch` form field;
- post a sanitized result to issue #125 under `always()`.

## Safety

The v11 live gate performs no repository compilation, dependency installation, asset upload, API Worker deployment, secret mutation, R2 mutation, API job/upload submission, blockchain RPC call, wallet operation, signing, deferred-network test, or public-chain broadcast.

A v11 failure must be preserved and never manually rerun. Any correction requires a fresh versioned exact-parent request.
