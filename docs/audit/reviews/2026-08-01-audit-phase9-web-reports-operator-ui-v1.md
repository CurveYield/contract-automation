# Phase 9 Web Reports, Operator UI, and Accessibility Review v1

> **Worker:** worker-4  
> **Issue:** #105  
> **Branch:** `audit-phase9/web-reports-operator-ui-v1`  
> **Starting SHA:** `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`

## Implementation plan

### Goal
Build a dependency-free, execution-disabled Audit web/report surface using inert repository fixtures and injected client interfaces only.

### Architecture

1. `packages/audit-ui-contracts/` defines strict, enumerable input contracts and bounded error identifiers.
2. `packages/audit-report-view-model/` converts untrusted contract-shaped values into recursively frozen, deterministic, rendering-safe canonical view models.
3. `apps/audit-web/` provides a pure HTML rendering layer, an inert route/controller layer, responsive CSS, and a safe injected transport that handles cancellation and stale responses without persisting credentials.
4. Focused Node tests and inert fixtures cover all routes, lifecycle truth states, accessibility semantics, viewport rules, cancellation races, adversarial values, secret redaction, and static execution boundaries.

### Batch 1 — Sections 1–4 / Checkpoint 1

- Add failing tests for contract exports, defensive normalization, deterministic ordering, deep freezing, safe URLs, HTML escaping, shell routes, and keyboard/focus metadata.
- Implement strict contracts and canonical view models.
- Implement responsive shell, route map, loading/empty/error states, and keyboard-first navigation metadata.
- Run focused Node tests and syntax checks, then publish Checkpoint 1.

### Batch 2 — Sections 5–8 / Checkpoint 2

- Add failing tests for report list/filter/sort/pagination, report detail/evidence summaries, workspace/campaign/job lifecycle truth states, persistent fork lifecycle, clean-room provenance, and capability/catalog non-execution messaging.
- Implement pure route/page renderers and deterministic controller flows.
- Run lifecycle, route, pagination, and hidden-resource non-interference tests, then publish Checkpoint 2.

### Batch 3 — Sections 9–12 / Checkpoint 3

- Add failing tests for bounded diagnostics, redaction, accessible tables/cards/details, copy-safe identifiers, truncation/expand behavior, semantic headings, reduced motion, viewport rules, cancellation, and stale-response rejection.
- Implement operator diagnostics, accessibility helpers, responsive CSS contracts, and injected transport.
- Run diagnostics, accessibility, viewport, mutation, and client-race tests, then publish Checkpoint 3.

### Batch 4 — Sections 13–16 / Checkpoint 4 and final

- Add inert end-to-end flow tests for catalog-to-report, fork lifecycle, clean-room provenance, and operator recovery.
- Add adversarial fixtures for XSS, unsafe URLs, prototypes, accessors, sparse arrays, cycles, oversized data, Unicode/control characters, and secrets.
- Add static boundary tests proving absence of wallet/signing/transaction/broadcast/deployment/RPC/dynamic-code/install/workflow-mutation paths.
- Run all permissible direct Node tests, JavaScript syntax checks, JSON parsing, changed-path allowlist checks, and whitespace validation.
- Complete this review with exact inventories, totals, risks, and recommendation; publish Checkpoint 4 and final report; then write durable completion records.

## Global constraints

- No dependency installation or downloads.
- No compilation or unavailable build tooling.
- No live API/network calls, submitted-project execution, containers, RPCs, wallets, keys, signers, transactions, deployments, workflow approvals, or production secrets.
- Modify only issue #105 owned paths.
- Use test-first RED/GREEN evidence for every behavior change.
- Do not open or merge a pull request and do not merge to `main`.

## Verification ledger

This section will be updated at each checkpoint with exact commands, counts, changed files, route/component/view-model matrices, accessibility and viewport evidence, mutation totals, and residual risks.
