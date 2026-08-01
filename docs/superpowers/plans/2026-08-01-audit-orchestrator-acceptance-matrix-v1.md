# CurveYield Audit Orchestrator Acceptance Matrix v1

**Repository:** `CurveYield/contract-automation`  
**Orchestration branch:** `audit-orchestration/phases-4-6-v1`  
**Shared worker base:** `6d26ef2fa73d04acb732e1ed1ab2ef385791f724`  
**Ledger:** GitHub issue #49  
**Prepared:** 2026-08-01

## Purpose

This document is the orchestrator-owned review and integration gate for Workers 0–4. It does not authorize deployment, submitted-project execution, dependency installation, compilation, formal-tool execution, production secrets, or a merge to `main`.

A worker branch is accepted only from current source and evidence. Prior agent claims, stale test output, branch names, and issue labels are not proof of completion.

## Runtime Bootstrap Rule

Independent browser-agent runtimes do not inherit another runtime's repository checkout, local worktree, uploaded ZIP, GitHub CLI, or filesystem state.

The following conditions are not automatic stop conditions:

- no pre-mounted repository;
- no pre-created worktree;
- no `gh` executable;
- no access to the orchestrator's uploaded handoff ZIP;
- inability of the container's normal Git transport to resolve `github.com` when the connected GitHub app remains available.

The worker must first attempt an isolated clone of its assigned branch. If normal Git transport is unavailable, it may continue connector-first by retrieving repository source and GitHub state through the connected GitHub app into a unique worker-owned directory. The worker must still verify the assigned remote branch and starting SHA before editing.

`AGENTS.md` must be read when present. If it is absent at the assigned ref, the worker records the absence and continues under its original prompt, assigned issue, orchestration plan, and repository specifications.

## Non-Negotiable Security State

Every accepted branch must preserve all of the following:

- `AUDIT_EXECUTION_ENABLED=false`;
- no submitted or uploaded project execution;
- no arbitrary shell commands, scripts, package commands, URLs, RPCs, images, binaries, network destinations, wallets, signers, keys, transactions, broadcasts, or privileged mode;
- no AWS;
- no production-secret additions to make PR CI run;
- no invented GHCR digest;
- no changes to CurveYield Lite;
- only CurveYield-owned inert fixtures;
- no deployment and no merge to `main`.

## Worker Status Ledger

| Worker | Issue | Branch | Scope | Acceptance dependency |
|---|---:|---|---|---|
| Worker 0 | #44 | `audit-finalize/phases-1-3-v1` | Final Phase 1–3 acceptance, workflow-state analysis, clean PR chain | Reviewed independently before Phase 4 submission base is selected |
| Worker 1 | #45 | `audit-phase4/contracts-adapters-v3` | Phase 4 immutable profile contracts and non-executing plans | Must be reviewed before Worker 2 is integrated |
| Worker 2 | #46 | `audit-phase4/parsers-fixtures-v3` | Phase 4 inert parsers and fixtures | Integrates only after Worker 1 interfaces are accepted |
| Worker 3 | #47 | `audit-phase5/contracts-parsers-fixtures-v1` | Phase 5 contracts, parsers, fixtures | Must not import unfinished Phase 4 packages |
| Worker 4 | #48 | `audit-phase6/contracts-parsers-fixtures-v1` | Phase 6 formal contracts, parsers, fixtures | Must not import unfinished Phase 4 or 5 packages |

## Universal Worker Acceptance Gate

A worker report is incomplete unless it contains:

1. runtime/session identity and isolated workspace path;
2. assigned branch, starting SHA, final SHA, and remote drift result;
3. start and finish timestamps in UTC and America/Los_Angeles;
4. all changed files and a purpose for each;
5. confirmation that no forbidden or non-owned path changed;
6. red-test evidence for every behavior repair or addition;
7. green-test or permissible non-compiling static evidence from the exact final tree;
8. explicit checks blocked by the no-compile/no-download restriction;
9. every commit SHA pushed to the assigned branch;
10. security-boundary confirmation;
11. unresolved risks and cross-worker interface dependencies;
12. one recommendation: `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT`.

