# PR #126 Security Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve PR #126 simulation functionality while closing workflow-secret exposure, mutable action pins, unauthenticated RPC-health events, prototype pollution, and upstream RPC error reflection.

**Architecture:** Separate secretless pull-request verification from trusted live-fork execution; validate persistent health events before reduction with exact schemas and authenticated comment provenance; normalize provider failures before they cross the local JSON-RPC boundary. Keep all public simulation contracts and V27 behavior unchanged.

**Tech Stack:** GitHub Actions YAML, Node.js 22 ESM, `node:test`, native `fetch`, GitHub Issues API.

## Global Constraints

- Base commit is exactly `500de7b8752e926f7478feafb81b92586d6364ea`.
- Work only on `orchestrator/pr126-security-reconciliation-v1`.
- No direct `main` modification or branch merge.
- No secret values in source, fixtures, logs, comments, or documentation.
- No public-chain transaction broadcast.
- Test-first: every behavior change requires an observed RED failure before production edits.
- Preserve PR #126 simulation schemas, routing semantics, engine behavior, and V27 lifecycle.
- Pin third-party actions to exact full SHAs.

---

### Task 1: Workflow trust and immutable action pins

**Files:**
- Create: `test/pr126-workflow-trust-v1.test.mjs`
- Modify: `.github/workflows/github-native-sim-ci.yml`
- Modify: `.github/workflows/live-fork-engine-smoke.yml`
- Modify: `.github/workflows/live-fork-upgrade-ci.yml`
- Modify: `.github/workflows/export-v27-hardhat-harness.yml`
- Modify: `.github/workflows/github-native-simulate.yml`
- Modify: `.github/workflows/simulate.yml`

**Interfaces:**
- Consumes: workflow YAML text from the six files above.
- Produces: static invariant that pull-request jobs have no live secret expressions or write permissions and every `uses:` reference is a full SHA pin.

- [ ] **Step 1: Write the failing workflow trust test**

Create a dependency-free Node test that:

```js
const FULL_PIN = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@[0-9a-f]{40}$/;
const LIVE_SECRET = /\$\{\{\s*secrets\.(?:RPC_|SIM_ARCHIVE_|SIM_RPC_HEALTH_|PREFLIGHTSIM_)/;
```

For each changed workflow, assert every non-local `uses:` line matches `FULL_PIN`. For workflows containing `pull_request:`, isolate the pull-request-capable job text and assert it contains neither `LIVE_SECRET` nor `issues: write`. Assert live jobs are triggered only by `workflow_dispatch` or `push` to `main`.

- [ ] **Step 2: Run the test and record RED**

Run:

```bash
node --test test/pr126-workflow-trust-v1.test.mjs
```

Expected: failures for mutable `@v4` pins and pull-request workflows with live secrets or issue-write permission.

- [ ] **Step 3: Apply minimal workflow separation**

Use these pins exactly:

```yaml
actions/checkout@11d5960a326750d5838078e36cf38b85af677262
actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
```

Changes:

- `github-native-sim-ci.yml`: retain secretless `test` on `pull_request`; move `live-fork-smoke` and `v27-full-live-fork` behind trusted `push` to `main` or `workflow_dispatch` conditions; set job-level permissions so only the V27 trusted job has `issues: write`.
- `live-fork-engine-smoke.yml`: remove `pull_request`; allow `workflow_dispatch` and `push` to `main` only.
- `live-fork-upgrade-ci.yml`: keep pull-request verification secretless and read-only; it already has no live secrets.
- `export-v27-hardhat-harness.yml`: remove `pull_request`; allow `workflow_dispatch` and `push` to `main` only because it fetches and reconstructs a trusted execution branch.
- `github-native-simulate.yml` and `simulate.yml`: preserve trusted manual/push behavior, reduce permissions to the narrowest job-level grants, and pin actions.

- [ ] **Step 4: Run workflow test GREEN**

```bash
node --test test/pr126-workflow-trust-v1.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add test/pr126-workflow-trust-v1.test.mjs .github/workflows
git commit -m "fix: separate trusted live workflows and pin actions"
```

