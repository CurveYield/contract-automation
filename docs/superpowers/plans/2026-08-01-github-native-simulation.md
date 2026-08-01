# GitHub-Native Simulation Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate GitHub-native compile and live-fork simulation suite that reuses the trusted simulation core while leaving every existing file unchanged.

**Architecture:** Committed job directories replace the Cloudflare job transport. New validation, project resolution, orchestration, CLI, GitHub Actions workflows, tests, examples, and documentation are added under new paths. Existing protocol and runner modules are imported without modification.

**Tech Stack:** Node.js 22 ESM, Node built-in test runner, existing `solc`, `ganache`, and `ethers` dependencies, GitHub Actions, existing CurveYield runner modules.

## Global Constraints

- The change set is additions-only: no existing file may be edited, renamed, deleted, or relocated.
- Existing Cloudflare/API/runner behavior must remain unchanged.
- No wallet private key, mnemonic, seed, signer secret, user-supplied RPC URL, raw signed transaction, shell command, project script, package-manager command, or live-chain broadcast is accepted.
- Only repository RPC secrets named by the existing `CHAINS` map may supply fork URLs.
- Submitted Solidity projects are inert source data.
- GitHub-native job branches use `github-native-sim/<job-id>` and job directories use `github-native-sim/jobs/<job-id>/`.
- The job schema version is exactly `github-native-sim/v1`.
- Node.js version is 22.

---

### Task 1: Add failing schema and path-containment tests

**Files:**
- Create: `packages/github-native-sim/test/schema.test.mjs`
- Create: `packages/github-native-sim/test/project.test.mjs`
- Create: `.github/workflows/github-native-sim-ci.yml`

**Interfaces:**
- Consumes: `CHAINS` and `validateWorkflow` from `packages/protocol/src/index.mjs`.
- Produces: test expectations for `validateGitHubNativeJob(input)` and `resolveJobProjectRoot(jobFile, projectPath)`.

- [ ] **Step 1: Write the failing schema tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGitHubNativeJob } from '../src/schema.mjs';

const valid = {
  version: 'github-native-sim/v1',
  id: 'compile-smoke',
  mode: 'compile',
  projectPath: 'project',
  compilerVersion: '0.8.30',
  optimizer: { enabled: true, runs: 200 },
  viaIR: false,
  workflow: { steps: [] }
};

test('accepts a compile manifest', () => {
  assert.equal(validateGitHubNativeJob(valid).id, 'compile-smoke');
});

test('requires an allowlisted chain for simulation', () => {
  assert.throws(
    () => validateGitHubNativeJob({ ...valid, mode: 'simulate', chain: 'unknown', workflow: { steps: [{ action: 'mine', blocks: 1 }] } }),
    /Unsupported chain/
  );
});

test('rejects private keys recursively', () => {
  assert.throws(() => validateGitHubNativeJob({ ...valid, metadata: { privateKey: '0x01' } }), /privateKey|unknown field/);
});

test('rejects project traversal', () => {
  assert.throws(() => validateGitHubNativeJob({ ...valid, projectPath: '../project' }), /projectPath/);
});
```

- [ ] **Step 2: Write the failing project-containment tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveJobProjectRoot } from '../src/project.mjs';

test('resolves a project below the job directory', () => {
  const job = path.resolve('/tmp/jobs/example/job.json');
  assert.equal(resolveJobProjectRoot(job, 'project'), path.resolve('/tmp/jobs/example/project'));
});

test('rejects escape from the job directory', () => {
  assert.throws(() => resolveJobProjectRoot('/tmp/jobs/example/job.json', '../project'), /inside the job directory/);
});
```

- [ ] **Step 3: Add dedicated CI**

Create `.github/workflows/github-native-sim-ci.yml` with pull-request and push path filters limited to the new suite. It installs trusted root dependencies, runs `node --test packages/github-native-sim/test/*.test.mjs`, and runs `node --check` on every new `.mjs` file.

- [ ] **Step 4: Push and verify the expected red failure**

Expected: CI fails because `../src/schema.mjs` and `../src/project.mjs` do not exist.

- [ ] **Step 5: Commit**

```bash
git add packages/github-native-sim/test .github/workflows/github-native-sim-ci.yml
git commit -m "test: define GitHub-native simulation contracts"
```

### Task 2: Implement manifest validation and project containment

**Files:**
- Create: `packages/github-native-sim/src/schema.mjs`
- Create: `packages/github-native-sim/src/project.mjs`

