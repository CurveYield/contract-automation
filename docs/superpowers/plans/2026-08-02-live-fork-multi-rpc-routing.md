# Live-Fork Multi-RPC Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two single-RPC simulation transports with one configurable live-fork core that prefers Hardhat EDR, retains Ganache, supports ten optional archive RPC slots per chain, and produces a verified full simulation report.

**Architecture:** Add versioned simulation configuration and actions to `packages/protocol`, a shared secret loader/router/health layer to `packages/runner`, engine adapters behind one interface, and one orchestration service used by both runners. GitHub Actions performs red/green tests and the final live-fork acceptance run.

**Tech Stack:** Node.js 22, ECMAScript modules, `node:test`, ethers 6.15.0, Ganache 7.9.2, Hardhat 3.12.0/EDR, GitHub Actions.

## Global Constraints

- Do not expose RPC URLs or credentials in logs, artifacts, reports, issues, or workflow summaries.
- Do not accept RPC URLs, private keys, signed transactions, shell commands, project scripts, or broadcast instructions from simulation manifests.
- Keep all primary and secondary slots optional.
- Support seven primary and three secondary archive secrets for every configured chain.
- Quarantine an endpoint after three qualifying errors in one session.
- Persistently disable an endpoint after four consecutive failed sessions until an administrator recovery event.
- Every safe behavior is configurable; impossible or unsafe combinations fail explicitly.
- Hardhat EDR is preferred; Ganache remains available as an explicit compatibility engine.
- Both execution pathways must use the same implementation.

---

### Task 1: Establish failing contract tests

**Files:**
- Create: `packages/runner/test/archive-rpc-pool.test.mjs`
- Create: `packages/runner/test/live-fork-config.test.mjs`
- Create: `packages/runner/test/live-fork-runtime-actions.test.mjs`
- Create: `.github/workflows/live-fork-upgrade-ci.yml`

**Interfaces:**
- Tests require `loadArchiveRpcSlots`, `createArchiveRpcRouter`, `validateSimulationConfig`, and the new workflow actions.

- [ ] Write tests proving optional slot loading, method routing, equal rotation, three-error quarantine, redaction, engine/fork/refork configuration, and new block/time actions.
- [ ] Add a workflow that runs focused tests, complete tests, lint, and syntax checks on the feature branch and pull request.
- [ ] Push the test-only commit and record the expected failures caused by missing exports and actions.

### Task 2: Add versioned simulation configuration and actions

**Files:**
- Modify: `packages/protocol/src/index.mjs`
- Modify: `packages/github-native-sim/src/schema.mjs`
- Modify: relevant protocol and GitHub-native schema tests.

**Interfaces:**
- Produce `validateSimulationConfig(value)`.
- Extend normalized jobs with `simulation` while preserving legacy `block` behavior.
- Add actions `setNextBlockTimestamp`, `mineAtTimestamp`, `mineUntilTimestamp`, `advanceToBlock`, `setAutomine`, `setIntervalMining`, and `refork`.

- [ ] Implement the minimum validation required by Task 1.
- [ ] Reject secret-bearing and unsafe fields recursively.
- [ ] Run focused and complete tests.

### Task 3: Implement optional secret slots and capability routing

**Files:**
- Create: `packages/runner/src/archive-rpc-pool.mjs`
- Create: `packages/runner/src/archive-rpc-health.mjs`
- Create: `packages/runner/src/archive-rpc-router.mjs`
- Modify: `packages/runner/src/rpc-method-policy.mjs` only if required for exported method classification.

**Interfaces:**
- `loadArchiveRpcSlots({ chainName, legacyEnv, environment, allowLegacyFallback })`.
- `createArchiveRpcRouter({ slots, routing, healthPolicy, fetchImpl, persistentHealth })`.
- Router exposes `request(payload)`, diagnostics, session summary, and redacted slot identities.

- [ ] Implement provider-neutral primary/secondary slot loading.
- [ ] Route trace/debug methods primary-first and standard methods secondary-first by default.
- [ ] Implement equal/weighted round-robin and explicit method overrides.
- [ ] Implement retry, failover, three-error quarantine, and method-specific unsupported capability tracking.
- [ ] Ensure diagnostic serialization contains no URL fragments.
- [ ] Run focused and complete tests.

### Task 4: Replace both transport paths with the shared router

**Files:**
- Create: `packages/runner/src/live-fork-proxy.mjs`
- Modify: `packages/runner/src/fork-rpc-guard.mjs`
- Modify: `packages/github-native-sim/src/fork-rpc-proxy.mjs`
- Modify: `packages/runner/src/run-job.mjs`
- Modify: `packages/github-native-sim/src/run-job-file.mjs`

