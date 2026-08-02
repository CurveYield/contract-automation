# Worker 4 — Round 4 GitHub Direct/UI compatibility review and assembled E2E acceptance v1

## Identity

- Worker ID: `worker-4-round4-web-direct-e2e-review-v1`
- Mailbox sequence: `3`
- Message ID: `worker-4-round4-web-direct-e2e-review-v1-000003`
- Repository: `CurveYield/contract-automation`
- Issue: `#124`
- Branch: `audit-round4/review-web-direct-e2e-v1`
- Starting SHA: `fdc55d684be2cd5053c1e617aa09399fdfcf60c2`
- Round: **4 — final static/inert integration and acceptance round before Round 5 production testing**

## Authoritative inputs

Re-fetch every input before editing and reject any mismatch:

- Worker 4 Round 3 web final head: `fdc55d684be2cd5053c1e617aa09399fdfcf60c2`, issue `#116`.
- Worker 3 Round 3 GitHub Direct final documentation head: `1672b31a71674dd78eddc3bf5fc2fbe39d4ae07d`, issue `#115`, final report comment `5156758072`.
- Worker 3 verified code/workflow candidate: `46873f805199e2212af3902c8525c0f3e4501721`.
- Worker 3 public result schema: `github-direct-service-result-v2`.
- Worker 0 reconciled Phase 7–8 head: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`, recommendation `ACCEPT WITH REPAIR`, issue `#112`.
- Worker 1 API/GPT/auth final head: `6d877e2d87f1a91380a6c5d1efc47550527d8729`, issue `#113`.
- Round 4 master gate: issue `#119`.
- Assignment contract: issue `#124` plus this immutable mailbox file.

## Goal

Perform a fresh independent consumer-side review of the GitHub Direct control plane, Phase 7–8 public compatibility seams, API contracts and the Round 3 web package. Build an exhaustive state/view compatibility package, repair only proven public-contract or UI defects test-first, and produce deterministic Worker 2 intake instructions. After Worker 2 freezes the assembled candidate SHA, perform the final UI/accessibility/inert-E2E acceptance against that exact SHA.

This is a release-sized assignment. Do not finish after a few focused tests. Complete all ordered sections and durable checkpoints.

## Owned paths

- proven minimal repairs to Worker 3 public status/report compatibility modules;
- Worker 4 adapters, UI contracts, view models, routes, client state and static entry;
- tests beginning `test/audit-round4-worker4-`;
- `apps/audit-web/test/round4-*`;
- fixtures under `test/fixtures/audit-round4/worker4/**`;
- review, manifests and intake docs under `docs/audit/round4/worker4/**`.

Do not modify Worker 3 ledger/auth/workflow internals unless a public-contract defect is independently reproduced and the repair is the smallest valid fix. Never alter the GitHub-native simulation/App/RPC addon.

## Stage A ordered work

1. Pin the exact input heads, report comments, handoff manifests and every relevant path/blob.
2. Re-run all permissible Worker 3 public-contract/report/CLI fixture tests and Worker 4 web contract/view-model/E2E suites.
3. Build a complete compatibility registry covering GitHub Direct command/result/error v2, API public records, Phase 7–8 service/report records and all 22 web entity kinds.
4. Build a state-to-view truth matrix for requested, admitted, awaiting executor, provisioning, running, collecting evidence, checkpointing, exporting, restoring, deleting, completed, failed, cancelled, timed out, policy rejected, tombstoned, offline stale, unavailable and hidden/not-found states.
5. Add observed RED tests for impossible or contradictory state combinations.
6. Add RED tests for unsafe URLs, schemes, fragments, host paths, credentials, authorization values, attacker text, Unicode controls, bidi text and oversized diagnostics.
7. Add RED tests for hidden-resource count/header/cache/ETag drift and absent-vs-hidden rendering differences.
8. Add RED tests for stale response races, cancellation mismatch, duplicate/conflicting report references, report/result identity substitutions and false progress/execution claims.

### Checkpoint 1

Post exact SHA, source/report/blob verification, full state/view compatibility map, observed RED commands/results, protected hashes and changed paths.

9. Repair only proven public-contract or UI compatibility defects.
10. Ensure every GitHub Direct result/error and Phase 7–8/API record is projected through strict versioned adapters; no transport/storage/private implementation import.
11. Harden safe text, identifiers, links, references, diagnostics and error views against all hostile inputs.
12. Harden stale-response rejection, same-slot cancellation, request deduplication, scoped ETag caching and offline-stale recovery.
13. Verify every execution-looking screen states execution truthfully and exposes no unsafe mutation action.
14. Verify report/evidence/provenance references are bounded immutable metadata only.
15. Expand accessible names, headings, landmarks, status announcements, focus restoration, table semantics, keyboard behavior and reduced-motion/forced-color contracts.
16. Expand mobile/tablet/desktop, 320px, 200% zoom, 400% zoom, long identifier, huge count and wide graph fixtures.

### Checkpoint 2

Post repaired SHA, compatibility-version changes, GREEN results, route/view inventory, client-state traces, accessibility/layout evidence and exact Worker 2 intake paths.

17. Run broad hostile/XSS/Unicode/hidden-resource/accessibility mutation matrices across all versioned entities and routes.
18. Run complete inert journeys: submit/status/awaiting executor/cancel/report; trusted fixture completion; fork create/checkpoint/export/restore/delete; clean-room access/share/merge/provenance/report; API hidden-resource and offline recovery.
19. Run syntax, JSON, static import, direct-network, credential-literal, dynamic-code, unsafe-DOM, changed-path ownership, protected-blob and whitespace gates.
20. Publish a complete Stage A review, per-path/blob manifest, compatibility manifest and deterministic Worker 2 intake instructions with `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT`.

### Checkpoint 3 — Stage A completion

Post final Stage A SHA, all changed paths/blobs, total tests/mutations/journeys/viewports/routes, residual risks, protected hashes and exact intake order.

## Stage B assembled acceptance

When Worker 2 publishes one exact integration SHA on issue #119:

1. Re-fetch and pin that exact SHA.
2. Re-run all affected UI/contracts/E2E/static/accessibility gates against the assembled tree.
3. Verify complete route/view/view-model coverage and exact public schema versions.
4. Verify API, Phase 7–8 and GitHub Direct lifecycle truth and hidden-resource non-interference.
5. Verify safe rendering, diagnostics redaction, stale/cancellation/cache/concurrency behavior and inert full-system journeys.
6. Verify protected simulation-addon blob equality.
7. Publish `ACCEPT` or `REJECT` against that exact SHA. A newer SHA invalidates the acceptance.

## Restrictions

No dependency installation unless issue #124 explicitly permits it, no submitted-project execution, no live RPC, no wallet/key/signing, no transaction/broadcast, no production deployment, no secret values, no PR, no branch merge and no direct `main` modification. Browser/live deployment checks belong to Round 5 unless separately authorized.

## Completion protocol

- Post startup and every checkpoint only to issue #124.
- Commit and push only to `audit-round4/review-web-direct-e2e-v1`.
- Record exact final report URL/comment ID and final SHA in Worker 4 status.
- Keep checking issue #119 for the frozen Stage B assembled SHA after Stage A completion.