### Task 2: Canonical RPC-health events and prototype-safe reducer

**Files:**
- Modify: `packages/runner/test/rpc-health-ledger.test.mjs`
- Modify: `packages/runner/src/rpc-health-ledger.mjs`

**Interfaces:**
- Consumes: `rpc-health-event/v1` event objects.
- Produces: `validateRpcHealthEvent(event)` and a reducer whose `slots` map has a null prototype.

- [ ] **Step 1: Add failing attack-corpus tests**

Add tests asserting rejection of:

```js
['__proto__', 'constructor', 'prototype', 'primary-00', 'primary-08', 'secondary-04', 'legacy-02']
```

Also reject unknown event keys, unknown slot keys, duplicate slot IDs in one session, non-decimal `runId`, invalid pool/slot combinations, oversized actor/reason strings, negative counts, `successes + failures > requests`, and `selected:false` with nonzero requests.

Assert:

```js
Object.getPrototypeOf(state.slots) === null
Object.prototype.polluted === undefined
```

- [ ] **Step 2: Run RED**

```bash
node --test packages/runner/test/rpc-health-ledger.test.mjs
```

Expected: the new invalid-event and prototype tests fail.

- [ ] **Step 3: Implement exact validation**

Export:

```js
export function validateRpcHealthEvent(event) { /* returns frozen canonical copy */ }
```

Use exact-key checks, fixed slot grammar, bounded safe integers, ISO timestamps, decimal run IDs for session events, and null-prototype maps:

```js
const slots = Object.create(null);
```

Call `validateRpcHealthEvent` for every event before reduction and from all event constructors.

- [ ] **Step 4: Run GREEN**

```bash
node --test packages/runner/test/rpc-health-ledger.test.mjs
```

Expected: all ledger tests pass and no global prototype mutation occurs.

- [ ] **Step 5: Commit**

```bash
git add packages/runner/src/rpc-health-ledger.mjs packages/runner/test/rpc-health-ledger.test.mjs
git commit -m "fix: validate RPC health events and prevent prototype pollution"
```

### Task 3: Authenticate issue-backed ledger comments

**Files:**
- Modify: `packages/runner/test/rpc-health-ledger.test.mjs`
- Create or modify: `packages/runner/test/github-rpc-health-store.test.mjs`
- Modify: `packages/runner/src/github-rpc-health-store.mjs`

**Interfaces:**
- Consumes: GitHub issue comments with `user.login`, `body`, and `id`.
- Produces: accepted canonical session events only from `github-actions[bot]`; administrative recovery is appended through the authenticated store API and not accepted from arbitrary historical comments.

- [ ] **Step 1: Add failing provenance tests**

Mock issue comments from:

- `github-actions[bot]` with a valid session event — accepted;
- a normal repository user with the same marker and event — ignored;
- an anonymous/missing user — ignored;
- `github-actions[bot]` with a recovery event — ignored;
- malformed JSON or invalid event schema — ignored;
- duplicate comment IDs — processed once.

Assert an attacker-authored four-event sequence cannot disable a slot and cannot recover a disabled slot.

- [ ] **Step 2: Run RED**

```bash
node --test packages/runner/test/github-rpc-health-store.test.mjs
```

Expected: attacker-authored events are currently accepted and tests fail.

- [ ] **Step 3: Implement comment provenance filtering**

Decode a comment only after checking descriptor-safe fields. Session comments require `comment.user.login === 'github-actions[bot]'`. Historical recovery/disable comments are rejected. Deduplicate by numeric comment ID before reduction. `recover()` remains available only through the authenticated store instance and appends a validated event.

- [ ] **Step 4: Run GREEN**

```bash
node --test packages/runner/test/github-rpc-health-store.test.mjs packages/runner/test/rpc-health-ledger.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/runner/src/github-rpc-health-store.mjs packages/runner/test/github-rpc-health-store.test.mjs packages/runner/test/rpc-health-ledger.test.mjs
git commit -m "fix: authenticate RPC health ledger comments"
```

