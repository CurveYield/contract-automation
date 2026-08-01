# Audit GitHub Direct Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `github-direct-audit-v1` as a separate GitHub App/GitHub Actions and repository-native Audit control plane that operates with all Cloudflare and R2 credentials absent while leaving `cloudflare-audit-v1` unchanged.

**Architecture:** Implement a pure versioned protocol first, then a pure repository-ledger mutation planner, a dependency-injected GitHub adapter, and an execution-disabled runner. Add a narrowly triggered workflow, short-lived-user-auth CLI, bounded reporting/artifact publication, and Phase 10 hardening only after the lower layers pass cross-mode and static capability gates. GitHub Actions coordinates trusted fixtures and future signed executor calls; it never becomes the hostile-code sandbox.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, `node:assert/strict`, `node:crypto`, GitHub REST semantics through an injected transport, GitHub Actions YAML with commit-pinned official Actions, existing CurveYield Audit profile/parser/result/evidence/report contracts.

## Global Constraints

- The direct mode ID is exactly `github-direct-audit-v1`; the existing mode remains `cloudflare-audit-v1`.
- No automatic fallback, proxying, migration, or shared mutable state between modes.
- Direct-mode production paths must not import from `apps/audit-api`, `packages/audit-r2-store`, or `infra/audit-cloudflare`.
- Direct mode must operate with every Cloudflare/R2 credential absent.
- Use the existing dedicated CurveYield Audit GitHub App identity; do not create a second permanent App key.
- Prefer per-run `GITHUB_TOKEN`; mint a short-lived installation token only for an approved operation that requires it.
- Never expose the App private key or installation token to browser code, request fields, CLI arguments, repository variables, untrusted PR jobs, logs, Checks, comments, reports, or artifacts.
- Every job binds to exact repository ID, installation ID, canonical repository name, and 40-character target commit SHA before admission.
- The control branch is exactly `audit-direct/control-v1` and writes are confined to `.audit-direct/v1/**`.
- Request/event/result/report records are immutable; current pointers and deterministic indexes use current blob-SHA compare-and-swap.
- Submitted-project execution remains disabled. Non-fixture jobs stop at `awaiting_executor` or `execution_plane_unavailable`.
- GitHub Actions is coordination infrastructure, not the hostile-code sandbox.
- Do not use `pull_request_target` to check out or execute untrusted pull-request code.
- No request-selected command, script, workflow, Action, runner label, image, URL, RPC endpoint, credential, wallet, calldata, signed transaction, broadcast, or deployment target.
- No CurveYield Lite changes.
- Use test-first development: demonstrate focused red failure before each implementation change.
- During implementation under the current project restrictions, do not install/download dependencies, compile, build, deploy, approve workflows, or enable execution. Use direct Node tests and static inspection.

---

## Planned File Map

### Pure protocol

- Create `packages/audit-github-direct-protocol/package.json` — private ESM workspace package metadata.
- Create `packages/audit-github-direct-protocol/src/constants.mjs` — frozen mode, schema, state, limit, and capability constants.
- Create `packages/audit-github-direct-protocol/src/errors.mjs` — stable bounded `DirectValidationError`.
- Create `packages/audit-github-direct-protocol/src/objects.mjs` — plain-object, dense-array, exact-key, scalar, recursive forbidden-field, clone, and freeze helpers.
- Create `packages/audit-github-direct-protocol/src/canonical.mjs` — deterministic serialization, SHA-256 digests, and IDs.
- Create `packages/audit-github-direct-protocol/src/request.mjs` — request validator.
- Create `packages/audit-github-direct-protocol/src/state.mjs` — event/current-state and transition validators.
- Create `packages/audit-github-direct-protocol/src/publication.mjs` — capability/result/report manifest validators.
- Create `packages/audit-github-direct-protocol/src/index.mjs` — public exports only.
- Create `packages/audit-github-direct-protocol/test/*.test.mjs` — focused unit, mutation, and hostile-boundary tests.

### Pure ledger planner

- Create `packages/audit-github-direct-ledger/package.json`.
- Create `packages/audit-github-direct-ledger/src/paths.mjs` — deterministic `.audit-direct/v1/**` paths.
- Create `packages/audit-github-direct-ledger/src/plans.mjs` — immutable create and compare-and-swap mutation plans.
- Create `packages/audit-github-direct-ledger/src/state-machine.mjs` — allowed state transitions.
- Create `packages/audit-github-direct-ledger/src/indexes.mjs` — server-owned job-index mutation.
- Create `packages/audit-github-direct-ledger/src/index.mjs`.
- Create `packages/audit-github-direct-ledger/test/*.test.mjs`.

### GitHub adapter

- Create `packages/audit-github-direct-adapter/package.json`.
- Create `packages/audit-github-direct-adapter/src/permissions.mjs` — operation-specific permission manifest.
- Create `packages/audit-github-direct-adapter/src/errors.mjs` — bounded GitHub error normalization and redaction.
- Create `packages/audit-github-direct-adapter/src/adapter.mjs` — dependency-injected GitHub operations.
- Create `packages/audit-github-direct-adapter/src/reporting.mjs` — idempotent Check/status/comment publication.
- Create `packages/audit-github-direct-adapter/src/artifacts.mjs` — bounded artifact metadata retrieval.
- Create `packages/audit-github-direct-adapter/src/index.mjs`.
- Create `packages/audit-github-direct-adapter/test/*.test.mjs` with an inert fake transport.

### Execution-disabled runner

- Create `packages/audit-github-direct-runner/package.json`.
- Create `packages/audit-github-direct-runner/src/admission.mjs` — exact request/source/profile/policy/capability admission.
- Create `packages/audit-github-direct-runner/src/fixture-policy.mjs` — repository-owned fixture allowlist contract.
- Create `packages/audit-github-direct-runner/src/run.mjs` — execution-disabled orchestration.
- Create `packages/audit-github-direct-runner/src/publication.mjs` — normalized result/report publication planning.
- Create `packages/audit-github-direct-runner/src/index.mjs`.
- Create `packages/audit-github-direct-runner/test/*.test.mjs`.

### CLI and workflow

- Create `apps/audit-github-direct-cli/package.json`.
- Create `apps/audit-github-direct-cli/src/arguments.mjs` — strict command parsing.
- Create `apps/audit-github-direct-cli/src/auth.mjs` — short-lived user-authorization interface with injected device-flow transport.
- Create `apps/audit-github-direct-cli/src/client.mjs` — typed submit/status/report/cancel/capabilities client.
- Create `apps/audit-github-direct-cli/src/cli.mjs` — user-facing command entry point.
- Create `apps/audit-github-direct-cli/test/*.test.mjs`.
- Create `.github/workflows/audit-direct-v1.yml` — least-privilege, bounded, exact-request workflow.