**Interfaces:**
- Produces: `validateGitHubNativeJob(input)` returning a normalized job object.
- Produces: `resolveJobProjectRoot(jobFile, projectPath)` returning an absolute contained directory.

- [ ] **Step 1: Implement strict manifest validation**

Implement exact-key validation, recursive forbidden-key scanning, exact semantic versions, `compile|simulate` mode validation, allowlisted chain validation through `CHAINS`, block validation, optimizer validation, timeout validation, safe relative `projectPath`, and workflow validation through `validateWorkflow`.

- [ ] **Step 2: Implement contained project resolution**

Resolve `projectPath` relative to `path.dirname(jobFile)`. Reject absolute paths, empty segments, `.` or `..` segments, and any resolved path outside the job directory.

- [ ] **Step 3: Run focused tests**

```bash
node --test packages/github-native-sim/test/schema.test.mjs packages/github-native-sim/test/project.test.mjs
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/github-native-sim/src/schema.mjs packages/github-native-sim/src/project.mjs
git commit -m "feat: validate GitHub-native simulation jobs"
```

### Task 3: Add failing orchestration and CLI tests

**Files:**
- Create: `packages/github-native-sim/test/run-job-file.test.mjs`
- Create: `packages/github-native-sim/test/cli.test.mjs`
- Create: `packages/github-native-sim/test/fixtures/compile/job.json`
- Create: `packages/github-native-sim/test/fixtures/compile/project/Counter.sol`
- Create: `packages/github-native-sim/test/fixtures/missing-rpc/job.json`
- Create: `packages/github-native-sim/test/fixtures/missing-rpc/project/Counter.sol`

**Interfaces:**
- Consumes: `runGitHubNativeJob({ jobFile, outputDir, environment })`.
- Produces: required result-file and CLI behavior.

- [ ] **Step 1: Write compile-mode integration test**

The test creates a temporary output directory, runs the compile fixture with compiler `0.8.30`, then asserts:

```js
assert.equal(result.status, 'completed');
assert.equal(result.mode, 'compile');
assert.ok(result.artifacts.some((artifact) => artifact.contractName === 'Counter'));
await fs.access(path.join(output, 'result.json'));
await fs.access(path.join(output, 'report.html'));
await fs.access(path.join(output, 'compiler-input.json'));
await fs.access(path.join(output, 'compiler-output.json'));
await fs.access(path.join(output, 'compiler-diagnostics.json'));
await fs.access(path.join(output, 'artifacts', 'index.json'));
```

- [ ] **Step 2: Write missing-RPC failure test**

Run a valid Ethereum simulation fixture with an empty environment. Assert that the promise rejects with `RPC_ETHEREUM`, and that `result.json` still exists with `status: "failed"`.

- [ ] **Step 3: Write CLI argument tests**

Spawn Node with no arguments and with an unknown argument. Assert a nonzero status and a usage or unknown-argument message.

- [ ] **Step 4: Run tests and verify red failure**

Expected: imports for `run-job-file.mjs` and `cli.mjs` fail.

- [ ] **Step 5: Commit**

```bash
git add packages/github-native-sim/test
git commit -m "test: define GitHub-native runner outputs"
```

### Task 4: Implement local job orchestration and CLI

**Files:**
- Create: `packages/github-native-sim/src/run-job-file.mjs`
- Create: `packages/github-native-sim/src/cli.mjs`

**Interfaces:**
- Produces: `runGitHubNativeJob({ jobFile, outputDir, environment = process.env })`.
- CLI: `node packages/github-native-sim/src/cli.mjs --job <path> --output <path>`.

- [ ] **Step 1: Implement deterministic output writers**

Add JSON serialization that converts bigint values to strings. Create the output directory and write results atomically through temporary files followed by rename.

- [ ] **Step 2: Implement compilation orchestration**

Read and validate the manifest, resolve the project path, collect Solidity sources, materialize an exact OpenZeppelin dependency when requested, and call `compileProject` with the normalized compiler settings.

- [ ] **Step 3: Implement simulation orchestration**

For `simulate`, resolve `CHAINS[job.chain].rpcEnv`, require that environment variable, start `startGanacheEngine`, and call `executeWorkflow`. Always close the engine and remove temporary dependency files.

- [ ] **Step 4: Write complete artifacts**

Write compiler input, compiler output, diagnostics, normalized contract artifacts, `result.json`, and `report.html`. On failure, write a normalized failed result and report before rethrowing.