Immediate rejection triggers:

- fabricated digest, test result, workflow result, version, or source;
- hidden dependency installation or compilation;
- execution of submitted source or an external audit/formal tool;
- edits outside assigned ownership without prior orchestrator authorization;
- an execution-capable adapter or recorder;
- arbitrary network, command, image, credential, wallet, transaction, or broadcast fields;
- changes to Lite;
- production-secret additions;
- deployment or merge to `main`.

## Worker 0 Review Gate

Worker 0 is accepted only when the final report distinguishes the exact cause of each `action_required` workflow conclusion from actual test failure. The report must not infer Actions log details that were not retrieved.

Required review points:

- PR #43 exact head and diff are reviewed against all Phase 1–3 v2 specifications;
- unsupported implementation claims are identified and corrected or explicitly carried as residual risks;
- workflow approval gating, permissions, environments, secrets, configuration failures, and test failures are distinguished;
- no production credential or weakened policy is introduced;
- the final Phase 1 → Phase 2 → Phase 3 consolidated branch/PR chain is restart-safe and unambiguous;
- obsolete fragmented workstreams are not closed until replacements exist;
- every available permissible verification count is recorded;
- checks requiring compilation or dependency downloads are labeled blocked rather than represented as passing.

Worker 0 does not own Phase 4–6 implementation.

## Worker 1 Review Gate

The orchestrator reviews Worker 1 before any Phase 4 parser integration.

Required profile set:

- `solidity-compile-v1`;
- `foundry-test-v1`;
- `foundry-fuzz-v1`;
- `foundry-invariant-v1`;
- `slither-v1`;
- `coverage-forge-v1`.

Required contract properties:

- exact version fields remain explicit and stable;
- publication requires a caller-supplied immutable `sha256:` GHCR digest;
- templates without real immutable digests are explicitly unpublished and non-runnable;
- configuration is allowlisted and unknown fields are rejected recursively, including inside arrays;
- serialization and ordered argument tokens are deterministic;
- resource, network, seed, timeout, cancellation, artifact, and evidence policy identities are data-only;
- no field can express an arbitrary command, executable, URL, RPC, package install, host mutation, credential, wallet, signer, transaction, broadcast, or privileged mode;
- the recorder can retain or inspect plans but has no process, network, filesystem-mutation, or container execution path.

Legacy branches are reference-only. Blind merges or unreviewed cherry-picks are rejection conditions.

## Worker 2 Review Gate

Worker 2 must independently reproduce and repair the two known legacy parser defects:

1. compiler diagnostics incorrectly classified as `parser_error` rather than `tool_failure`;
2. invalid duration input incorrectly classified as `invalid_integer` rather than `invalid_duration`.

Required parser properties:

- parsers accept only explicitly supplied inert text or JSON bytes;
- no parser imports, executes, compiles, spawns, fetches, or inspects submitted source;
- schema versions are explicit;
- malformed inputs become stable sanitized parser-error results;
- no stack trace, host path, secret, or machine-specific detail escapes;
- input bytes, lines, findings, cases, traces, strings, source references, numbers, and nested collections are bounded;
- sorting and deduplication are deterministic;
- fixtures are CurveYield-owned and cover success, finding/failure, malformed, timeout, cancellation, exhaustion where applicable, and truncation.

Worker 2 may not modify profile contracts, adapters, API, web, workflows, or boundary scripts.

## Worker 3 Review Gate

Worker 3 must cite official primary release sources and retrieval dates for every Phase 5 version decision.

Required profiles:

- `hardhat-test-v1`;
- `echidna-v1`;
- `mutation-v1`;
- `dependency-scan-v1`.

Acceptance requires:

