# Current Stack and Lite Boundary v2

## Live repository baseline

The design is based on live `CurveYield/contract-automation` main at commit `922d86d6a229523163ae0a7d49f1908e3ec483b4` and later live-file verification performed during this specification revision.

The live Lite API stores uploads, requests, statuses, results, and reports in R2. A minimum uploaded Lite job performs approximately nine Class A and six Class B R2 operations before client result reads. Reading status, summary, result, and report once raises the minimum to eleven Class B operations. The live archive cap is 250 MiB and the live lifecycle expires the bucket after 30 days.

The handoff copy of `apps/api/src/index.mjs` differs from live main and is not authoritative. The handoff copies of `packages/runner/src/api-client.mjs`, `packages/protocol/src/index.mjs`, and `infra/r2-lifecycle.json` match their live Git blob hashes.

## Immutable Lite boundary

Audit work MUST NOT:

- add Audit fields or routes to Lite `/api/v1` or `/internal/v1`;
- import the Lite runner into Audit execution;
- broaden `simulate.yml`;
- reuse Lite API keys, R2 credentials, bucket bindings, workflow names, concurrency groups, or RPC secrets;
- execute user project scripts in GitHub Actions;
- change Lite archive, workflow, chain, signing, or broadcast restrictions.

Audit uses sibling paths, packages, workflows, domains, secrets, and R2 buckets. Removing or disabling Audit must leave Lite buildable and deployable.

## Shared Cloudflare-account warning

R2 included usage is billed at the account usage level. If Lite and Audit use the same Cloudflare account, capacity planning MUST conservatively treat the 10 GB-month, 1 million Class A, and 10 million Class B allowances as shared. A separate Cloudflare account provides cleaner security and accounting, but it is not required by this code specification.
