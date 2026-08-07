# Round 5 Pages Production-Domain DNS Repair v13 — Design

## Problem

The v12 preinstalled Pages-domain trigger executed from exact release parent `c1c135e0100703c4acc1f2a9bf662e7c9cf96ed8` and proved the accepted Pages deployment is intact, the stale Worker hostname binding is absent, and the Pages custom-domain association exists exactly once. The custom domain still remained `pending`, so production browser acceptance could not run.

Cloudflare Pages requires a custom subdomain to CNAME to the Pages project subdomain. For a Cloudflare-managed zone this record is normally created automatically after the Pages domain is confirmed. Because the association is already present but remains pending, v13 isolates the authoritative zone/DNS layer and makes only the smallest deterministic DNS repair when the existing state is unambiguous.

## Exact binding

- repository: `CurveYield/contract-automation`
- release branch: `orchestrator/round4-ci-base-v1`
- accepted browser source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- verified Pages deployment short ID: `db5d91bc`
- v9 routing-state run: `31187717248`
- v12 domain-attach run: `31202011243`
- Pages project: `curveyield-preflight`
- production hostname: `preflight.curveyield.online`
- zone name: `curveyield.online`
- active browser networks: exactly Ethereum and Base
- static default: Base only

The one-time request is created only after this v13 workflow is already installed on the trusted release branch. Its `expectedBeforeSha` must equal `github.event.before` on the request-only trigger push.

## Root-cause evidence

Before DNS mutation v13 must prove:

1. the Pages project's canonical deployment and exact deployment are production, bound to the trusted release branch and accepted application source, and terminal `deploy/success`;
2. immutable Pages HTML/JavaScript still implement exactly Ethereum then Base with Base as the sole static default and retain authenticated chain synchronization;
3. the target Worker custom-domain match count is zero;
4. the exact Pages domain record is present and its domain, validation, and verification states are captured only as bounded status/method/error-class values;
5. the Cloudflare zone lookup resolves exactly one active `curveyield.online` zone; and
6. all DNS records at `preflight.curveyield.online` are classified before any write.

Zone IDs, DNS record IDs, validation TXT values, response bodies, raw error messages, service URLs, account identifiers, and credentials remain runner-local and are never published.

## Allowed DNS repair

The workflow derives the Pages CNAME target from the Pages project's own `subdomain` field and requires that it be a single hostname ending in `.pages.dev`.

After state capture:

- If the target hostname has zero DNS records, create exactly one CNAME whose name is `preflight.curveyield.online`, whose content is the exact project Pages subdomain, whose TTL is automatic (`1`), and whose proxy flag is enabled.
- If the target hostname has exactly one DNS record and it is a CNAME already pointing to the exact Pages project subdomain, make no DNS mutation. Proxy state is not changed merely to normalize configuration.
- If the target hostname has exactly one CNAME pointing elsewhere, patch only that record to the exact Pages project subdomain with automatic TTL and proxy enabled.
- If there is more than one record, or the sole record is not a CNAME, fail closed without deleting or replacing records.
- Never delete any DNS record.

A failed zone read is classified separately from a failed DNS write. DNS creation and patch require the existing `CLOUDFLARE_API_TOKEN` to possess the needed zone-scoped permission; v13 never broadens credentials itself.

## Post-repair acceptance

After a create, patch, or no-op-correct state, v13 must re-read authoritative DNS and prove there is exactly one CNAME at the hostname pointing to the Pages project subdomain. It then polls the exact Pages custom-domain record for a bounded period.

Semantic routing success requires all of:

- exact Pages domain status `active`;
- production `/` and `/app.js` load successfully with cache busting;
- production selector values exactly `ethereum`, `base`;
- Base is the sole static default;
- authenticated chain synchronization fragments remain present;
- final Worker hostname match count remains zero; and
- final DNS remains the exact project Pages CNAME.

If DNS is correct but Pages remains pending, v13 publishes bounded validation/verification status and error classification so a fresh v14 can address the next proven layer rather than guessing.

## Mutation boundary

Allowed only when the hostname state is unambiguous:

- `POST /zones/{zone_id}/dns_records` to create the dedicated production CNAME when no record exists;
- `PATCH /zones/{zone_id}/dns_records/{record_id}` to correct the sole existing CNAME when it points elsewhere.

Forbidden:

- DNS record deletion;
- mutation of unrelated DNS names or record types;
- Pages domain/project/deployment/asset mutation;
- Worker route/domain/script mutation;
- R2 or secret mutation;
- job/upload submission;
- blockchain RPC, wallet, signing, or transaction broadcast;
- dependency installation/download, package manager, Wrangler, compile, or build;
- failed or historical workflow rerun.

## Sanitized receipt

Issue #125 receives a receipt under `always()` containing only bounded booleans, enums, counts, HTTP status classes, source/run identifiers, and the final diagnosis. The receipt must not include secret values, account/zone/DNS identifiers, raw DNS targets, validation TXT values, raw Cloudflare error messages or bodies, or service URLs.