- [ ] **Step 5: Implement strict CLI parsing**

Accept only `--job` and `--output`, each exactly once. Print one-line usage and exit nonzero for missing, duplicate, or unknown arguments.

- [ ] **Step 6: Run focused tests**

```bash
node --test packages/github-native-sim/test/*.test.mjs
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/github-native-sim/src
git commit -m "feat: run simulations from committed GitHub jobs"
```

### Task 5: Add the permanent GitHub-native simulation workflow

**Files:**
- Create: `.github/workflows/github-native-simulate.yml`
- Create: `packages/github-native-sim/src/select-job.mjs`
- Create: `packages/github-native-sim/test/select-job.test.mjs`

**Interfaces:**
- Produces: `selectChangedJob({ changedPaths, manualJobPath })` returning `{ jobPath, jobRoot }`.
- Workflow artifact name: `github-native-sim-<job-id>-<run-id>`.

- [ ] **Step 1: Write failing selection tests**

Cover exactly one job, multiple jobs, changes outside `github-native-sim/jobs/`, missing `job.json`, and a valid manual job path.

- [ ] **Step 2: Implement safe job selection**

Require all push changes to live under one `github-native-sim/jobs/<job-id>/` directory and require its `job.json`. Manual paths must match `github-native-sim/jobs/<job-id>/job.json` exactly.

- [ ] **Step 3: Add workflow**

The workflow must:

- trigger on pushes to `github-native-sim/**` when job paths change;
- support manual dispatch with required `job_path`;
- use `contents: read` only;
- check out without persisted credentials;
- install trusted root dependencies with scripts disabled;
- determine the changed file set and job path;
- export only the existing allowlisted `RPC_*` secrets;
- invoke the new CLI;
- upload the output directory with `if: always()`;
- use a 40-minute job timeout and non-cancelling per-branch concurrency.

- [ ] **Step 4: Run tests and syntax checks**

```bash
node --test packages/github-native-sim/test/*.test.mjs
node --check packages/github-native-sim/src/select-job.mjs
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/github-native-simulate.yml packages/github-native-sim/src/select-job.mjs packages/github-native-sim/test/select-job.test.mjs
git commit -m "feat: add GitHub-native simulation workflow"
```

### Task 6: Add documentation, example, and smoke job

**Files:**
- Create: `docs/github-native-simulation.md`
- Create: `packages/github-native-sim/README.md`
- Create: `github-native-sim/examples/compile-smoke/job.json`
- Create: `github-native-sim/examples/compile-smoke/project/Counter.sol`

**Interfaces:**
- Documents the branch, directory, manifest, secrets, artifact retrieval, and cleanup contract.

- [ ] **Step 1: Document agent operation**

Explain the atomic-commit requirement, branch naming, job layout, supported chains, result files, and how a connected ChatGPT agent retrieves the workflow artifact.

- [ ] **Step 2: Document preservation**

State explicitly that the Cloudflare-backed API and `simulate.yml` continue to operate independently and were not changed.

- [ ] **Step 3: Add compile-only example**

Provide a `Counter.sol` job that requires no secrets and can be copied into a job branch for a smoke run.

- [ ] **Step 4: Commit**

```bash
git add docs/github-native-simulation.md packages/github-native-sim/README.md github-native-sim/examples
git commit -m "docs: explain GitHub-native simulations"
```

### Task 7: Full verification and additions-only audit

**Files:**
- No implementation files changed unless verification finds a defect.

- [ ] **Step 1: Run the complete new suite**

```bash
node --test packages/github-native-sim/test/*.test.mjs
```

Expected: zero failures.

- [ ] **Step 2: Run repository syntax validation**

```bash
npm run lint
```

Expected: zero syntax failures.

- [ ] **Step 3: Run the repository test suite**

```bash
npm test
```

Expected: zero failures.

- [ ] **Step 4: Audit the PR diff**

Compare `main...feature/github-native-sim-v1`. Every changed path must have status `added`; any modified, renamed, or deleted path is a release blocker.

- [ ] **Step 5: Run a real GitHub compile smoke job**

Create `github-native-sim/smoke-<timestamp>` from the feature branch, atomically commit one job directory copied from the example, confirm the workflow succeeds, and inspect the uploaded `result.json` for `status: completed` and the `Counter` artifact.

- [ ] **Step 6: Review the final PR**

Confirm the PR description records the smoke run, CI evidence, additions-only result, required RPC secrets, and explicit preservation of the original function set.
