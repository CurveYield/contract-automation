# Phase 7–8 Semantic Boundary Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and verification-before-completion task-by-task.

**Goal:** Complete the Phase 7 fork lifecycle and hostile/read boundaries, and make Phase 8 merge/provenance validators enforce the same semantic contracts as their builders.

**Architecture:** Preserve all accepted wire formats and owned paths. Introduce reusable Phase 7 transient-operation helpers around the existing CAS state machine, harden graph traversal through property descriptors and normalized reflection failures, and expose tenant-bound public read helpers. Rebuild Phase 8 validation through canonical semantic helpers rather than digest-only checks.

**Tech Stack:** Node.js ESM, `node:test`, dependency-free Phase 7/8 packages.

## Global Constraints

- Starting SHA: `4c875bb9291d3e714af9cd0013ee5d460f576a2b`.
- Preserve all valid Phase 7/8 wire formats and current deterministic IDs.
- Do not modify GitHub-native simulation, its workflow or RPC policy.
- Do not modify GitHub Direct Audit packages or active Worker 1/2/3/4 owned paths.
- No new dependencies.
- Every production behavior change requires observed RED first.

---

### Task 1: Phase 7 hostile-safe graph traversal

**Files:**
- Modify: `packages/audit-fork-protocol/src/internals.mjs`
- Test: `test/audit-phases7-8-semantic-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests for accessor-backed arrays, sparse arrays, symbol keys, throwing proxies and revoked proxies.
- [ ] Prove getter bodies are never invoked.
- [ ] Normalize reflection failures to a stable Phase 7 validation error.
- [ ] Reuse descriptor values for arrays and objects during validation/canonicalization.

### Task 2: Phase 7 transient operation state machine

**Files:**
- Modify: `packages/audit-forks/src/checkpoint-operations.mjs`
- Modify: `packages/audit-forks/src/service.mjs`
- Test: `test/audit-phases7-8-semantic-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests proving checkpoint, export and restore never enter their declared transient states.
- [ ] Add failure injection after transient-state entry, after each immutable write/index update and before return to ready.
- [ ] Implement deterministic `ready -> checkpointing/exporting/restoring -> ready` transitions.
- [ ] Make exact retries converge after every partial boundary without duplicate immutable records or skipped events.
- [ ] Reject conflicting operation identity/timestamp retries.

### Task 3: Tenant-scoped Phase 7 public reads

**Files:**
- Modify: `packages/audit-forks/src/service.mjs`
- Modify: `packages/audit-forks/src/checkpoint-operations.mjs`
- Test: `test/audit-phases7-8-semantic-boundaries-repair-v1.test.mjs`

- [ ] Add failing cross-tenant fork/checkpoint read tests.
- [ ] Add public tenant-bound read methods and internal record-reader methods.
- [ ] Ensure integration/service callers cannot accidentally use an unscoped exported read API.
- [ ] Preserve internal operation composition and not-found behavior.

### Task 4: Phase 8 merge request and manifest semantic validation

**Files:**
- Modify: `packages/audit-controlled-merge/src/request-state.mjs`
- Modify: `packages/audit-controlled-merge/src/publication-storage.mjs`
- Test: `test/audit-phases7-8-semantic-boundaries-repair-v1.test.mjs`

- [ ] Add self-hashed one-input, duplicate-input and malformed-order merge requests.
- [ ] Add self-hashed malformed terminal digest lists, report references and operation summaries.
- [ ] Reuse canonical semantic helpers in builders and validators.
- [ ] Reject duplicate identities and noncanonical order before digest checks.

### Task 5: Phase 8 relation semantic validation

**Files:**
- Modify: `packages/audit-controlled-merge/src/relations.mjs`
- Test: `test/audit-phases7-8-semantic-boundaries-repair-v1.test.mjs`

- [ ] Add self-hashed duplicate relations with repeated members or material mismatch.
- [ ] Add conflict relations with false/missing conflict fields, repeated members or no actual material conflict.
- [ ] Derive and compare relation semantics before digest acceptance.

### Task 6: Hostile-safe provenance classification

**Files:**
- Modify: `packages/audit-provenance/src/index.mjs`
- Test: `test/audit-phases7-8-semantic-boundaries-repair-v1.test.mjs`

- [ ] Add accessor and revoked-proxy node/edge tests proving property bodies are not invoked.
- [ ] Classify built versus versioned inputs using hostile-safe descriptors.
- [ ] Preserve deterministic node/edge/index identities and cycle/reference checks.

### Task 7: Full verification and review

**Files:**
- Create: `docs/audit/reviews/2026-08-01-audit-phases7-8-semantic-boundaries-repair-v1.md`

- [ ] Run all Phase 7, Phase 8 and cross-phase tests plus the new repair suite.
- [ ] Run syntax and JSON checks.
- [ ] Verify changed-path allowlist and absence of paused simulation-addon changes.
- [ ] Publish exact RED/GREEN evidence, changed files, residual risks and recommendation.