### Cross-cutting tests and documentation

- Create `test/audit-github-direct-cross-mode-v1.test.mjs`.
- Create `test/audit-github-direct-static-boundary-v1.test.mjs`.
- Create `test/audit-github-direct-workflow-v1.test.mjs`.
- Create `test/audit-github-direct-untrusted-pr-v1.test.mjs`.
- Create `docs/audit/github-direct/README_v1.md`.
- Create `docs/audit/github-direct/PERMISSIONS_v1.md`.
- Create `docs/audit/github-direct/INCIDENT_AND_RECOVERY_v1.md`.

---

### Task 1: Establish the Direct-Mode Boundary and Package Contract

**Files:**
- Create: `test/audit-github-direct-cross-mode-v1.test.mjs`
- Create: `test/audit-github-direct-static-boundary-v1.test.mjs`
- Create: `packages/audit-github-direct-protocol/package.json`
- Create: `packages/audit-github-direct-protocol/src/index.mjs`

**Interfaces:**
- Consumes: Existing repository file layout and `packages/audit-protocol/src/index.mjs` for naming conventions only.
- Produces: Importable package `@curveyield/audit-github-direct-protocol` and static boundary expectations used by every later task.

- [ ] **Step 1: Write the failing cross-mode and static-boundary tests**

```js
// test/audit-github-direct-cross-mode-v1.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECT_MODE,
  validateDirectRequest
} from '../packages/audit-github-direct-protocol/src/index.mjs';

test('GitHub Direct has a distinct non-fallback mode identifier', () => {
  assert.equal(DIRECT_MODE, 'github-direct-audit-v1');
  assert.throws(
    () => validateDirectRequest({ mode: 'cloudflare-audit-v1' }),
    (error) => error.code === 'invalid_mode' && error.path === '$.mode'
  );
});
```

```js
// test/audit-github-direct-static-boundary-v1.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const roots = [
  'packages/audit-github-direct-protocol/src',
  'packages/audit-github-direct-ledger/src',
  'packages/audit-github-direct-adapter/src',
  'packages/audit-github-direct-runner/src',
  'apps/audit-github-direct-cli/src'
];

async function filesUnder(root) {
  try {
    return (await readdir(root, { recursive: true }))
      .filter((path) => path.endsWith('.mjs'))
      .map((path) => `${root}/${path}`);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

test('direct-mode production sources never import Cloudflare/R2 production modules', async () => {
  const files = (await Promise.all(roots.map(filesUnder))).flat();
  assert.ok(files.length > 0);
  for (const path of files) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /apps\/audit-api|audit-r2-store|infra\/audit-cloudflare/);
  }
});
```

- [ ] **Step 2: Run tests to verify red failure**

Run:

```bash
node --test test/audit-github-direct-cross-mode-v1.test.mjs test/audit-github-direct-static-boundary-v1.test.mjs
```

Expected: FAIL because the direct protocol package and exports do not exist.

- [ ] **Step 3: Add minimal workspace package and frozen mode export**

```json
{
  "name": "@curveyield/audit-github-direct-protocol",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.mjs"
}
```

```js
// packages/audit-github-direct-protocol/src/index.mjs
export const DIRECT_MODE = 'github-direct-audit-v1';

export function validateDirectRequest(value) {
  if (value?.mode !== DIRECT_MODE) {
    const error = new Error('$.mode must select github-direct-audit-v1');
    error.code = 'invalid_mode';
    error.path = '$.mode';
    throw error;
  }
  return Object.freeze({ ...value });
}
```

- [ ] **Step 4: Run tests to verify the initial boundary passes**

Run the command from Step 2.

Expected: PASS for the mode boundary; static scan sees the created direct source and no forbidden imports.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-github-direct-protocol test/audit-github-direct-cross-mode-v1.test.mjs test/audit-github-direct-static-boundary-v1.test.mjs
git commit -m "test(audit): lock GitHub Direct mode boundary"
```

---

### Task 2: Implement the Pure Versioned Direct Protocol

**Files:**
- Create: `packages/audit-github-direct-protocol/src/constants.mjs`
- Create: `packages/audit-github-direct-protocol/src/errors.mjs`
- Create: `packages/audit-github-direct-protocol/src/objects.mjs`
- Create: `packages/audit-github-direct-protocol/src/canonical.mjs`
- Create: `packages/audit-github-direct-protocol/src/request.mjs`
- Create: `packages/audit-github-direct-protocol/src/state.mjs`
- Create: `packages/audit-github-direct-protocol/src/publication.mjs`
- Modify: `packages/audit-github-direct-protocol/src/index.mjs`
- Create: `packages/audit-github-direct-protocol/test/protocol-v1.test.mjs`
- Create: `packages/audit-github-direct-protocol/test/hostile-boundary-v1.test.mjs`
- Create: `packages/audit-github-direct-protocol/test/mutation-corpus-v1.test.mjs`

**Interfaces:**
- Consumes: `assertProfileId` semantics from `packages/audit-protocol/src/index.mjs`; Node `createHash` only.
- Produces:
  - `DIRECT_MODE`
  - `DIRECT_SCHEMA_VERSIONS`
  - `DIRECT_CAPABILITIES`
  - `validateDirectRequest(value)`
  - `validateDirectEvent(value)`
  - `validateDirectState(value)`
  - `validateDirectCapability(value)`
  - `validateDirectResultManifest(value)`
  - `validateDirectReportIndex(value)`
  - `canonicalizeDirectValue(value)`
  - `digestDirectValue(value)`
  - `createDirectJobId(request)`
  - `createDirectEventId(event)`
  - `DirectValidationError`

- [ ] **Step 1: Write failing request, lifecycle, publication, and hostile-object tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECT_CAPABILITIES,
  createDirectJobId,
  digestDirectValue,
  validateDirectRequest
} from '../src/index.mjs';

const request = {
  schemaVersion: 'audit-github-direct-request-v1',
  mode: 'github-direct-audit-v1',
  jobId: 'ajob_11111111111111111111111111111111',
  repository: {
    repositoryId: 123,
    fullName: 'CurveYield/contract-automation',
    installationId: 456,
    targetCommitSha: 'a'.repeat(40)
  },
  requester: { login: 'James-Nexus', userId: 274642662 },
  profiles: [{
    profileId: 'solidity-compile-v1',
    profileVersion: 1,
    parserVersion: 'solidity-compile-parser-v1',
    resultContractVersion: 'tool-result-v1'
  }],
  policyVersion: 'audit-direct-policy-v1',
  reporting: { checkRun: true, issueNumber: null, pullRequestNumber: null },
  execution: { requested: false, gateVersion: 'audit-execution-gate-v1' },
  createdAt: '2026-08-01T15:30:00.000Z'
};

test('valid request is canonical, frozen, exact-SHA bound, and digest stable', () => {
  const validated = validateDirectRequest(request);
  assert.equal(validated.repository.targetCommitSha, 'a'.repeat(40));
  assert.ok(Object.isFrozen(validated));
  assert.equal(digestDirectValue(validated), digestDirectValue(structuredClone(request)));
  assert.match(createDirectJobId(request), /^ajob_[0-9a-f]{32}$/);
  assert.deepEqual(DIRECT_CAPABILITIES, {
    mode: 'github-direct-audit-v1',
    cloudflareRequired: false,
    cloudflareUsed: false,
    r2Required: false,
    githubAppRequired: true,
    githubActionsRequired: true,
    submittedExecutionEnabled: false,
    hostileCodeIsolationProvided: false
  });
});

test('request rejects mutable refs, Cloudflare fields, commands, URLs, and keys', () => {
  for (const [field, value] of [
    ['branch', 'main'],
    ['cloudflareAccountId', 'account'],
    ['command', 'npm test'],
    ['rpcUrl', 'https://example.invalid'],
    ['privateKey', `0x${'1'.repeat(64)}`]
  ]) {
    const mutated = structuredClone(request);
    mutated[field] = value;
    assert.throws(() => validateDirectRequest(mutated), (error) => error.code === 'forbidden_field' || error.code === 'unknown_field');
  }
});
```

