# Audit Phases 4–6 Parallel Orchestration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Every implementation change uses test-first development and an independent reviewer gate.

**Goal:** Complete the final Phase 1–3 acceptance handoff while developing Phases 4–6 with the maximum safe parallelism and one consolidated submission per phase.

**Architecture:** Five isolated workers operate from the repaired Phase 1–3 head. One worker finalizes and reconstructs Phases 1–3. Two independent Phase 4 workers port and repair the existing profile/adaptor and parser work into new branches. Phase 5 and Phase 6 workers may build only versioned profile contracts, normalized schemas, parsers, and inert fixture corpora until predecessor interfaces are accepted. The orchestrator alone integrates branches and opens one draft PR per completed phase.

**Tech stack:** Node.js 22, ECMAScript modules, Node test runner, Cloudflare Workers/R2 dry runs, GitHub Actions, immutable GHCR profile metadata, no submitted-project execution.

## Global Constraints

- Repository: `CurveYield/contract-automation`.
- Starting commit: `6d26ef2fa73d04acb732e1ed1ab2ef385791f724`.
- AWS and every unselected provider remain outside scope.
- GitHub, Cloudflare Workers, Pages, R2, and GHCR are the only current-stack services.
- `AUDIT_EXECUTION_ENABLED=false` remains mandatory.
- No worker may execute uploaded or submitted project code.
- No arbitrary shell, command, script, package command, URL, RPC, image, network destination, key, wallet, signer, transaction, privileged mode, broadcast, or R2 listing hot path.
- Trusted tests use only CurveYield-owned inert fixtures committed to the repository.
- Lite files and behavior remain unchanged.
- Agent branches are internal workspaces, not phase submissions.
- The orchestrator reviews, repairs, combines, and verifies all accepted work.
- Exactly one draft PR is opened per completed phase.
- No branch is merged into `main` and nothing is deployed without explicit user instruction.

---

## Worker 0: Finalize Phases 1–3

**Branch:** `audit-finalize/phases-1-3-v1`

**Owned paths:**
- `docs/audit/specifications-v2/**`
- `docs/audit/reviews/**`
- final acceptance tests under `test/audit-final-*`
- PR metadata and obsolete-workstream cleanup

**Must not modify:** Phase 4–6 packages or Lite files.

- [ ] Resolve GitHub Actions `action_required` state for repair head without adding production secrets.
- [ ] Re-run the complete test and dry-run workflows from the exact head.
- [ ] Record test, syntax, boundary, web-build, and Wrangler evidence.
- [ ] Review the repair diff against the v2 specification line by line.
- [ ] Reconstruct clean consolidated Phase 1, Phase 2, and Phase 3 branches/PRs.
- [ ] Close or clearly supersede obsolete fragmented workstream PRs.
- [ ] Produce a final handoff package and report; do not merge to `main`.

## Worker 1: Phase 4 Profile Contracts and Non-Executing Adapters

**Branch:** `audit-phase4/contracts-adapters-v3`

**Reference-only legacy branches:**
- `audit-phase4/agent-1-profile-contracts`
- `audit-phase4/agent-2-adapters`

**Owned paths:**
- `packages/audit-tool-profile-contracts/**`
- `packages/audit-executor-adapters/**`
- focused tests for those packages

**Interfaces produced:**
- immutable templates and publication contracts for:
  - `solidity-compile-v1`
  - `foundry-test-v1`
  - `foundry-fuzz-v1`
  - `foundry-invariant-v1`
  - `slither-v1`
  - `coverage-forge-v1`
- data-only deterministic invocation-plan schema
- non-executing recorder interface

- [ ] Review the legacy branch diffs rather than blindly cherry-picking them.
- [ ] Preserve exact versions: Solidity `0.8.30`, Foundry/Forge `1.7.1`, Slither `0.11.5` unless an approved specification revision changes them.
- [ ] Require supplied immutable `sha256:` GHCR digests for publication; unpublished templates remain non-runnable.
- [ ] Validate structured allowlisted configuration with unknown-field rejection.
- [ ] Prohibit all forbidden execution, network, secret, wallet, and broadcast concepts recursively.
- [ ] Produce deterministic adapter plans only; never spawn, fetch, install, mount, or execute.
- [ ] Add red/green unit and boundary tests.
- [ ] Submit a report to the orchestrator; do not open a phase PR.

## Worker 2: Phase 4 Parsers and Trusted Fixtures

**Branch:** `audit-phase4/parsers-fixtures-v3`

**Reference-only legacy branches:**
- `audit-phase4/agent-3-parsers`
- `audit-phase4/agent-5-fixtures-ci-boundary`

**Owned paths:**
- `packages/audit-tool-parsers/**`
- `test/fixtures/audit-phase4/**`
- focused parser snapshot tests only