### Task 4: Redact upstream RPC failure text

**Files:**
- Modify: `packages/runner/test/archive-rpc-pool.test.mjs`
- Modify: `packages/runner/test/live-fork-proxy.test.mjs`
- Modify: `packages/runner/src/archive-rpc-pool.mjs`
- Modify: `packages/runner/src/live-fork-proxy.mjs`

**Interfaces:**
- Consumes: arbitrary provider HTTP/RPC/network errors.
- Produces: stable public error `{ code: 'ARCHIVE_RPC_UNAVAILABLE', failureClass, method }` with message `Archive RPC request failed`.

- [ ] **Step 1: Add failing redaction tests**

Use hostile messages containing:

```text
https://rpc.example/key-secret
Authorization: Bearer leaked-token
C:\Users\runner\secret.txt
/home/runner/private/key
```

Assert neither thrown errors nor proxy response bodies contain any hostile fragment. Assert failure classification remains `quota_or_rate_limit`, `transient_http`, `method_unsupported`, `network_or_timeout`, `rpc_error`, or `invalid_response`.

- [ ] **Step 2: Run RED**

```bash
node --test packages/runner/test/archive-rpc-pool.test.mjs packages/runner/test/live-fork-proxy.test.mjs
```

Expected: public error text currently contains provider messages.

- [ ] **Step 3: Implement stable public errors**

Keep raw messages only inside the local classification frame and never assign them to thrown errors. Throw:

```js
const error = new Error('Archive RPC request failed');
error.code = 'ARCHIVE_RPC_UNAVAILABLE';
error.failureClass = allowedFailureClass;
error.method = safeMethod;
```

In the proxy, emit the same stable message and allowlisted metadata regardless of the caught exception.

- [ ] **Step 4: Run GREEN**

```bash
node --test packages/runner/test/archive-rpc-pool.test.mjs packages/runner/test/live-fork-proxy.test.mjs
```

Expected: all tests pass and hostile strings are absent.

- [ ] **Step 5: Commit**

```bash
git add packages/runner/src/archive-rpc-pool.mjs packages/runner/src/live-fork-proxy.mjs packages/runner/test/archive-rpc-pool.test.mjs packages/runner/test/live-fork-proxy.test.mjs
git commit -m "fix: redact upstream RPC failure text"
```

### Task 5: Full verification and Round 4 intake evidence

**Files:**
- Create: `docs/audit/round4/pr126-reconciliation/2026-08-02-security-repair-manifest-v1.json`
- Create: `docs/audit/round4/pr126-reconciliation/2026-08-02-security-repair-report-v1.md`

**Interfaces:**
- Consumes: final branch head and all test outputs.
- Produces: exact path/blob manifest and Worker 2 intake verdict.

- [ ] **Step 1: Run focused tests**

```bash
node --test test/pr126-workflow-trust-v1.test.mjs packages/runner/test/rpc-health-ledger.test.mjs packages/runner/test/github-rpc-health-store.test.mjs packages/runner/test/archive-rpc-pool.test.mjs packages/runner/test/live-fork-proxy.test.mjs
```

- [ ] **Step 2: Run repository gates**

```bash
npm test
npm run lint
npm run build
find packages scripts test -type f -name '*.mjs' -print0 | xargs -0 -r -n1 node --check
```

- [ ] **Step 3: Verify branch scope**

Compare against `500de7b8752e926f7478feafb81b92586d6364ea`. Reject any unrelated production path, secret literal, generated dependency tree, or direct `main` change.

- [ ] **Step 4: Publish exact manifest and report**

The JSON manifest records every changed path and blob, base SHA, final code SHA, test totals, action pins, and `recommendation: ACCEPT_WITH_REPAIR`. The report states whether trusted live-fork rerun is required before final freeze.

- [ ] **Step 5: Commit evidence**

```bash
git add docs/audit/round4/pr126-reconciliation
git commit -m "docs: publish PR 126 security repair evidence"
```
