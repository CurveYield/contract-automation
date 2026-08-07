# Round 5 Pages Asset Bootstrap Diagnostic v6 — Design

## Evidence entering v6

V5 run `31184973446` safely created and verified a replacement Cloudflare Pages project named `curveyield-preflight`, then failed in the asset/deployment stage before any production-hostname mutation. The stale Worker custom-domain binding for `preflight.curveyield.online` remained intact and no rollback was required.

The failure occurred before v5 could record the asset-cache gate. Current Cloudflare Wrangler Pages source shows that a Pages upload session obtains a project upload JWT, POSTs the complete immutable hash set to `/pages/assets/check-missing`, uploads only returned hashes, and then calls `/pages/assets/upsert-hashes`.

## Goal

Determine whether the newly recreated Pages project is missing any of the nine already-accepted static browser assets, and separately verify that the stale Worker custom-domain binding still exists, without uploading assets or changing routing.

## Exact binding

- repository: `CurveYield/contract-automation`
- release branch: `orchestrator/round4-ci-base-v1`
- required previous release SHA: `76dcb1e9fcba83ecbbc704495c9962293a99bb59`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- v5 run/job: `31184973446` / `92887124197`
- Pages project: `curveyield-preflight`
- production hostname: `preflight.curveyield.online`

## Checks

1. verify the exact v6 request and release-parent SHA;
2. prove `apps/web/public` is byte-identical to the accepted application source;
3. build the repository-owned nine-file immutable manifest and hash list;
4. GET the replacement Pages project and require HTTP 200, exact production branch, and a valid `.pages.dev` subdomain;
5. GET a fresh Pages upload token and record only HTTP status/API-success booleans;
6. POST the complete hash list to `/pages/assets/check-missing` using the upload JWT and publish only the bounded missing-hash count plus whether every returned hash belongs to the accepted manifest;
7. GET Worker custom domains filtered by `preflight.curveyield.online` and publish only whether exactly one exact match remains;
8. fetch the production hostname and publish only its option count/accepted-vs-stale classification.

## Interpretation

- missing count `0`: the v5 failure was not caused by an empty/recreated asset cache; the next version must isolate deployment creation itself.
- missing count `1..9` with all hashes belonging to the accepted manifest: the next version may seed only those exact accepted assets using Cloudflare's current Pages upload payload contract, then re-check missing hashes before deployment.
- missing count greater than nine, an unknown returned hash, upload-token failure, or project mismatch: stop before any mutation and classify a hard deployment bootstrap discrepancy.

## Safety

- no dependency installation/download or package-manager invocation;
- no repository compilation/build;
- no Pages asset upload or upsert-hashes call;
- no Pages deployment/project/domain mutation;
- no Worker-domain or Worker-script mutation;
- no R2 or secret mutation;
- no API job/upload submission;
- no blockchain RPC call, wallet action, signing, or transaction broadcast;
- no rerun of v5 or any failed/historical workflow;
- upload JWT, Cloudflare account identifiers, response bodies, service identifiers, raw hashes, and service URLs stay transient and are deleted under `always()`.