**Interfaces:**
- `startLiveForkProxy({ slots, blockPolicy, routing, healthPolicy, chainId, ... })`.
- Existing `startForkRpcGuard` and `startForkRpcProxy` remain compatibility wrappers.

- [ ] Resolve and verify initial block identity through eligible providers.
- [ ] Forward every untouched-state request through the live router instead of a one-time state copy.
- [ ] Preserve fail-closed RPC allowlist termination.
- [ ] Add normalized transport evidence to both result formats.
- [ ] Run focused and complete tests.

### Task 5: Add engine adapters and configurable local progression

**Files:**
- Create: `packages/runner/src/engines/ganache.mjs`
- Create: `packages/runner/src/engines/hardhat-edr.mjs`
- Create: `packages/runner/src/engines/index.mjs`
- Modify: `packages/runner/src/engine.mjs`
- Modify: `packages/runner/src/workflow.mjs` if action dispatch requires context changes.
- Modify: `package.json` and lockfile.

**Interfaces:**
- `startForkEngine({ mode, artifacts, workflow, chainId, forkUrl, block, configuration })`.
- Runtime supports arbitrary local mining/time progression and explicit refork.

- [ ] Move existing Ganache startup behind an adapter without deleting functionality.
- [ ] Integrate Hardhat 3 EDR as the preferred adapter using the shared proxy URL.
- [ ] Implement all new local progression actions.
- [ ] Implement configurable refork state strategies that are accurately supported; fail unsupported strategies before mutation.
- [ ] Add engine and final block evidence.
- [ ] Run focused and complete tests.

### Task 6: Add cross-session health ledger and incident output

**Files:**
- Create: `packages/runner/src/rpc-health-ledger.mjs`
- Create: `scripts/update-rpc-health-ledger.mjs`
- Modify: both simulation workflows.
- Add tests under `packages/runner/test/`.

**Interfaces:**
- Pure event reducer derives enabled, quarantined, disabled, and recovered states.
- Workflow script can read an optional ledger and emit an updated event document without secrets.

- [ ] Implement four-consecutive-session disablement and administrator recovery events.
- [ ] Emit prominent structured incident data in the result and workflow summary.
- [ ] Keep the first launch independent of issue-write permissions by supporting artifact-backed health state; GitHub issue publication is an optional trusted post-step.
- [ ] Run focused and complete tests.

### Task 7: Add all optional workflow secrets

**Files:**
- Modify: `.github/workflows/github-native-simulate.yml`
- Modify: `.github/workflows/simulate.yml`

**Interfaces:**
- Export `SIM_ARCHIVE_PRIMARY_<CHAIN>_01..07` and `SIM_ARCHIVE_SECONDARY_<CHAIN>_01..03` for each chain.

- [ ] Add slots without removing existing secrets.
- [ ] Confirm missing secrets become empty environment values and do not fail compile-only or simulations that allow another source.
- [ ] Validate workflow syntax.

### Task 8: Write the simulation authoring and administration guide

**Files:**
- Create: `docs/live-fork-simulation-authoring.md`
- Create: `docs/live-fork-rpc-administration.md`
- Update: `docs/github-native-simulation.md`

- [ ] Document every manifest option and structured action.
- [ ] List all permitted external RPC methods and identify core simulation calls.
- [ ] Distinguish remote archive calls, local EVM calls, local state overlays, and prohibited public broadcasts.
- [ ] Include pinned, latest-at-start, moving-refork, replay, and differential examples.
- [ ] Document slot setup, health behavior, recovery, and report interpretation.

### Task 9: Migrate and run the full V27 simulation

**Files:**
- Create or modify one contained job under `github-native-sim/jobs/` based on the successful V27 Hardhat EDR lifecycle.
- Create a permanent acceptance workflow limited to that contained job and trusted runner files.

- [ ] Rewrite the V27 simulation configuration to select the new EDR engine and live router.
- [ ] Preserve exact Solidity source hashes and all previous lifecycle assertions.
- [ ] Run the full simulation with configured repository secrets.
- [ ] On failure, inspect job logs and partial artifacts, write a regression test, fix the cause, and rerun.
- [ ] Repeat until the report is completed and independently validated.

### Task 10: Final verification

- [ ] Run focused router/config/action tests.
- [ ] Run the complete repository test suite.
- [ ] Run lint, build, syntax validation, workflow validation, and secret-redaction scans.
- [ ] Verify both runners import the shared router and engine resolver.
- [ ] Verify the final live-fork report contains the resolved fork block/hash, engine, RPC slot diagnostics, full lifecycle calls, and passing assertions.
- [ ] Update the draft PR with exact run, artifact, digest, and result statistics.
