# Fail-Closed Fork RPC Method Policy v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Enforce one fail-closed external fork-RPC allowlist across both simulation suites.

**Architecture:** A shared policy module owns validation, errors, and termination. A Cloudflare-runner guard and the existing GitHub-native proxy enforce it before upstream traffic. Both runners race execution against policy termination.

**Tech Stack:** Node.js 22 ESM, Node HTTP server, Node built-in test runner.

## Global Constraints

- Do not install dependencies.
- Do not compile Solidity.
- Restrict only external fork-RPC calls, not local Ganache controls.
- Use JSON-RPC `-32601` and `CALL_NOT_SUPPORTED`.
- Reject mixed batches before partial execution.
- Preserve the current-main hash-locked genesis/metadata fixture.

### Task 1: Tests first

- [x] Add exact allowlist and error-contract tests.
- [x] Add Cloudflare guard forwarding and rejection tests.
- [x] Add GitHub-native single and mixed-batch rejection tests.
- [x] Add runner-level termination and late-engine cleanup tests.
- [x] Observe the expected missing-module red failure before implementation.

### Task 2: Shared policy and Cloudflare guard

- [x] Add immutable canonical method set.
- [x] Add stable unsupported-call error serialization.
- [x] Add one-shot abort/termination controller.
- [x] Add guarded forwarding proxy with full-payload prevalidation.

### Task 3: GitHub-native integration

- [x] Validate before metadata, account overlays, cache, retries, or upstream forwarding.
- [x] Abort in-flight external requests after termination.
- [x] Preserve local metadata/genesis, prefetch, cache, and retry behavior for supported methods.

### Task 4: Runner integration

- [x] Route Cloudflare runner fork traffic through the guard.
- [x] Race both runners' engine startup and workflow execution against termination.
- [x] Serialize `rpcCode` and rejected `method` in failure reports.
- [x] Close proxies and engines in all terminal paths.

### Task 5: Documentation and verification

- [x] Publish the v2 method-policy document.
- [x] Link both suite guides.
- [ ] Run focused dependency-free tests.
- [ ] Run syntax validation on modified modules.
- [ ] Confirm the final diff contains no dependency, lockfile, Solidity, secret, or unrelated deployment changes.
- [ ] Open a draft pull request against current `main`.