- no floating tags, `latest`, semver ranges, unofficial mirrors where an official source exists, or invented digests;
- unpublished/non-runnable state until a real immutable digest is supplied;
- strict recursive configuration rejection;
- deterministic bounded inert parsers;
- inert fixtures for success, findings, malformed, timeout, cancellation, exhaustion where applicable, and truncation;
- no import from unfinished Phase 4 packages;
- no API, web, catalog, workflow, or deployment integration;
- no execution of Hardhat, Echidna, mutation engines, package managers, dependency scanners, or submitted source.

## Worker 4 Review Gate

Worker 4 must cite official primary sources and retrieval dates for all compiler, tool, solver, and compatibility claims.

Required profiles:

- `solidity-smt-v1`;
- `halmos-v1`;
- `formal-obligations-v1`.

Required normalized outcomes:

- `proved`;
- `disproved`;
- `unknown`;
- `timeout`;
- `resource_exhausted`;
- `cancelled`;
- `parser_error`.

Acceptance requires:

- explicit normalized obligation, assertion, outcome, model, trace, counterexample, source-reference, and warning contracts;
- bounded symbolic expressions, obligations, assertions, trace depth, model entries, diagnostics, strings, numbers, source references, and nested collections;
- strict recursive configuration rejection;
- deterministic bounded inert parsers;
- fixtures for proof, counterexample, unknown, timeout, exhaustion where applicable, cancellation, malformed, and truncation;
- no imports from unfinished Phase 4 or 5 packages;
- no solver, compiler, SMTChecker, Halmos, container, package manager, or submitted-source execution.

## Phase 4 Integration Order

The orchestrator performs Phase 4 integration only after Worker 0 establishes the accepted Phase 3 base and Workers 1 and 2 pass independent review.

Order:

1. freeze and record accepted Worker 1 head;
2. review every changed file against Worker 1 ownership;
3. integrate Worker 1 contracts/adapters into `audit-phase4/integration-v3`;
4. freeze and record accepted Worker 2 head;
5. review every changed file against Worker 2 ownership;
6. integrate Worker 2 parsers/fixtures;
7. reconcile shared schemas without weakening validation or execution boundaries;
8. add orchestrator-owned catalog/API/web/boundary integration only after interfaces stabilize;
9. perform permissible fresh verification and record all blocked compile/download checks;
10. open exactly one Phase 4 draft PR against the finalized Phase 3 branch.

No worker branch is itself a phase submission.

## Phase 5 and Phase 6 Integration Order

Phase 5:

1. accept Phase 4 integration;
2. port or rebase the reviewed Worker 3 tree onto the accepted Phase 4 head;
3. reconcile shared interfaces without weakening validation;
4. add orchestrator-owned integration surfaces;
5. verify and open exactly one Phase 5 draft PR against Phase 4.

Phase 6:

1. accept Phase 5 integration;
2. port or rebase the reviewed Worker 4 tree onto the accepted Phase 5 head;
3. reconcile formal-result contracts without weakening bounds;
4. add orchestrator-owned integration surfaces;
5. verify and open exactly one Phase 6 draft PR against Phase 5.

## Evidence Classification

Every reported check must be classified as one of:

- `PASS — fresh exact-head evidence`;
- `FAIL — fresh exact-head evidence`;
- `BLOCKED — prohibited by no-compile/no-download rule`;
- `BLOCKED — unavailable runtime capability`;
- `NOT APPLICABLE`.

Stale CI, previous-agent notes, or tests from another SHA may be supporting context but cannot be classified as a fresh pass.

## Orchestrator Completion State

The orchestrator may recommend a phase only as:

- `ACCEPT`: all required source review and permissible evidence pass, with no unresolved material security defect;
- `ACCEPT WITH REPAIR`: scope is fundamentally valid but identified defects require a bounded repair before integration;
- `REJECT`: ownership, security, determinism, source integrity, or evidence requirements are materially violated.

This matrix is subordinate to explicit user instructions and the repository's approved v2 specifications. Where they conflict, the stricter security boundary controls unless the user explicitly changes scope.
