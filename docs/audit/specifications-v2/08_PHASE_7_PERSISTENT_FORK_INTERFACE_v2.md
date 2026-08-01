# Phase 7 — Persistent Fork Interface and R2 Checkpoints v2

## Current-stack completion

The current stack implements:

- fork IDs, states, authorization, quotas, and APIs;
- structured action schemas;
- exact chain/block requirements;
- no-wallet/no-signing/no-broadcast validation;
- snapshot/checkpoint manifests;
- encrypted-client or opaque checkpoint object ingestion;
- restore/export/delete state transitions;
- a deterministic reference/mock fork adapter for tests.

## Deferred active compute

Cloudflare Workers and GitHub-hosted Actions do not host active untrusted fork processes. The `create` API remains `awaiting_executor` until the separate hardened compute project supplies an approved fork adapter.

## R2 checkpoint policy

- checkpoint target size: 250 MB;
- checkpoint maximum: 1 GB;
- active checkpoint retention: one day;
- exported checkpoint retention: seven days;
- maximum eight checkpoints per fork under the free-development profile;
- checkpoint data stored as one object plus one manifest;
- exports reference existing checkpoint objects instead of copying them;
- deletes are free, but tombstone/index writes remain Class A.

## Capacity consequence

Eight 250 MB checkpoints retained for one day consume about 0.0667 GB-month, allowing roughly 150 such fork sets inside the 10 GB-month free allowance if no other R2 data exists. Seven-day retention lowers that conservative capacity to about 21 fork sets.
