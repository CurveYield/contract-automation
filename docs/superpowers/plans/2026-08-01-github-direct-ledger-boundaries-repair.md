# GitHub Direct Ledger Boundary Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and verification-before-completion task-by-task.

**Goal:** Restrict GitHub Direct ledger mutations to closed server-owned path families and make partial-write recovery reject duplicate, conflicting, or unrelated observations.

**Architecture:** Replace prefix-only path acceptance with a canonical parser for the exact request/current/event/result/report/manifest/job-index namespaces. Classify paths so CAS updates are limited to mutable current/index records. Parse recovery observations before constructing maps and prove every observation belongs to exactly one supplied plan.

**Tech Stack:** Node.js ESM, `node:test`, dependency-free GitHub Direct protocol/ledger packages.

## Global Constraints

- Starting SHA: `1ba6ec492813375aaa867ef0e35ee6cc185c253a`.
- Preserve issue #106 protocol repairs unchanged.
- Do not modify GitHub-native simulation, RPC policy, its workflow, Cloudflare mode, CurveYield Lite, or submitted execution.
- No new dependencies.
- Every production change requires observed RED first.

---

### Task 1: Closed canonical path parser

**Files:**
- Modify: `packages/audit-github-direct-ledger/src/paths.mjs`
- Test: `test/audit-github-direct-ledger-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests for arbitrary in-root namespaces, suffix aliases, control characters, overlong paths, invalid identifiers and malformed index paths.
- [ ] Record RED.
- [ ] Implement exact canonical recognition for requests, current, events, results, reports, manifests and the single jobs index.
- [ ] Return a stable bounded `ledger_path_violation`/underlying identifier error without filesystem or URL interpretation.

### Task 2: Operation-to-path compatibility

**Files:**
- Modify: `packages/audit-github-direct-ledger/src/mutations.mjs`
- Test: `test/audit-github-direct-ledger-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests proving CAS cannot target immutable request/event/result/report/manifest paths and create-only cannot target the mutable jobs index.
- [ ] Record RED.
- [ ] Enforce path-kind compatibility while preserving first creation of `current` records.

### Task 3: Recovery observation uniqueness and relevance

**Files:**
- Modify: `packages/audit-github-direct-ledger/src/recovery.mjs`
- Test: `test/audit-github-direct-ledger-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests for duplicate identical observations, duplicate conflicting observations, unrelated observations, and unrelated current-blob map entries.
- [ ] Record RED.
- [ ] Parse observations into a checked list, reject duplicate paths, and require every observed/current path to correspond to the appropriate supplied plan.
- [ ] Preserve deterministic convergence for valid partial-write scenarios.

### Task 4: Full ledger and runner-publication verification

**Files:**
- Test: existing GitHub Direct ledger and runner suites
- Create: `docs/audit/reviews/2026-08-01-audit-github-direct-ledger-boundaries-repair-v1.md`

- [ ] Run the repair regressions plus original protocol and ledger suites.
- [ ] Run dependent runner-publication tests when reconstructed locally.
- [ ] Run syntax checks on all changed modules/tests.
- [ ] Verify changed paths and confirm zero simulation-addon changes.
- [ ] Publish exact RED/GREEN evidence, residual risks, and recommendation.
