# Source Snapshot v2

Official Cloudflare sources used for R2 calculations and design validation:

- R2 pricing, updated May 28, 2026: `https://developers.cloudflare.com/r2/pricing/`
- R2 limits, updated June 8, 2026: `https://developers.cloudflare.com/r2/platform/limits/`
- R2 Workers API and conditional operations, updated June 22, 2026: `https://developers.cloudflare.com/r2/api/workers/workers-api-reference/`
- R2 consistency model, updated April 30, 2026: `https://developers.cloudflare.com/r2/reference/consistency/`
- R2 storage classes, updated April 21, 2026: `https://developers.cloudflare.com/r2/buckets/storage-classes/`

Live repository files checked through the connected GitHub App:
- `apps/api/src/index.mjs`
- `packages/runner/src/api-client.mjs`
- `packages/protocol/src/index.mjs`
- `infra/r2-lifecycle.json`

The live API file superseded the older handoff copy. The other three handoff file blob hashes matched live main.