**Interfaces produced:**
- stable `tool-result-v1` normalized result schema
- deterministic parsers for compiler diagnostics, Foundry tests/fuzz/invariants, Slither findings, and Forge coverage
- inert trusted snapshot corpus

- [ ] Reproduce and fix the two known parser failures from the legacy branch before porting anything.
- [ ] Parse only supplied inert text/JSON bytes.
- [ ] Bound input bytes, line count, findings, string lengths, and numeric ranges.
- [ ] Normalize malformed data into stable parser errors without stack traces, secrets, or internal paths.
- [ ] Deterministically order and deduplicate results.
- [ ] Commit only CurveYield-owned inert fixture snapshots.
- [ ] Add red/green tests for all six profiles.
- [ ] Submit a report to the orchestrator; do not edit API/web or open a phase PR.

## Worker 3: Phase 5 Contracts, Schemas, Parsers, and Fixtures

**Branch:** `audit-phase5/contracts-parsers-fixtures-v1`

**Owned paths:**
- `packages/audit-phase5-profile-contracts/**`
- `packages/audit-phase5-parsers/**`
- `test/fixtures/audit-phase5/**`
- focused tests for those paths

**Profiles:**
- `hardhat-test-v1`
- `echidna-v1`
- `mutation-v1`
- `dependency-scan-v1`

**Dependency restriction:** Do not import unfinished Phase 4 implementation packages. Depend only on stable shared protocol primitives already present at the starting commit. The orchestrator will adapt shared interfaces after Phase 4 review.

- [ ] Define strict immutable profile templates, publication requirements, configuration allowlists, resource/network policies, seed/cancellation rules, evidence schemas, and artifact contracts.
- [ ] Define stable normalized result schemas and bounded inert parsers.
- [ ] Add trusted fixture snapshots for success, finding, malformed, timeout, and cancellation cases.
- [ ] No Hardhat, Echidna, mutation engine, package manager, or dependency scanner may be executed in this phase branch.
- [ ] No API/web/catalog integration until Phase 4 catalog interfaces are accepted.
- [ ] Submit a report to the orchestrator; do not open a phase PR.

## Worker 4: Phase 6 Formal Schemas, Parsers, and Fixtures

**Branch:** `audit-phase6/contracts-parsers-fixtures-v1`

**Owned paths:**
- `packages/audit-phase6-profile-contracts/**`
- `packages/audit-phase6-parsers/**`
- `test/fixtures/audit-phase6/**`
- focused tests for those paths

**Profiles:**
- `solidity-smt-v1`
- `halmos-v1`
- `formal-obligations-v1`

**Dependency restriction:** Do not import unfinished Phase 4 or 5 packages. Depend only on stable shared protocol primitives already present at the starting commit.

- [ ] Define immutable profile templates and strict allowlisted configuration.
- [ ] Define normalized proof-obligation, solver-status, model, trace, and counterexample schemas.
- [ ] Bound symbolic expressions, trace depth, model entries, diagnostics, and source references.
- [ ] Normalize solver outcomes including proved, disproved, unknown, timeout, resource-exhausted, and parser-error.
- [ ] Add inert fixture snapshots for obligations, proofs, counterexamples, unknown results, timeouts, and malformed output.
- [ ] Do not execute solc SMTChecker, Halmos, a solver, or submitted source.
- [ ] Submit a report to the orchestrator; do not open a phase PR.

## Orchestrator Integration Gates

### Phase 4

- [ ] Review Worker 1 and Worker 2 diffs independently.
- [ ] Repair rejected findings on their own branches.
- [ ] Create `audit-phase4/integration-v3` from the accepted Phase 1–3 base.
- [ ] Integrate contracts/adapters first, then parsers/fixtures.
- [ ] Add catalog/API/web and boundary integration only after produced interfaces are stable.
- [ ] Run the complete repository test suite, syntax check, boundary command, Audit web build, and Wrangler dry run.
- [ ] Open exactly one Phase 4 draft PR against the finalized Phase 3 branch.

### Phase 5

- [ ] Rebase or port Worker 3 onto accepted Phase 4 integration.
- [ ] Align shared contracts without weakening strict validation.
- [ ] Add catalog/API/web/boundary integration.
- [ ] Run full verification and open exactly one Phase 5 draft PR against Phase 4.

### Phase 6

- [ ] Rebase or port Worker 4 onto accepted Phase 5 integration.
- [ ] Align shared formal result contracts.
- [ ] Add catalog/API/web/boundary integration.
- [ ] Run full verification and open exactly one Phase 6 draft PR against Phase 5.

## Completion Evidence Required Per Phase

A phase is not complete until the orchestrator records fresh evidence for:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run lint
npm run audit:boundary
node scripts/build-audit.mjs
wrangler deploy --dry-run
```

The report must include exact test counts, failures, syntax module count, boundary file/module counts, web-build status, Wrangler status, changed-file count, and confirmation that execution remains disabled.