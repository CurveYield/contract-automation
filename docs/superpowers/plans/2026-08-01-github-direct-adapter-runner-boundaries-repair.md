# GitHub Direct Adapter and Runner Boundary Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and verification-before-completion task-by-task.

**Goal:** Ensure no unvalidated adapter input or transport output reaches trusted code, and make runner admission/outcome/publication validators enforce exact cross-record truth and publication binding.

**Architecture:** Add small exact response validators beside the adapter, validate all publication plans before transport lookup, and route artifact metadata through hostile-safe validators without pre-reading properties. In the runner, centralize admission/outcome truth checks and verify publication child plans against exact ledger paths/content and adapter conclusions derived from the outcome.

**Tech Stack:** Node.js ESM, `node:test`, dependency-free GitHub Direct protocol, ledger, adapter and runner packages.

## Global Constraints

- Starting SHA: `412e5bdf7ee70cd55348885928685c1455937d5e`.
- Preserve accepted issue #106 and #108 repairs.
- Do not modify the paused GitHub-native simulation/RPC addon, its workflow or RPC policy.
- Do not touch Cloudflare mode, CurveYield Lite or submitted execution.
- No new dependencies.
- Every production change requires observed RED first.

---

### Task 1: Hostile-safe publication and artifact boundaries

**Files:**
- Modify: `packages/audit-github-direct-adapter/src/publications.mjs`
- Modify: `packages/audit-github-direct-adapter/src/adapter.mjs`
- Test: `test/audit-github-direct-adapter-runner-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests proving publication getters/revoked proxies and artifact metadata getters/proxies yield bounded errors without invocation.
- [ ] Add a failing test proving malformed publication plans cannot cause `getPublication` transport calls.
- [ ] Record RED.
- [ ] Move exact plan validation before all property reads and transport access.
- [ ] Route artifact records through hostile-safe exact validation without pre-reading `schemaVersion`.

### Task 2: Exact adapter transport response contracts

**Files:**
- Modify: `packages/audit-github-direct-adapter/src/adapter.mjs`
- Test: `test/audit-github-direct-adapter-runner-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests for repository ID/name drift, commit SHA drift, malformed blob/content responses, ledger result drift, publication result drift and oversized/unexpected fields.
- [ ] Record RED.
- [ ] Implement exact bounded response validators and identity checks for every injected transport operation.
- [ ] Keep error normalization bounded and secret-free.

### Task 3: Runner admission and outcome truth constraints

**Files:**
- Modify: `packages/audit-github-direct-runner/src/admission.mjs`
- Modify: `packages/audit-github-direct-runner/src/orchestration.mjs`
- Test: `test/audit-github-direct-adapter-runner-boundaries-repair-v1.test.mjs`

- [ ] Add self-hashed contradictory admission tests for fixture/reason/state/digest/summary combinations.
- [ ] Add self-hashed contradictory outcome tests for fixture presence, terminal state, transitions and result-manifest execution truth.
- [ ] Record RED.
- [ ] Enforce one closed truth table for fixture and non-fixture records.

### Task 4: Runner publication cross-record binding

**Files:**
- Modify: `packages/audit-github-direct-runner/src/publication.mjs`
- Test: `test/audit-github-direct-adapter-runner-boundaries-repair-v1.test.mjs`

- [ ] Add failing tests for swapped ledger paths/content, unrelated report entries, wrong Check/status conclusions and descriptions, and mismatched outcome IDs.
- [ ] Record RED.
- [ ] Validate exact result/report ledger paths and contents and derive expected adapter plans from the validated outcome.
- [ ] Reject publication plans that are individually valid but collectively describe another outcome.

### Task 5: Full verification and review

**Files:**
- Create: `docs/audit/reviews/2026-08-01-audit-github-direct-adapter-runner-boundaries-repair-v1.md`

- [ ] Run protocol, ledger, adapter, runner, cross-mode, static and repair suites.
- [ ] Run syntax checks on all changed modules/tests.
- [ ] Confirm no paused simulation-addon path changed.
- [ ] Publish exact RED/GREEN counts, changed files, residual risks and recommendation.
