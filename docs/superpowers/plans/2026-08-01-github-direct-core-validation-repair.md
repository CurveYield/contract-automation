# GitHub Direct Core Validation Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and verification-before-completion task-by-task.

**Goal:** Make every exported GitHub Direct core validator independently enforce its full schema and truth constraints before accepting a self-consistent digest.

**Architecture:** Preserve existing builders and wire formats. Add strict reusable field-validation helpers inside the existing lifecycle/publication modules, then make validators reconstruct the same canonical body as builders and reject invalid fields before digest/ID checks. Add focused mutation and hostile-container regression tests.

**Tech Stack:** Node.js ESM, `node:test`, dependency-free protocol modules.

## Global Constraints

- Do not modify GitHub-native simulation, RPC-policy, workflow, Cloudflare mode, CurveYield Lite, or submitted execution.
- No new dependencies.
- Existing valid vectors and public exports remain compatible.
- Every production change requires an observed failing test first.

---

### Task 1: State validator field completeness

**Files:**
- Modify: `packages/audit-github-direct-protocol/src/lifecycle.mjs`
- Test: `test/audit-github-direct-core-validation-repair-v1.test.mjs`

- [ ] Add a test that recomputes a valid state digest around an invalid `repositoryFullName` and proves the current validator accepts it.
- [ ] Run the focused test and record RED.
- [ ] Validate mode, job ID, repository ID, installation ID, canonical repository full name, target SHA, state, version, timestamp and digest before returning.
- [ ] Run focused and existing protocol tests.

### Task 2: Capability manifest validator completeness

**Files:**
- Modify: `packages/audit-github-direct-protocol/src/publication.mjs`
- Test: `test/audit-github-direct-core-validation-repair-v1.test.mjs`

- [ ] Add mutations for invalid mode, repository/install identity, repository name, SHA, auth kind, capabilities, timestamps and expiry ordering with recomputed digest/ID.
- [ ] Record RED.
- [ ] Validate every field and expiry relation before digest/ID checks.
- [ ] Run focused and existing tests.

### Task 3: Result manifest truth validation

**Files:**
- Modify: `packages/audit-github-direct-protocol/src/publication.mjs`
- Test: `test/audit-github-direct-core-validation-repair-v1.test.mjs`

- [ ] Add self-hashed invalid outcome/execution-state, malformed summary, profile/parser/result version, SHA and timestamp cases.
- [ ] Record RED.
- [ ] Replace the no-op statement with full field and truth-constraint validation.
- [ ] Run focused and existing tests.

### Task 4: Report index hostile-container and field validation

**Files:**
- Modify: `packages/audit-github-direct-protocol/src/publication.mjs`
- Test: `test/audit-github-direct-core-validation-repair-v1.test.mjs`

- [ ] Add tests for sparse arrays, accessor-backed entries, custom iterators, malformed entries, invalid mode/job/SHA/version/time, duplicates and noncanonical ordering.
- [ ] Record RED.
- [ ] Validate with `denseArray` and exact entry validators before canonical order comparison and digest/ID checks.
- [ ] Run focused and existing tests.

### Task 5: Full verification and review

**Files:**
- Create: `docs/audit/reviews/2026-08-01-audit-github-direct-core-validation-repair-v1.md`

- [ ] Run all GitHub Direct core Node tests.
- [ ] Run syntax checks on changed modules/tests.
- [ ] Verify changed-path allowlist and `git diff --check` where available.
- [ ] Record exact RED/GREEN evidence, changed files, residual risks and recommendation.
