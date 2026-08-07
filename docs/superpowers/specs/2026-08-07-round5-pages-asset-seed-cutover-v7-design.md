# Round 5 Pages Asset Seed + Worker-Domain Cutover v7 — Design

## Proven state entering v7

V6 run `31185640760` established all prerequisites for a bounded repair:

- replacement Pages project `curveyield-preflight` is present and correctly bound to the trusted release branch;
- project upload-token GET succeeds and returns a valid JWT;
- `/pages/assets/check-missing` succeeds;
- all nine hashes in the accepted static manifest are missing;
- every missing hash belongs to the accepted application manifest;
- `preflight.curveyield.online` still has exactly one Worker custom-domain binding;
- production still serves the stale seven-network operator.

Current Cloudflare Wrangler Pages source defines the direct asset bootstrap contract as:

1. obtain the project upload JWT;
2. POST all hashes to `/pages/assets/check-missing`;
3. POST only missing files to `/pages/assets/upload` as JSON objects containing `key` (Pages hash), base64 `value`, `metadata.contentType`, and `base64: true`;
4. POST the complete hash list to `/pages/assets/upsert-hashes`;
5. proceed with the manifest-bound Pages deployment.

## Goal

Seed only the nine already-accepted static files into the recreated Pages project, prove the immutable Pages deployment serves the accepted Ethereum/Base-only browser, then move only the production hostname from the stale Worker custom-domain binding to Pages. Preserve rollback to the original Worker binding if routing activation or final production-content acceptance fails.

## Exact binding

- repository: `CurveYield/contract-automation`
- release branch: `orchestrator/round4-ci-base-v1`
- required previous release SHA: `3116c65a450cb41cc74cd0cfc4d8bc892858204d`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- v6 run: `31185640760`
- Pages project: `curveyield-preflight`
- production hostname: `preflight.curveyield.online`
- active networks: exactly Ethereum and Base
- static default: Base only

## Stage 1 — exact-source and routing preflight

Before mutation:

1. verify request, release parent, repository/ref, Cloudflare credential presence, and accepted source commit;
2. prove `apps/web/public` is byte-identical to accepted source;
3. regenerate the same nine-file immutable manifest/hashes/metadata using repository-owned Python only;
4. verify the static selector and authenticated chain synchronization contract;
5. GET Pages project and require exact production branch;
6. GET Worker custom domains by hostname and require exactly one binding; capture its domain ID, service, zone ID, and zone name only in transient runner state for rollback;
7. GET Pages project domains and require the production hostname is not already attached.

## Stage 2 — seed only accepted missing assets

Obtain a fresh project upload JWT. POST the complete accepted hash list to `/pages/assets/check-missing` and require exactly nine missing hashes, all members of the accepted hash list.

Build one JSON upload payload with Python standard library only. For each metadata entry whose `pagesHash` is missing:

- `key`: exact `pagesHash`;
- `value`: base64 of the exact repository file bytes;
- `metadata.contentType`: `mimetypes.guess_type(path)[0]` or `application/octet-stream`;
- `base64`: `true`.

Require payload length exactly nine and re-verify each file SHA-256 against immutable metadata immediately before constructing the payload. POST that payload to `/pages/assets/upload` using the upload JWT. Then POST the complete accepted hash list to `/pages/assets/upsert-hashes`.

Obtain a fresh upload JWT and repeat `/pages/assets/check-missing`; require missing count exactly zero before deployment.

No other files, generated build products, Worker code, secrets, or runtime data may be uploaded.

## Stage 3 — create and verify the production Pages deployment

Create one direct Pages deployment with:

- the exact nine-file immutable manifest;
- commit hash `2c6e543dfcaa17ca975bbde3c15302269bbf8072`;
- trusted release branch inherited as the project's production branch;
- no repository compilation or package-manager execution.

Poll the exact deployment until all are true:

- environment `production`;
- deployment trigger branch equals the trusted release branch;
- deployment trigger commit hash equals accepted source;
- latest stage name/status is `deploy` / `success`.

Then cache-bust GET the immutable deployment `/` and `/app.js` and require selector values exactly `ethereum`, `base`, Base solely selected, no deferred network in the selector, and accepted authenticated chain synchronization JavaScript.

The production hostname remains on the Worker during all asset/deployment work.

## Stage 4 — narrow hostname cutover

Only after immutable Pages content passes:

1. re-read the Worker hostname binding and require it still exactly matches the captured original binding;
2. DELETE only that Worker custom-domain binding by domain ID;
3. verify Worker hostname match count becomes zero;
4. POST the exact hostname to the Pages project domain endpoint;
5. poll exact Pages domain until status `active`;
6. cache-bust GET production `/` and `/app.js` until the accepted browser contract is served;
7. final ownership check: Pages exact domain active and Worker hostname match count zero.

The Worker script/service itself is never updated or deleted.

## Rollback

If Worker-domain detach succeeds but Pages-domain creation, activation, final content acceptance, or final ownership verification fails:

1. if a Pages domain association was created, delete only that Pages domain association;
2. PUT the exact original hostname/service/zone identity back to the Worker custom-domain endpoint;
3. poll until exactly one Worker hostname match exists and its service equals the captured original service;
4. publish rollback success/failure.

The verified Pages project, accepted asset set, and immutable deployment are retained as recovery material even if routing rolls back.

If rollback fails, classify a hard routing-recovery blocker requiring account-owner intervention.

## Allowed mutations

Only:

- `POST /pages/assets/upload` for the nine accepted missing hashes;
- `POST /pages/assets/upsert-hashes` for the accepted hash list;
- `POST /accounts/{account_id}/pages/projects/{project_name}/deployments` for one accepted manifest deployment;
- `DELETE /accounts/{account_id}/workers/domains/{domain_id}` for the exact stale hostname;
- `POST /accounts/{account_id}/pages/projects/{project_name}/domains` for the exact production hostname;
- rollback only: delete that Pages-domain association and PUT the original Worker-domain binding.

## Prohibited

- dependency installation/download, package manager, Wrangler, compilation, or build;
- Pages project create/update/delete;
- uploading any unaccepted asset or build product;
- Worker script deploy/update/delete;
- R2 or secret mutation;
- API job/upload submission;
- blockchain RPC call, wallet action, signing, or transaction broadcast;
- rerun of v5/v6 or any failed/historical workflow;
- publication of upload JWTs, raw hashes, account IDs, Worker service/zone/domain IDs, response bodies, or service URLs.

## Acceptance

V7 succeeds only if production itself serves the accepted Ethereum/Base-only browser and the hostname is active on Pages with zero Worker custom-domain matches. Otherwise the workflow must either prove the hostname was never touched or prove rollback restored the original Worker routing.