Hostile tests must include custom prototypes, class instances, accessors, sparse arrays, symbols, cycles, negative zero, `NaN`, `Infinity`, unsafe integers, oversized fields/collections, control characters, and forbidden normalized key spellings.

- [ ] **Step 2: Run tests and capture red counts**

```bash
node --test packages/audit-github-direct-protocol/test/*.test.mjs
```

Expected: FAIL because schemas, canonicalization, digest, state, publication, and defensive boundaries are absent.

- [ ] **Step 3: Implement stable errors and exact constants**

```js
// errors.mjs
export class DirectValidationError extends Error {
  constructor(code, message, path = '$') {
    super(message);
    this.name = 'DirectValidationError';
    this.code = code;
    this.path = path;
  }
}
```

```js
// constants.mjs
export const DIRECT_MODE = 'github-direct-audit-v1';
export const DIRECT_CONTROL_BRANCH = 'audit-direct/control-v1';
export const DIRECT_STATES = Object.freeze([
  'requested', 'validating', 'admitted', 'awaiting_executor',
  'running_fixture', 'collecting_results', 'completed', 'failed',
  'cancelled', 'timed_out', 'policy_rejected', 'execution_plane_unavailable'
]);
export const DIRECT_CAPABILITIES = Object.freeze({
  mode: DIRECT_MODE,
  cloudflareRequired: false,
  cloudflareUsed: false,
  r2Required: false,
  githubAppRequired: true,
  githubActionsRequired: true,
  submittedExecutionEnabled: false,
  hostileCodeIsolationProvided: false
});
```

- [ ] **Step 4: Implement defensive canonicalization and hashing**

Use ordinary/null-prototype object checks, dense ordinary arrays, exact keys, safe integers, bounded strings, cycle detection, lexicographically sorted object keys, recursive frozen clones, and JSON serialization that rejects unsupported values.

```js
// canonical.mjs
import { createHash } from 'node:crypto';
import { cloneCanonicalDirectValue } from './objects.mjs';

export function canonicalizeDirectValue(value) {
  return JSON.stringify(cloneCanonicalDirectValue(value));
}

export function digestDirectValue(value) {
  return `sha256:${createHash('sha256').update(canonicalizeDirectValue(value)).digest('hex')}`;
}
```

- [ ] **Step 5: Implement exact validators and deterministic IDs**

Require all documented keys and reject extras. Validate canonical UTC timestamps, GitHub IDs as positive safe integers, canonical repository names, exact lowercase 40-hex commit SHA, bounded reporting destinations, exact profile identities, `execution.requested === false`, and truthful capabilities.

Derive IDs from a domain-separated digest:

```js
export function createDirectJobId(request) {
  const digest = digestDirectValue({ domain: 'audit-direct-job-v1', request });
  return `ajob_${digest.slice('sha256:'.length, 'sha256:'.length + 32)}`;
}
```

- [ ] **Step 6: Run the full protocol suite**

```bash
node --test packages/audit-github-direct-protocol/test/*.test.mjs test/audit-github-direct-cross-mode-v1.test.mjs
```

Expected: all request/state/event/capability/result/report, mutation, and hostile-boundary tests PASS with byte-stable output.

- [ ] **Step 7: Commit**

```bash
git add packages/audit-github-direct-protocol test/audit-github-direct-cross-mode-v1.test.mjs
git commit -m "feat(audit): add pure GitHub Direct protocol v1"
```

---

### Task 3: Implement the Repository-Native Ledger Planner

**Files:**
- Create: `packages/audit-github-direct-ledger/package.json`
- Create: `packages/audit-github-direct-ledger/src/paths.mjs`
- Create: `packages/audit-github-direct-ledger/src/state-machine.mjs`
- Create: `packages/audit-github-direct-ledger/src/indexes.mjs`
- Create: `packages/audit-github-direct-ledger/src/plans.mjs`
- Create: `packages/audit-github-direct-ledger/src/index.mjs`
- Create: `packages/audit-github-direct-ledger/test/paths-v1.test.mjs`
- Create: `packages/audit-github-direct-ledger/test/state-machine-v1.test.mjs`
- Create: `packages/audit-github-direct-ledger/test/idempotency-v1.test.mjs`

