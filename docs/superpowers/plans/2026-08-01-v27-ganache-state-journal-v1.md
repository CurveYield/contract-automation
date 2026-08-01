# V27 Ganache State-Journal Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the V27 remote-trace packet into a complete Ganache-local live-fork lifecycle runner that preserves every requested data point and executes once in GitHub Actions.

**Architecture:** Reuse the repository's trusted GitHub-native compiler, fail-closed upstream RPC proxy, and Ganache engine. Add a focused local execution/reporting layer that sends real transactions only to the ephemeral Ganache fork, records receipts and local traces, snapshots all relevant V27 entities before and after each operation, computes deterministic state diffs and cumulative journal hashes, and executes the packet's main journey, migration, post-migration cycles, and supplemental tests.

**Tech Stack:** Node.js 22, ESM, ethers v6, Ganache, Solidity 0.8.28 through the existing trusted compiler, GitHub Actions.

## Global Constraints

- Do not modify any Solidity source.
- Do not broadcast any transaction to Ethereum.
- dRPC is only an upstream read source behind the existing fail-closed proxy.
- Preserve all packet observations previously supplied by `trace_callMany`, `debug_traceCall`, the state journal, and snapshot schema.
- Run once with no automatic retry loop.
- Upload partial artifacts on every failure.
- Keep the execution branch temporary and do not merge it.

---

### Task 1: Deterministic local journal/report helpers

**Files:**
- Create: `packages/github-native-sim/src/local-state-journal.mjs`
- Create: `packages/github-native-sim/test/local-state-journal.test.mjs`

**Interfaces:**
- Produces: `hashCanonical(value)`, `makeSimulationCallId(index, descriptor)`, `diffEntitySnapshots(before, after)`, `appendJournal(previousHash, entry)`, `normalizeReceipt(receipt)`, and `assertRequiredCallRecord(record)`.

- [ ] Write failing tests for deterministic hashes and IDs, nested entity diffs, cumulative journal changes, receipt normalization, and required call-record fields.
- [ ] Run `node --test packages/github-native-sim/test/local-state-journal.test.mjs` and confirm the tests fail because the module is absent.
- [ ] Implement the minimal helper module.
- [ ] Run the focused test and confirm all cases pass.
- [ ] Run `node --check packages/github-native-sim/src/local-state-journal.mjs`.

### Task 2: Ganache transaction recorder and snapshot collector

**Files:**
- Create: `github-native-sim/jobs/v27-ganache-full-v1/scripts/v27-observers.mjs`
- Create: `github-native-sim/jobs/v27-ganache-full-v1/scripts/ganache-call-recorder.mjs`
- Create: `github-native-sim/jobs/v27-ganache-full-v1/tests/ganache-call-recorder.test.mjs`

**Interfaces:**
- Consumes: Task 1 helper functions.
- Produces: `createV27Observer(context)` and `createGanacheCallRecorder(context)`; recorder methods `write`, `read`, `snapshot`, `revert`, and `advanceTime`.

- [ ] Write failing tests with an in-memory fake local provider proving that a write captures pre/post snapshots, receipt fields, logs, trace hash, state-diff hash, and cumulative journal hash; prove an expected-revert branch restores canonical state.
- [ ] Run the focused test and observe the expected missing-module failure.
- [ ] Implement the observer and recorder with dependency injection.
- [ ] Re-run focused tests and syntax checks.

### Task 3: Exact-source V27 lifecycle runner

**Files:**
- Create: `github-native-sim/jobs/v27-ganache-full-v1/scripts/run-v27-ganache-lifecycle.mjs`
- Create: `github-native-sim/jobs/v27-ganache-full-v1/config/simulation-config.json`
- Create: `github-native-sim/jobs/v27-ganache-full-v1/config/funding-accounts.json`
- Create: `github-native-sim/jobs/v27-ganache-full-v1/schema/data-report-schema.json`
- Create: `github-native-sim/jobs/v27-ganache-full-v1/README.md`

**Interfaces:**
- Consumes: compiled artifacts, fork URL/local provider, V27 observers, and recorder.
- Produces: `data-report.json`, `snapshots/*.json`, `calls/*.json`, `assertions.json`, and `summary.md`.

- [ ] Encode pinned-state preflight and exact integration assertions.
- [ ] Encode real-holder funding and exact 18,500 sdYB increase.
- [ ] Deploy converter, vault, Strategy 1, then configure fees, strategy, approval, and version assertions.
- [ ] Execute all four main cycles with pre/post snapshots and economic reconciliations.
- [ ] Execute live-position Strategy 1 to Strategy 2 migration with early-revert branch and mature execution.
- [ ] Execute M1 and M2 post-migration cycles.
- [ ] Execute every supplemental negative/invariant test from isolated Ganache snapshots.
- [ ] Validate that all required report fields and observation categories exist before returning success.

### Task 4: GitHub workflow and exact packet reconstruction

**Files:**
- Create: `.github/workflows/temp-v27-ganache-full-v1.yml`
- Create: `github-native-sim/jobs/v27-ganache-full-v1/job.json`
- Copy byte-for-byte: packet V27 Solidity files or reconstruct them from the existing hash-locked archive.

**Interfaces:**
- Produces: one GitHub Actions run and artifact `CurveYield-V27-Ganache-Full-Data-Report-v1-<run-id>`.

- [ ] Create the temporary branch from current `main`.
- [ ] Add exact source reconstruction and SHA-256 verification.
- [ ] Run focused unit tests and syntax checks before the simulation.
- [ ] Invoke the trusted compiler and Ganache fork engine.
- [ ] Invoke the lifecycle runner once.
- [ ] Upload complete or partial artifacts with `if: always()`.
- [ ] Propagate any test, source, compiler, fork, lifecycle, or report-validation failure.

### Task 5: Verification and handoff

**Files:**
- Create: `docs/verification/2026-08-01-v27-ganache-full-v1.json`

**Interfaces:**
- Produces: immutable run, job, artifact, source-hash, test-count, and simulation-result evidence.

- [ ] Read the full GitHub Actions job log and confirm source hashes, test results, compiler result, fork startup, and lifecycle outcome.
- [ ] Download and inspect the artifact.
- [ ] Verify every design data category appears in the generated report or identify the exact terminating operation and missing downstream categories.
- [ ] Record verification metadata without merging the temporary branch.
- [ ] Close the execution-only PR after artifact retrieval.
