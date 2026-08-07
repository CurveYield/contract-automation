# Round 5 Worker-Domain Detach State v8 — Design

## Evidence entering v8

V7 run `31186401186` successfully seeded exactly the nine accepted static browser assets into the recreated `curveyield-preflight` Pages project, reduced the missing-asset count to zero, created terminal production deployment `db5d91bc`, and proved that deployment's immutable Pages URL serves the accepted Ethereum/Base-only browser. V7 then failed at the Worker custom-domain detach call before it recorded any Pages-domain creation or production UI acceptance.

Cloudflare's current Worker custom-domain API documents `DELETE /accounts/{account_id}/workers/domains/{domain_id}` as a 200 JSON-success operation requiring `Workers Scripts Write`. V7 required exactly that response shape, so the failure is not explained by a successful 204/no-body response.

## Goal

Freeze the exact post-v7 routing state with GET/public-read operations only before any further mutation, and prove whether the remaining blocker is limited to detaching the stale Worker custom-domain binding.

## Exact binding

- repository: `CurveYield/contract-automation`
- release branch: `orchestrator/round4-ci-base-v1`
- required previous release SHA: `6876ed3c0934d7b49850f3af8239f7045375171a`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- v7 run/job: `31186401186` / `92891932721`
- successful v7 Pages deployment short ID: `db5d91bc`
- Pages project: `curveyield-preflight`
- production hostname: `preflight.curveyield.online`

## Checks

1. exact request/ref/parent verification;
2. Pages project GET is 200 and reports the trusted production branch;
3. production deployment list resolves exactly one deployment whose ID begins `db5d91bc`, whose environment is production, whose branch is the trusted release branch, whose commit is the accepted browser source, and whose terminal stage is `deploy/success`;
4. exact deployment GET reproduces the same binding;
5. immutable deployment `/` and `/app.js` still satisfy the accepted Ethereum/Base browser contract;
6. Pages project domains list reports the target hostname count/status;
7. Worker custom-domain list filtered by the target hostname reports the exact match count;
8. public production `/` and `/app.js` are classified as accepted, stale-or-unexpected, or unreachable with only the selector option count published.

## Diagnosis

- Worker count `1`, Pages target count `0`, immutable accepted, production stale: `worker-domain-detach-remains-only-routing-blocker`.
- Worker count `0`, Pages target count `0`: `worker-domain-detached-pages-domain-not-attached`.
- Worker count `0`, Pages target active, production accepted: `routing-already-complete`.
- Worker count `1`, Pages target present: `conflicting-worker-and-pages-domain-state`.
- Any missing/mismatched Pages deployment/project evidence: classify the corresponding deployment-state discrepancy and do not mutate.

## Safety

- Cloudflare API methods are GET only.
- Public browser reads are GET only.
- No Worker-domain detach/attach, Worker script mutation, Pages-domain mutation, Pages deployment, Pages asset mutation, project mutation, R2/secret mutation, API job/upload submission, blockchain RPC call, wallet action, signing, or transaction broadcast.
- No dependency installation/download, package manager, Wrangler, compilation, or build.
- No failed or historical workflow rerun.
- Cloudflare response bodies, account IDs, domain IDs, service/zone identifiers, raw hashes, and service URLs remain transient and are deleted under `always()`.

## Next action

If v8 proves the Worker binding remains the only blocker, v9 may attempt exactly one fresh detach while capturing only bounded HTTP status and Cloudflare error code on failure. If the detach is denied because the configured token lacks `Workers Scripts Write`, that is an external credential-permission blocker requiring the account owner to expand/replace the GitHub production secret before the hostname can be migrated to Pages.