**Interfaces:**
- Consumes: Protocol validators, canonicalization, digest, IDs, and states from Task 2.
- Produces:
  - `directJobPaths(jobId)`
  - `assertDirectTransition(currentState, nextState)`
  - `createDirectJobMutationPlan({ request, jobsIndex, jobsIndexBlobSha })`
  - `createDirectTransitionPlan({ currentState, currentBlobSha, event, jobsIndex, jobsIndexBlobSha })`
  - `createDirectResultPublicationPlan(...)`
  - `createDirectReportPublicationPlan(...)`
  - mutation plans containing only typed `create_immutable` and `compare_and_swap` operations.

- [ ] **Step 1: Write failing path, transition, conflict, and retry tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directJobPaths,
  createDirectJobMutationPlan
} from '../src/index.mjs';

test('job paths remain confined to the direct control prefix', () => {
  assert.deepEqual(directJobPaths('ajob_11111111111111111111111111111111'), {
    request: '.audit-direct/v1/jobs/ajob_11111111111111111111111111111111/request_v1.json',
    eventsPrefix: '.audit-direct/v1/jobs/ajob_11111111111111111111111111111111/events',
    current: '.audit-direct/v1/jobs/ajob_11111111111111111111111111111111/status/CURRENT_v1.json',
    result: '.audit-direct/v1/jobs/ajob_11111111111111111111111111111111/results/result_manifest_v1.json',
    report: '.audit-direct/v1/jobs/ajob_11111111111111111111111111111111/reports/report_index_v1.json',
    jobsIndex: '.audit-direct/v1/indexes/jobs_v1.json'
  });
});
```

Test empty-index creation, stale blob SHA, duplicate request, replay of the same operation ID, partial application followed by retry, terminal-state mutation rejection, and event sequence gaps.

- [ ] **Step 2: Run tests and verify red failure**

```bash
node --test packages/audit-github-direct-ledger/test/*.test.mjs
```

Expected: FAIL because ledger interfaces are absent.

- [ ] **Step 3: Implement paths and state transitions**

Allowed transitions are explicit. For example:

```js
const ALLOWED = Object.freeze({
  requested: new Set(['validating', 'cancelled']),
  validating: new Set(['admitted', 'policy_rejected', 'failed']),
  admitted: new Set(['awaiting_executor', 'running_fixture', 'cancelled']),
  awaiting_executor: new Set(['cancelled', 'execution_plane_unavailable']),
  running_fixture: new Set(['collecting_results', 'failed', 'cancelled', 'timed_out']),
  collecting_results: new Set(['completed', 'failed']),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  timed_out: new Set(),
  policy_rejected: new Set(),
  execution_plane_unavailable: new Set()
});
```

- [ ] **Step 4: Implement transport-free mutation plans**

A plan must be data only:

```js
{
  schemaVersion: 'audit-direct-mutation-plan-v1',
  operations: [
    { type: 'create_immutable', path, content, contentDigest },
    { type: 'compare_and_swap', path, expectedBlobSha, content, contentDigest }
  ]
}
```

The ledger package does not call GitHub, read files, inspect repositories, or own credentials.

- [ ] **Step 5: Run ledger and protocol tests**

```bash
node --test packages/audit-github-direct-protocol/test/*.test.mjs packages/audit-github-direct-ledger/test/*.test.mjs
```

Expected: PASS, including byte-identical plans for equivalent input and deterministic stale-write/duplicate errors.

- [ ] **Step 6: Commit**

```bash
git add packages/audit-github-direct-ledger
git commit -m "feat(audit): add GitHub Direct ledger planner"
```

---

### Task 4: Implement the Least-Privilege GitHub Adapter

**Files:**
- Create: `packages/audit-github-direct-adapter/package.json`
- Create: `packages/audit-github-direct-adapter/src/permissions.mjs`
- Create: `packages/audit-github-direct-adapter/src/errors.mjs`
- Create: `packages/audit-github-direct-adapter/src/adapter.mjs`
- Create: `packages/audit-github-direct-adapter/src/reporting.mjs`
- Create: `packages/audit-github-direct-adapter/src/artifacts.mjs`
- Create: `packages/audit-github-direct-adapter/src/index.mjs`
- Create: `packages/audit-github-direct-adapter/test/fake-transport.mjs`
- Create: `packages/audit-github-direct-adapter/test/adapter-v1.test.mjs`
- Create: `packages/audit-github-direct-adapter/test/permissions-v1.test.mjs`
- Create: `packages/audit-github-direct-adapter/test/redaction-v1.test.mjs`

**Interfaces:**
- Consumes: Mutation plans from Task 3 and validated protocol objects from Task 2.
- Produces:
  - `DIRECT_PERMISSION_MANIFEST`
  - `createGitHubDirectAdapter({ transport, clock, sleep, installationTokenProvider })`
  - adapter methods `resolveInstallation`, `resolveRepository`, `resolveExactCommit`, `applyMutationPlan`, `dispatchDirectWorkflow`, `getWorkflowStatus`, `publishCheck`, `publishComment`, `getArtifactMetadata`
  - `normalizeGitHubDirectError(error)`

The injected `transport` must expose exact methods:

```js
{
  getRepository,
  getCommit,
  getContent,
  createBlob,
  createTree,
  createCommit,
  updateRef,
  dispatchWorkflow,
  getWorkflowRun,
  createCheck,
  updateCheck,
  createIssueComment,
  updateIssueComment,
  listWorkflowArtifacts
}
```

- [ ] **Step 1: Write failing adapter fixture tests**

Test repository/installation allowlists, exact commit lookup, immutable create conflicts, compare-and-swap ref conflicts, bounded retry, token expiry, rate limiting, duplicate Check/comment prevention, artifact expiry, and redaction of headers/tokens/GitHub response bodies.

```js
test('adapter rejects a repository outside the installation allowlist', async () => {
  const adapter = createGitHubDirectAdapter({
    transport: fakeTransport(),
    clock: () => new Date('2026-08-01T15:30:00.000Z'),
    sleep: async () => {},
    installationTokenProvider: fakeTokenProvider()
  });
  await assert.rejects(
    adapter.resolveRepository({ installationId: 456, fullName: 'other/repo' }),
    (error) => error.code === 'repository_not_authorized'
  );
});
```

- [ ] **Step 2: Run tests and capture red evidence**

```bash
node --test packages/audit-github-direct-adapter/test/*.test.mjs
```

Expected: FAIL because adapter, permission, reporting, and error interfaces are absent.

- [ ] **Step 3: Implement the exact permission manifest**

```js
export const DIRECT_PERMISSION_MANIFEST = Object.freeze({
  resolve: Object.freeze({ metadata: 'read', contents: 'read' }),
  ledgerWrite: Object.freeze({ contents: 'write' }),
  workflow: Object.freeze({ actions: 'write', contents: 'read' }),
  check: Object.freeze({ checks: 'write', metadata: 'read' }),
  status: Object.freeze({ statuses: 'write', metadata: 'read' }),
  issueReport: Object.freeze({ issues: 'write', metadata: 'read' }),
  pullRequestReport: Object.freeze({ pull_requests: 'write', metadata: 'read' }),
  artifactRead: Object.freeze({ actions: 'read', metadata: 'read' })
});
```

Do not include organization administration, members, billing, secrets, environments, or deployments.

- [ ] **Step 4: Implement adapter operations through the injected transport**

`applyMutationPlan` rereads current content/ref before each compare-and-swap, verifies expected blob SHA, builds one atomic tree/commit, and performs non-forced ref update. Bounded retry is allowed only for an explicit ref conflict and must revalidate the whole plan.

- [ ] **Step 5: Implement bounded error normalization**

Map status/rate-limit/transport errors into the canonical categories from document 21. Never copy response bodies, authorization headers, token values, stack traces, private-key information, or host paths into the public error.

- [ ] **Step 6: Run adapter, ledger, and protocol tests**

```bash
node --test packages/audit-github-direct-{protocol,ledger,adapter}/test/*.test.mjs
```

Expected: PASS with deterministic fake-transport call traces.

- [ ] **Step 7: Commit**

```bash
git add packages/audit-github-direct-adapter
git commit -m "feat(audit): add least-privilege GitHub Direct adapter"
```

---

### Task 5: Implement the Execution-Disabled Direct Runner

**Files:**
- Create: `packages/audit-github-direct-runner/package.json`
- Create: `packages/audit-github-direct-runner/src/admission.mjs`
- Create: `packages/audit-github-direct-runner/src/fixture-policy.mjs`
- Create: `packages/audit-github-direct-runner/src/publication.mjs`
- Create: `packages/audit-github-direct-runner/src/run.mjs`
- Create: `packages/audit-github-direct-runner/src/index.mjs`
- Create: `packages/audit-github-direct-runner/test/admission-v1.test.mjs`
- Create: `packages/audit-github-direct-runner/test/execution-disabled-v1.test.mjs`
- Create: `packages/audit-github-direct-runner/test/fixture-run-v1.test.mjs`
- Create: `packages/audit-github-direct-runner/test/cancellation-v1.test.mjs`

**Interfaces:**
- Consumes: Protocol, ledger, adapter, accepted transport-neutral profile/parser/result/evidence/report packages.
- Produces:
  - `admitDirectRequest({ request, repository, installation, policy, capabilities })`
  - `createTrustedFixturePolicy(entries)`
  - `runDirectJob({ requestBlob, requestBlobSha, repositoryIdentity, policy, capabilities, fixturePolicy, fixtureExecutor, ledger, publisher, cancellation })`
  - `createDirectResultPublication(...)`
  - `createDirectReportPublication(...)`

`fixtureExecutor` is injected and permitted only for an exact repository-owned fixture entry. It cannot accept arbitrary commands or paths.

- [ ] **Step 1: Write failing admission and execution-disabled tests**

```js
test('non-fixture submitted job terminates without executing', async () => {
  let executed = false;
  const result = await runDirectJob({
    requestBlob: canonicalRequestBytes,
    requestBlobSha: 'blobsha',
    repositoryIdentity,
    policy,
    capabilities: DIRECT_CAPABILITIES,
    fixturePolicy: createTrustedFixturePolicy([]),
    fixtureExecutor: async () => { executed = true; },
    ledger: fakeLedger(),
    publisher: fakePublisher(),
    cancellation: fakeCancellation(false)
  });
  assert.equal(executed, false);
  assert.equal(result.state, 'execution_plane_unavailable');
});
```

Test request-blob digest mismatch, target-SHA drift, installation mismatch, profile/result-contract mismatch, request-selected command fields, cancellation before admission, timeout, duplicate rerun, and trusted fixture success/failure.

- [ ] **Step 2: Run tests and capture red evidence**

```bash
node --test packages/audit-github-direct-runner/test/*.test.mjs
```

Expected: FAIL because runner interfaces are absent.

- [ ] **Step 3: Implement exact admission order**

Admission order is fixed:

1. parse inert bytes;
2. validate direct request;
3. verify request blob SHA/digest;
4. verify installation/repository identity;
5. verify exact target commit SHA;
6. verify policy/profile/parser/result contracts;
7. verify truthful capabilities and execution gate;
8. classify as trusted fixture or execution unavailable;
9. create admitted/rejected transition plan.

No execution or publication occurs before all identity checks pass.

- [ ] **Step 4: Implement fixture-only execution and terminal handling**

Only an entry containing exact repository ID, exact target SHA, exact fixture ID, and approved profile/result versions may call `fixtureExecutor`. All other requests stop without checkout or execution.

Cancellation and timeout create one terminal event/result, remain idempotent on rerun, and never produce both completion and cancellation.

- [ ] **Step 5: Validate normalized result and report publication**

The runner accepts only outputs already validated by the relevant accepted result contract. Publication manifests include mode, source SHA, profile/result identities, workflow/run/artifact references when available, digest, size, retention, and truthful capability record.

- [ ] **Step 6: Run all direct package tests**

```bash
node --test packages/audit-github-direct-{protocol,ledger,adapter,runner}/test/*.test.mjs
```

Expected: PASS; fake executor call count is zero for every non-fixture case.

- [ ] **Step 7: Commit**

```bash
git add packages/audit-github-direct-runner
git commit -m "feat(audit): add execution-disabled GitHub Direct runner"
```

---

### Task 6: Add the Least-Privilege GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/audit-direct-v1.yml`
- Create: `test/audit-github-direct-workflow-v1.test.mjs`
- Create: `test/audit-github-direct-untrusted-pr-v1.test.mjs`

**Interfaces:**
- Consumes: Runner CLI/module from Task 5 and exact request path/blob SHA supplied by the approved adapter.
- Produces: Workflow `audit-direct-v1` with an explicit `workflow_dispatch` contract and optional protected control-branch push trigger.

- [ ] **Step 1: Write failing static workflow tests**

Tests must parse the YAML as text and assert:

- `permissions: contents: read` at workflow level;
- job-specific write permissions only where needed;
- bounded `timeout-minutes` and concurrency;
- no `pull_request_target`;
- no unpinned `uses:` references;
- no `wrangler`, Cloudflare, R2, deployment, wallet, RPC, arbitrary shell input, or request-selected command interpolation;
- request path/blob SHA/job ID are validated values, not shell programs;
- untrusted PR triggers do not reach token-minting jobs.

```js
test('audit-direct workflow contains no Cloudflare or deployment path', async () => {
  const source = await readFile('.github/workflows/audit-direct-v1.yml', 'utf8');
  assert.doesNotMatch(source, /cloudflare|wrangler|r2_|deploy/i);
  assert.doesNotMatch(source, /pull_request_target/);
  for (const line of source.split('\n').filter((line) => line.includes('uses:'))) {
    assert.match(line, /@[0-9a-f]{40}\s*$/);
  }
});
```

- [ ] **Step 2: Run tests and verify red failure**

```bash
node --test test/audit-github-direct-workflow-v1.test.mjs test/audit-github-direct-untrusted-pr-v1.test.mjs
```

Expected: FAIL because the workflow is absent.

- [ ] **Step 3: Create the bounded workflow**

Use a contract equivalent to:

```yaml
name: CurveYield Audit GitHub Direct v1

on:
  workflow_dispatch:
    inputs:
      job_id:
        required: true
        type: string
      request_path:
        required: true
        type: string
      request_blob_sha:
        required: true
        type: string

permissions:
  contents: read

concurrency:
  group: audit-direct-${{ inputs.job_id }}
  cancel-in-progress: false

jobs:
  validate-and-coordinate:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      checks: write
      statuses: write
      actions: read
    steps:
      - name: Check out trusted runner code
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with:
          ref: ${{ github.sha }}
          persist-credentials: false
      - name: Set up Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: "22"
      - name: Validate and coordinate exact direct request
        env:
          AUDIT_DIRECT_JOB_ID: ${{ inputs.job_id }}
          AUDIT_DIRECT_REQUEST_PATH: ${{ inputs.request_path }}
          AUDIT_DIRECT_REQUEST_BLOB_SHA: ${{ inputs.request_blob_sha }}
          AUDIT_EXECUTION_ENABLED: "false"
        run: node packages/audit-github-direct-runner/src/workflow-entry.mjs
```

Add `workflow-entry.mjs` to the runner only if needed; it must treat environment variables as bounded identities, never commands or paths outside the direct prefix.

- [ ] **Step 4: Run workflow/static tests**

```bash
node --test test/audit-github-direct-workflow-v1.test.mjs test/audit-github-direct-untrusted-pr-v1.test.mjs test/audit-github-direct-static-boundary-v1.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/audit-direct-v1.yml packages/audit-github-direct-runner/src/workflow-entry.mjs test/audit-github-direct-workflow-v1.test.mjs test/audit-github-direct-untrusted-pr-v1.test.mjs
git commit -m "feat(audit): add bounded GitHub Direct workflow"
```

Do not dispatch or approve the workflow during this task.

---

### Task 7: Implement the Short-Lived-Authorization CLI

**Files:**
- Create: `apps/audit-github-direct-cli/package.json`
- Create: `apps/audit-github-direct-cli/src/arguments.mjs`
- Create: `apps/audit-github-direct-cli/src/auth.mjs`
- Create: `apps/audit-github-direct-cli/src/client.mjs`
- Create: `apps/audit-github-direct-cli/src/cli.mjs`
- Create: `apps/audit-github-direct-cli/test/arguments-v1.test.mjs`
- Create: `apps/audit-github-direct-cli/test/auth-v1.test.mjs`
- Create: `apps/audit-github-direct-cli/test/client-v1.test.mjs`
- Create: `apps/audit-github-direct-cli/test/redaction-v1.test.mjs`

**Interfaces:**
- Consumes: Protocol and adapter public APIs.
- Produces commands:
  - `audit-direct auth`
  - `audit-direct submit --repo <owner/repo> --sha <40-hex> --profile <id>`
  - `audit-direct status --job <id>`
  - `audit-direct report --job <id>`
  - `audit-direct cancel --job <id>`
  - `audit-direct capabilities`

- [ ] **Step 1: Write failing command, confirmation, auth, and redaction tests**

Test exact command/flag allowlists, duplicate/unknown flags, missing exact SHA, private-key-shaped argument rejection, mode/repository/SHA pre-write display, noninteractive `--yes` behavior, device-flow polling fixtures, token redaction, retry idempotency, and all Cloudflare credentials absent.

- [ ] **Step 2: Run tests and verify red failure**

```bash
node --test apps/audit-github-direct-cli/test/*.test.mjs
```

Expected: FAIL because CLI modules are absent.

- [ ] **Step 3: Implement strict argument parsing**

```js
export const CLI_COMMANDS = Object.freeze([
  'auth', 'submit', 'status', 'report', 'cancel', 'capabilities'
]);
```

Reject `--private-key`, `--token`, `--command`, `--script`, `--url`, `--rpc`, `--workflow`, `--image`, and any unknown option. Require exact SHA for `submit`; never resolve `latest` or a branch inside the CLI.

- [ ] **Step 4: Implement injected short-lived user authorization**

`createDeviceAuthorizationClient({ transport, clock, sleep })` may request and poll a GitHub App user authorization flow through an injected transport. Returned tokens remain in memory or an explicitly approved OS credential-store adapter; tests use only an in-memory adapter. Never print token bodies.

- [ ] **Step 5: Implement typed client calls and write confirmation**

Before `submit` or `cancel`, print:

```text
Mode: github-direct-audit-v1
Repository: CurveYield/contract-automation
Commit: <exact 40-character SHA>
Operation: submit
```

The client creates one request and uses the adapter's idempotent operation. Status/report/capabilities are read-only.

- [ ] **Step 6: Run CLI and cross-mode tests**

```bash
node --test apps/audit-github-direct-cli/test/*.test.mjs test/audit-github-direct-cross-mode-v1.test.mjs test/audit-github-direct-static-boundary-v1.test.mjs
```

Expected: PASS with no App private-key input surface.

- [ ] **Step 7: Commit**

```bash
git add apps/audit-github-direct-cli
git commit -m "feat(audit): add GitHub Direct CLI"
```

---

### Task 8: Complete Bounded Reporting, Artifacts, and Idempotency

**Files:**
- Modify: `packages/audit-github-direct-adapter/src/reporting.mjs`
- Modify: `packages/audit-github-direct-adapter/src/artifacts.mjs`
- Modify: `packages/audit-github-direct-runner/src/publication.mjs`
- Create: `packages/audit-github-direct-adapter/test/reporting-idempotency-v1.test.mjs`
- Create: `packages/audit-github-direct-runner/test/publication-v1.test.mjs`
- Create: `test/audit-github-direct-report-escaping-v1.test.mjs`

**Interfaces:**
- Consumes: Validated result/report manifests and fake GitHub transport.
- Produces:
  - `publishDirectCheck({ job, result, existingExternalId })`
  - `publishDirectComment({ job, report, existingCommentId })`
  - `validateDirectArtifactMetadata(value)`
  - immutable result/report publication plans with explicit retention.

- [ ] **Step 1: Write failing bounds and idempotency tests**

Cover duplicate retries, Check external ID stability, comment marker stability, hostile Markdown/HTML, oversized summaries, expired/missing artifacts, run/artifact identity mismatch, digest/size mismatch, secret/path strings, and terminal cancellation/report races.

- [ ] **Step 2: Run tests and verify red failure**

```bash
node --test packages/audit-github-direct-adapter/test/reporting-idempotency-v1.test.mjs packages/audit-github-direct-runner/test/publication-v1.test.mjs test/audit-github-direct-report-escaping-v1.test.mjs
```

Expected: FAIL until bounded publication behavior is implemented.

- [ ] **Step 3: Implement stable external identities and caps**

Use deterministic external IDs such as:

```js
const checkExternalId = `audit-direct:${job.jobId}:attempt:${job.attempt}`;
const commentMarker = `<!-- audit-direct:${job.jobId}:report-v1 -->`;
```

Cap Check/comment summaries and annotations; escape attacker-controlled fields; link to authoritative manifests instead of embedding raw logs.

- [ ] **Step 4: Implement explicit artifact retention metadata**

Require run ID, artifact ID, name, digest, byte size, created/expiry timestamps, expired flag, and retention days. Reject representations of expired artifacts as downloadable or permanent.

- [ ] **Step 5: Run reporting/publication suites**

Run the command from Step 2 plus all adapter and runner tests.

Expected: PASS; retry call traces contain update-not-create behavior after the first publication.

- [ ] **Step 6: Commit**

```bash
git add packages/audit-github-direct-adapter packages/audit-github-direct-runner test/audit-github-direct-report-escaping-v1.test.mjs
git commit -m "feat(audit): harden GitHub Direct publication"
```

---

### Task 9: Enforce Cross-Mode, Capability, and Static Security Gates

**Files:**
- Modify: `test/audit-github-direct-cross-mode-v1.test.mjs`
- Modify: `test/audit-github-direct-static-boundary-v1.test.mjs`
- Modify: `test/audit-github-direct-untrusted-pr-v1.test.mjs`
- Create: `test/audit-github-direct-capabilities-v1.test.mjs`
- Create: `test/audit-github-direct-no-cloudflare-env-v1.test.mjs`
- Modify only if required for composition: `scripts/check-audit-boundary.mjs`

**Interfaces:**
- Consumes: All direct packages, CLI, workflow, existing Cloudflare Audit entry points, and Lite boundary checker.
- Produces: Repository-level acceptance gates proving separate modes and absent prohibited capabilities.

- [ ] **Step 1: Add failing full-boundary tests**

The tests must prove:

- Cloudflare API rejects direct-mode schema;
- direct protocol rejects Cloudflare schema;
- failure in one mode does not call the other adapter;
- mutable state/index paths never overlap;
- direct packages load with all Cloudflare/R2 environment values deleted;
- direct capability record is exact and frozen;
- Cloudflare mode capabilities remain unchanged;
- production direct sources contain no process spawning, filesystem enumeration/writes, network outside the adapter/CLI transport boundary, wallet/signing/transaction/broadcast/deployment, dynamic code, package installation, Cloudflare/R2 imports, or Lite imports;
- workflow contains no untrusted PR secret path;
- shared trusted fixtures produce the same canonical normalized result contract in both modes.

- [ ] **Step 2: Run tests and capture red evidence**

```bash
node --test test/audit-github-direct-*.test.mjs test/boundary/*.test.mjs
```

Expected: FAIL for any remaining cross-mode import, capability drift, or environment dependency.

- [ ] **Step 3: Make only minimal composition repairs**

Do not refactor existing Cloudflare code unless a narrowly scoped mode-dispatch boundary is required. Such a boundary must default to existing Cloudflare behavior and reject direct requests rather than forward them.

Extend `scripts/check-audit-boundary.mjs` only to add direct-mode forbidden-import and Lite-isolation rules; preserve all existing checks.

- [ ] **Step 4: Run complete direct and boundary verification**

```bash
node --test packages/audit-github-direct-{protocol,ledger,adapter,runner}/test/*.test.mjs apps/audit-github-direct-cli/test/*.test.mjs test/audit-github-direct-*.test.mjs test/boundary/*.test.mjs
node --check packages/audit-github-direct-protocol/src/*.mjs
node --check packages/audit-github-direct-ledger/src/*.mjs
node --check packages/audit-github-direct-adapter/src/*.mjs
node --check packages/audit-github-direct-runner/src/*.mjs
node --check apps/audit-github-direct-cli/src/*.mjs
node scripts/check-audit-boundary.mjs
git diff --check
```

Expected: all permissible direct tests and static checks PASS. No dependency installation, build, workflow dispatch, or deployment is performed.

- [ ] **Step 5: Commit**

```bash
git add test/audit-github-direct-*.test.mjs test/boundary scripts/check-audit-boundary.mjs
git commit -m "test(audit): enforce GitHub Direct isolation gates"
```

---

### Task 10: Add Phase 10 Permissions, Incident, Recovery, and Rollout Documentation

**Files:**
- Create: `docs/audit/github-direct/README_v1.md`
- Create: `docs/audit/github-direct/PERMISSIONS_v1.md`
- Create: `docs/audit/github-direct/INCIDENT_AND_RECOVERY_v1.md`
- Create: `docs/audit/github-direct/ROLLOUT_CHECKLIST_v1.md`
- Create: `test/audit-github-direct-doc-contract-v1.test.mjs`

**Interfaces:**
- Consumes: Frozen constants, permission manifest, control paths, workflow contract, and canonical specification document 21.
- Produces: Operator documentation and machine-checked correspondence between docs and runtime constants.

- [ ] **Step 1: Write failing documentation-contract tests**

Test that docs contain exact mode/control-branch/schema names, permission categories, no-fallback language, absent Cloudflare requirement, execution-disabled state, incident switch behavior, token rotation/revocation procedure, control-index recovery steps, artifact retention handling, and staged repository allowlisting.

- [ ] **Step 2: Run tests and verify red failure**

```bash
node --test test/audit-github-direct-doc-contract-v1.test.mjs
```

Expected: FAIL because operator docs are absent.

- [ ] **Step 3: Write exact operator documentation**

`PERMISSIONS_v1.md` must map every adapter operation to the exact permission manifest and identify when `GITHUB_TOKEN` is sufficient versus when a protected installation token is required.

`INCIDENT_AND_RECOVERY_v1.md` must specify:

1. disable new submissions through the direct feature gate;
2. preserve read-only control manifests and reports;
3. revoke installation/user tokens;
4. rotate the App private key when required;
5. inspect GitHub App and Actions audit logs;
6. reconstruct `jobs_v1.json` only from validated immutable requests/events/results/reports;
7. compare reconstructed digests before a compare-and-swap index repair;
8. re-enable only through staged repository allowlisting.

`ROLLOUT_CHECKLIST_v1.md` must keep `submittedExecutionEnabled=false`, require branch protection and immutable Action pins, and verify operation with Cloudflare credentials absent.

- [ ] **Step 4: Run doc and full direct tests**

```bash
node --test test/audit-github-direct-doc-contract-v1.test.mjs test/audit-github-direct-*.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/audit/github-direct test/audit-github-direct-doc-contract-v1.test.mjs
git commit -m "docs(audit): add GitHub Direct operations controls"
```

---

### Task 11: Final Source Acceptance and Integration Package

**Files:**
- Create: `docs/audit/reviews/YYYY-MM-DD-audit-github-direct-v1-source-acceptance.md` at execution time using the actual completion date.
- Modify only after all direct tasks pass: `package.json` to add direct-mode test scripts if useful and if existing scripts cannot express the accepted suite without ambiguity.
- Modify: `docs/audit/specifications-v2/MANIFEST_v2.json` only if canonical specifications changed during implementation.

**Interfaces:**
- Consumes: Exact final branch SHA and every task's test evidence.
- Produces: Durable acceptance ledger and integration recommendation; no deployment or workflow approval.

- [ ] **Step 1: Verify exact changed paths**

```bash
git diff --name-only <accepted-phase8-base>...HEAD
```

At execution time replace `<accepted-phase8-base>` with the exact SHA recorded in the implementation issue and immutable worker assignment before running the command. The accepted output may include only the direct packages/apps/workflow/tests/docs and narrowly justified shared boundary/script composition files listed in this plan.

- [ ] **Step 2: Run complete permissible verification**

```bash
node --test packages/audit-github-direct-{protocol,ledger,adapter,runner}/test/*.test.mjs apps/audit-github-direct-cli/test/*.test.mjs test/audit-github-direct-*.test.mjs test/boundary/*.test.mjs
node scripts/check-audit-boundary.mjs
git diff --check
```

Also run `node --check` over every changed `.mjs` file and parse every changed JSON file. Do not install dependencies, compile, build, dispatch/approve workflows, deploy, or enable execution.

- [ ] **Step 3: Produce the durable source-acceptance report**

Record:

- exact base and final SHAs;
- every changed file and ownership classification;
- red/green commands and exact counts by task;
- exported interfaces;
- request/state/result/report schema inventory;
- permission and identity truth table;
- control-branch path and transition truth table;
- adapter fake-transport call totals;
- fixture-only runner evidence;
- cancellation/timeout/idempotency evidence;
- workflow permission and untrusted-PR results;
- artifact/report bounds and retention evidence;
- cross-mode, no-Cloudflare, and Lite-boundary results;
- blocked real GitHub App, live workflow, deployment, and hardened-executor checks;
- residual risks;
- final `ACCEPT`, `ACCEPT WITH REPAIR`, or `REJECT` recommendation.

- [ ] **Step 4: Commit the acceptance ledger**

```bash
git add docs/audit/reviews package.json docs/audit/specifications-v2/MANIFEST_v2.json
git commit -m "docs(audit): record GitHub Direct v1 source acceptance"
```

- [ ] **Step 5: Stop before external enablement**

Do not merge to `main`, dispatch the production workflow, configure App secrets, change branch protection, or enable the feature gate as part of source implementation. Those are separately approved Phase 10 administration steps after independent source review.

---

## Dependency and Ownership Order

1. Task 1 must land first; it defines the non-overlap boundary.
2. Task 2 must precede every other implementation task.
3. Task 3 depends only on Task 2.
4. Task 4 depends on Tasks 2–3.
5. Task 5 depends on Tasks 2–4 and accepted transport-neutral Audit contracts.
6. Task 6 depends on Task 5.
7. Task 7 depends on Tasks 2 and 4; it may proceed in parallel with Task 6 after those dependencies are accepted.
8. Task 8 depends on Tasks 4–5.
9. Task 9 runs after Tasks 1–8.
10. Task 10 runs after runtime constants and permissions are stable.
11. Task 11 is orchestrator-owned final acceptance after all implementation branches are integrated.

Recommended non-overlapping worker split after prerequisite acceptance:

- Worker A: Tasks 1–2, pure protocol and boundary.
- Worker B: Task 3, pure ledger planner, after Task 2.
- Worker C: Task 4, GitHub adapter fixtures, after Tasks 2–3.
- Worker D: Task 5, execution-disabled runner, after Tasks 2–4.
- Worker E: Tasks 6–7, workflow and CLI, after required lower layers.
- Orchestrator/integration worker: Tasks 8–11, cross-package publication, security gates, docs, and final source acceptance.

No worker may modify another worker's package during isolated implementation. Shared composition changes occur only on the integration branch after independent review of exact worker SHAs.

## Completion Definition

The source implementation is complete only when:

- all direct packages, CLI, workflow, tests, and operator docs exist;
- all listed direct and boundary tests pass without Cloudflare/R2 credentials;
- direct production paths contain no Cloudflare/R2 imports;
- the App private key has no browser/request/CLI/workflow-input/report/artifact surface;
- exact source and installation identity, compare-and-swap state, idempotency, permissions, cancellation, artifact retention, and reporting bounds are proven;
- non-fixture requests do not execute and end in an explicit executor-unavailable state;
- Cloudflare Audit and CurveYield Lite remain unchanged;
- independent review accepts exact final SHAs;
- no deployment, production secret configuration, main merge, or execution enablement has occurred.
