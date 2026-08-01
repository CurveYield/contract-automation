# Fail-Closed Fork RPC Method Policy v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce one fail-closed external fork-RPC method allowlist across the Cloudflare-backed and GitHub-native simulation suites.

**Architecture:** A shared policy module owns the canonical method set, error contract, payload validation, and termination coordination. The Cloudflare-backed runner gains a minimal guarded forwarding proxy, while the GitHub-native proxy applies the same policy before its existing local-account, cache, retry, and upstream logic. Both runners race engine startup and workflow execution against the one-shot termination signal.

**Tech Stack:** Node.js 22 ESM, Node HTTP server, Node built-in test runner, existing Ganache and ethers integration.

## Global Constraints

- Do not install or update dependencies.
- Do not compile Solidity as part of implementation verification.
- Apply restrictions only to external fork-RPC traffic, not local Ganache control calls.
- Use JSON-RPC error code `-32601` with stable application code `CALL_NOT_SUPPORTED`.
- Reject a complete batch before any partial processing when one method is unsupported.
- Terminate the full simulation attempt regardless of workflow `continueOnFailure`.
- Preserve existing RPC-secret redaction and failure-report behavior.
- Preserve existing GitHub-native retry, cache, pinned-block, and local-account behavior for supported methods.

---

### Task 1: Specify shared policy behavior with failing tests

**Files:**
- Create: `packages/runner/test/rpc-method-policy.test.mjs`
- Create: `packages/runner/test/fork-rpc-guard.test.mjs`
- Modify: `packages/github-native-sim/test/fork-rpc-proxy.test.mjs`
- Modify: `packages/github-native-sim/test/run-job-file.test.mjs`

**Interfaces:**
- Consumes: future exports from `packages/runner/src/rpc-method-policy.mjs` and `packages/runner/src/fork-rpc-guard.mjs`.
- Produces: executable behavioral requirements for allowlisting, error serialization, batch rejection, termination, and cleanup.

- [ ] **Step 1: Add shared policy tests**

Test every canonical method through `isForkRpcMethodAllowed(method)`, assert pseudo-method strings containing `#` are rejected, and assert `unsupportedForkRpcMethod(payload)` returns the first unsupported method in a mixed batch.

- [ ] **Step 2: Add Cloudflare guard tests**

Use a local Node HTTP upstream server. Assert an allowed `eth_getCode` request is forwarded unchanged. Assert an unsupported `eth_sendTransaction` request returns `-32601`, includes `CALL_NOT_SUPPORTED`, resolves the termination promise, and never reaches upstream. Assert a mixed batch forwards nothing and returns an error for every request ID.

- [ ] **Step 3: Add GitHub-native proxy tests**

Extend the existing proxy test file with the same unsupported single-request and mixed-batch assertions while preserving the prefetch setup.

- [ ] **Step 4: Add runner termination test**

Extend `run-job-file.test.mjs` with an injected proxy termination promise that resolves before a delayed runtime failure. Assert the persisted and thrown error is `CALL_NOT_SUPPORTED`, not the later runtime failure, and assert proxy and engine cleanup.

- [ ] **Step 5: Verify RED without dependencies or compilation**

Run only the new policy/proxy tests that use Node built-ins. Expected: module-not-found or missing-export failures for the new shared policy and guard.

- [ ] **Step 6: Commit tests**

Commit message: `Test fail-closed fork RPC policy`

---

### Task 2: Implement the shared policy and Cloudflare guard

**Files:**
- Create: `packages/runner/src/rpc-method-policy.mjs`
- Create: `packages/runner/src/fork-rpc-guard.mjs`

**Interfaces:**
- Produces:
  - `ALLOWED_FORK_RPC_METHODS: readonly string[]`
  - `isForkRpcMethodAllowed(method: unknown): boolean`
  - `unsupportedForkRpcMethod(payload: unknown): string | null`
  - `RpcCallNotSupportedError`
  - `rpcCallNotSupportedResponse(payload, error): object | object[]`
  - `createRpcPolicyTermination(): { termination, signal, terminate, error }`
  - `raceWithRpcPolicyTermination(operation, termination, options?): Promise<unknown>`
  - `startForkRpcGuard(options): Promise<{ url, diagnostics, termination, signal, close }>`

- [ ] **Step 1: Implement immutable canonical allowlist**

Copy the exact literal methods from the approved design. Do not include `#full` or `#vmTrace` strings.

- [ ] **Step 2: Implement stable error and payload helpers**

Create `RpcCallNotSupportedError` with `code='CALL_NOT_SUPPORTED'`, `rpcCode=-32601`, and `method`. Build JSON-RPC errors containing `simulationTerminated: true`.

- [ ] **Step 3: Implement one-shot termination and race helper**

The termination promise resolves with the policy error exactly once. The race helper must suppress late unhandled rejection and optionally close a late-resolving engine.

- [ ] **Step 4: Implement guarded forwarding proxy**

Parse the body, prevalidate the full request or batch, reject before forwarding, signal termination, flush the error response, and close the listener. Forward allowed payloads unchanged and relay upstream status/body.

- [ ] **Step 5: Run focused GREEN tests**

Run only `rpc-method-policy.test.mjs` and `fork-rpc-guard.test.mjs` using Node's built-in test runner.

- [ ] **Step 6: Commit implementation**

Commit message: `Add shared fail-closed fork RPC guard`

---

### Task 3: Enforce the shared policy in the GitHub-native proxy

**Files:**
- Modify: `packages/github-native-sim/src/fork-rpc-proxy.mjs`

**Interfaces:**
- Consumes shared policy exports from Task 2.
- Extends returned proxy object with `termination` and `signal`.

- [ ] **Step 1: Import shared policy helpers**

Do not duplicate the allowlist or error schema in the GitHub-native package.

- [ ] **Step 2: Prevalidate complete incoming payload**

Run validation immediately after JSON parsing and before local-account handling, cache lookup, retry, or forwarding.

- [ ] **Step 3: Reject and terminate atomically**

Return policy errors for all request IDs, set diagnostic fields, signal termination once, and close the proxy after the response is flushed.

- [ ] **Step 4: Preserve supported behavior**

Do not alter pinned-block prefetch, transient retries, earliest-tag normalization, deterministic local-account overlay, cache behavior, or upstream response handling.

- [ ] **Step 5: Run focused GitHub-native proxy tests**

Use Node built-in tests only. Expected: all existing proxy tests plus new policy tests pass.

- [ ] **Step 6: Commit**

Commit message: `Enforce fork RPC allowlist in GitHub-native proxy`

---

### Task 4: Wire full-attempt termination into both runners

**Files:**
- Modify: `packages/runner/src/run-job.mjs`
- Modify: `packages/github-native-sim/src/run-job-file.mjs`

**Interfaces:**
- Cloudflare runner consumes `startForkRpcGuard` and shared race helper.
- GitHub-native runner consumes the termination signal returned by its existing proxy.

- [ ] **Step 1: Guard the Cloudflare-backed fork URL**

Start `startForkRpcGuard({ upstreamUrl: rpcUrl })`, pass only `guard.url` into Ganache, and store guard diagnostics in success and failure results.

- [ ] **Step 2: Race Cloudflare engine and workflow operations**

Race `startGanacheEngine(...)` and `executeWorkflow(...)` against `guard.termination`. If termination wins during startup, close any engine that resolves late.

- [ ] **Step 3: Race GitHub-native engine and workflow operations**

Apply the same helper to `startGanacheEngine(...)` and `executeWorkflow(...)` using `forkProxy.termination`.

- [ ] **Step 4: Preserve failure artifacts**

Ensure serialized errors retain `CALL_NOT_SUPPORTED`, `-32601`, and method data. Ensure `finally` closes engine and proxy/guard.

- [ ] **Step 5: Run focused runner termination test**

Expected: policy termination wins over the delayed runtime failure and both resources close.

- [ ] **Step 6: Commit**

Commit message: `Terminate simulations on unsupported fork RPC calls`

---

### Task 5: Document the permanent policy

**Files:**
- Create: `docs/rpc-method-policy-v1.md`
- Modify: `docs/setup.md`
- Modify: `docs/github-native-simulation.md`

**Interfaces:**
- Documents the exact method list, pseudo-variant mapping, error contract, batch behavior, and full-attempt termination semantics.

- [ ] **Step 1: Publish the canonical list and error response**

Use the same ordering and wording as the approved design.

- [ ] **Step 2: Link both suite guides**

State that repository RPC secrets must support the allowlisted methods actually needed by a job, and that any unlisted upstream method terminates the run.

- [ ] **Step 3: Commit documentation**

Commit message: `Document fail-closed fork RPC policy v1`

---

### Task 6: Verify and publish

**Files:**
- No production file changes unless verification exposes a defect.

- [ ] **Step 1: Run dependency-free focused tests**

Run the shared policy, guard, and GitHub-native proxy tests with Node 22. Do not install dependencies and do not run compiler integration tests.

- [ ] **Step 2: Run JavaScript syntax validation**

Use `node --check` on every modified `.mjs` file.

- [ ] **Step 3: Inspect branch diff**

Confirm no dependency, lockfile, compiler, Solidity source, deployment, secret, or unrelated audit-suite changes.

- [ ] **Step 4: Open a draft pull request**

Target `main`; explain the fail-closed boundary, error contract, termination behavior, focused verification, and the explicit lack of local dependency installation or Solidity compilation.
