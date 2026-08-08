# Round 5 Tier 3 Clean v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a complete Tier 3 Deep Assurance operator shell while preserving the accepted PreflightSim Lite browser unchanged under `/execution/` and preserving the accepted Lite API for every non-controller route.

**Architecture:** Start from accepted release `2df81aacb6f5747f06b49297e89e02c3f013d4ef`. Transplant only the v1-tested controller protocol/adapters/presenter models, wrap the existing API at `entry.mjs`, and build a separate Tier 3 root tree plus a byte-preserved Lite subtree. Production deployment uses a new one-shot Tier 3 workflow on the accepted release branch after PR promotion.

**Tech Stack:** Node.js 22 ESM, node:test, Cloudflare Workers/Pages/R2, GitHub Actions, GitHub REST API, Wrangler (dependency install explicitly authorized for the deployment gate).

## Global Constraints

- `CurveYield/audit-controller` GitHub state is authoritative; no second controller state machine.
- `apps/web/public/**` must not be modified by v2.
- `apps/api/src/index.mjs` must not be modified by v2.
- Non-controller API traffic must delegate to the accepted Lite worker.
- Controller routes are limited to `/api/v1/controller/*`.
- Controller GitHub credential is repository secret `PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN` and Worker binding `AUDIT_CONTROLLER_GITHUB_TOKEN`.
- Existing execution GitHub token remains separate.
- Active execution networks remain exactly Ethereum and Base; Base remains browser default.
- No wallet, signing, public transaction broadcast, raw RPC URL rendering, or secret rendering.
- Experimental `audit-round5/tier3-controller-ui-v1` must never be merged or deployed as the production candidate.

---

### Task 1: Transplant the tested controller protocol and API adapters

**Files:**
- Create: `packages/protocol/src/tier3-controller-v1.mjs`
- Create: `packages/protocol/src/tier3-controller-v2.mjs`
- Create: `packages/protocol/test/tier3-controller-v1.test.mjs`
- Create: `apps/api/src/controller-adapter-v1.mjs`
- Create: `apps/api/src/controller-command-adapter-v1.mjs`
- Create: `apps/api/test/controller-adapter-v1.test.mjs`
- Create: `apps/api/test/controller-command-adapter-v1.test.mjs`
- Create: `apps/api/test/controller-entry-v2.test.mjs`
- Modify: `apps/api/src/entry.mjs`
- Modify: `apps/api/wrangler.toml`

**Interfaces:**
- Consumes: accepted `apiWorker.fetch(request, env, context)` from `apps/api/src/index.mjs`.
- Produces: `handleControllerRouteV1(request, env)`, `handleControllerCommandRouteV1(request, env)`, and `controllerSetupReadinessV1(env)`.

- [ ] **Step 1: Write the v2 routing test before changing `entry.mjs`**

The test must assert:

```js
assert.match(entrySource, /url\.pathname\.startsWith\('\/api\/v1\/controller\/'\)/);
assert.match(entrySource, /handleControllerCommandRouteV1/);
assert.match(entrySource, /handleControllerRouteV1/);
assert.match(entrySource, /return apiWorker\.fetch\(request, env, context\)/);
assert.equal(indexSource, acceptedIndexSource);
```

It must also assert `setupReadiness(env).features.tier3Controller` is false without `AUDIT_CONTROLLER_GITHUB_TOKEN` or intake issue 64 and true when both are present.

- [ ] **Step 2: Run the routing test and verify RED**

Run:

```bash
node --test apps/api/test/controller-entry-v2.test.mjs
```

Expected: FAIL because the v2 branch has no controller routing or adapter modules.

- [ ] **Step 3: Transplant the tested v1 protocol/adapters from exact source `dc2d5348e35d601dee9f1e0411b9292b68350d37`**

Copy the listed protocol, adapter, and adapter-test files byte-for-byte unless a v2 test demonstrates a release-binding change is required. Do not copy v1 browser `index.html`, `app.js`, or `styles.css`.

- [ ] **Step 4: Add only the controller wrapper delta to `entry.mjs`**

Add imports:

```js
import {
  controllerSetupReadinessV1,
  handleControllerRouteV1
} from './controller-adapter-v1.mjs';
import { handleControllerCommandRouteV1 } from './controller-command-adapter-v1.mjs';
```

Add `tier3Controller` readiness and intercept only `/api/v1/controller/*`; retain the accepted chain handling and final `return apiWorker.fetch(request, env, context)`.

- [ ] **Step 5: Add only `AUDIT_CONTROLLER_INTAKE_ISSUE = "64"` to `apps/api/wrangler.toml`**

Do not alter accepted route, R2, CORS, Pages, execution branch, or enabled-chain values.

- [ ] **Step 6: Run controller tests and syntax checks**

Run:

```bash
node --test packages/protocol/test/tier3-controller-v1.test.mjs \
  apps/api/test/controller-adapter-v1.test.mjs \
  apps/api/test/controller-command-adapter-v1.test.mjs \
  apps/api/test/controller-entry-v2.test.mjs
node --check apps/api/src/controller-adapter-v1.mjs
node --check apps/api/src/controller-command-adapter-v1.mjs
node --check apps/api/src/entry.mjs
```

Expected: all PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/protocol apps/api
git commit -m "feat: add isolated Tier 3 controller API v2"
```

---

### Task 2: Build a Tier 3-only browser shell without editing accepted Lite source

**Files:**
- Create: `apps/web/tier3/index.html`
- Create: `apps/web/tier3/app.js`
- Create: `apps/web/tier3/styles.css`
- Create: `apps/web/src/controller-view-v2.mjs`
- Create: `apps/web/src/controller-detail-model-v1.mjs`
- Modify: `apps/web/src/client.mjs`
- Create: `apps/web/test/tier3-clean-shell-v2.test.mjs`
- Create: `apps/web/test/tier3-client-v1.test.mjs`
- Create: `apps/web/test/controller-detail-model-v1.test.mjs`
- Create: `apps/web/test/controller-detail-model-diagnostic-v1.test.mjs`
- Create: `apps/web/test/controller-view-v1.test.mjs`

**Interfaces:**
- Consumes: `/api/v1/controller/compatibility`, `/api/v1/controller/projects/:slug`, and controller command endpoint exposed by Task 1.
- Produces: isolated root operator UI linking to `/execution/`.

- [ ] **Step 1: Write the clean-shell test first**

Assertions must include:

```js
assert.equal(existsSync('apps/web/tier3/index.html'), true);
assert.match(tier3Html, /href="\.\/execution\/"/);
assert.doesNotMatch(tier3Html, /id="job-form"/);
assert.match(tier3Html, /GitHub state is authoritative/);
assert.doesNotMatch(tier3Js, /innerHTML\s*=/);
assert.doesNotMatch(tier3Js, /api\.github\.com/);
```

The test must hash every file under `apps/web/public/**` and compare it to the accepted release blobs recorded before implementation.

- [ ] **Step 2: Run clean-shell test and verify RED**

Run:

```bash
node --test apps/web/test/tier3-clean-shell-v2.test.mjs
```

Expected: FAIL because `apps/web/tier3/` does not exist.

- [ ] **Step 3: Transplant the tested browser client/presenter/model logic from v1**

Copy the controller-specific methods from v1 `apps/web/src/client.mjs`, plus exact tested `controller-view-v2.mjs` and `controller-detail-model-v1.mjs`. Preserve all accepted Lite client methods.

- [ ] **Step 4: Create a controller-only Tier 3 root shell**

Use the audit-controller sections proven in v1, but remove the embedded execution form/workspace. Replace it with a prominent link/button:

```html
<a class="primary-link" href="./execution/">Open Preflight Execution</a>
```

Keep API URL/key connection, project slug, compatibility/campaign summaries, detailed projection sections, and structured command form. The command form must not include repository, issue number, branch, mailbox URL, or GitHub token inputs.

- [ ] **Step 5: Create `apps/web/tier3/app.js` as controller-only logic**

Extract only controller connection/load/render/queue behavior from v1 `app.js`. Do not include project upload, compiler settings, fork workflow, job polling, report download, or execution workspace toggling. Render controller-derived values with `textContent` / DOM node construction only.

- [ ] **Step 6: Run browser unit/static tests**

Run:

```bash
node --test apps/web/test/tier3-clean-shell-v2.test.mjs \
  apps/web/test/tier3-client-v1.test.mjs \
  apps/web/test/controller-view-v1.test.mjs \
  apps/web/test/controller-detail-model-v1.test.mjs \
  apps/web/test/controller-detail-model-diagnostic-v1.test.mjs
node --check apps/web/tier3/app.js
node --check apps/web/src/client.mjs
node --check apps/web/src/controller-view-v2.mjs
node --check apps/web/src/controller-detail-model-v1.mjs
```

Expected: all PASS and no accepted Lite source hash changes.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/web
git commit -m "feat: add isolated Tier 3 browser shell v2"
```

---

### Task 3: Assemble dual static surfaces and prove Lite byte preservation

**Files:**
- Modify: `scripts/build.mjs`
- Create: `packages/runner/test/audit-round5-tier3-clean-build-v2.test.mjs`

**Interfaces:**
- Consumes: accepted `apps/web/public/**`, Tier 3 `apps/web/tier3/**`, browser source modules.
- Produces: `dist/web/` Tier 3 root and `dist/web/execution/` Lite tree.

- [ ] **Step 1: Write build-isolation test before modifying build script**

After `node scripts/build.mjs`, recursively verify:

```text
dist/web/index.html                     == apps/web/tier3/index.html
dist/web/app.js                         == apps/web/tier3/app.js
dist/web/styles.css                     == apps/web/tier3/styles.css
dist/web/execution/<every public file>  == apps/web/public/<same file>
dist/web/execution/client.js            == apps/web/src/client.mjs
dist/web/client.js                      == apps/web/src/client.mjs
dist/web/controller-view.js             == apps/web/src/controller-view-v2.mjs
dist/web/controller-detail-model-v1.mjs == apps/web/src/controller-detail-model-v1.mjs
```

Also assert root HTML links to `./execution/` and execution HTML retains Base as the selected default chain.

- [ ] **Step 2: Run build-isolation test and verify RED**

Run:

```bash
node --test packages/runner/test/audit-round5-tier3-clean-build-v2.test.mjs
```

Expected: FAIL because the accepted build currently publishes Lite directly at root.

- [ ] **Step 3: Implement the minimal dual-surface build**

`build.mjs` must:

```js
await fs.cp(path.join(root, 'apps', 'web', 'public'), path.join(output, 'execution'), { recursive: true });
await fs.cp(path.join(root, 'apps', 'web', 'tier3'), output, { recursive: true });
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'client.mjs'), path.join(output, 'execution', 'client.js'));
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'client.mjs'), path.join(output, 'client.js'));
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'controller-view-v2.mjs'), path.join(output, 'controller-view.js'));
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'controller-detail-model-v1.mjs'), path.join(output, 'controller-detail-model-v1.mjs'));
```

- [ ] **Step 4: Run build-isolation and browser/API regression tests**

Run the Task 1 + Task 2 suites plus the new build test. Expected: all PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add scripts/build.mjs packages/runner/test/audit-round5-tier3-clean-build-v2.test.mjs
git commit -m "build: isolate Tier 3 root from accepted Lite execution"
```

---

### Task 4: Add a one-shot Tier 3 production deployment workflow

**Files:**
- Create: `.github/workflows/tier3-production-deploy-v2.yml`
- Modify: `docs/setup.md`
- Create: `packages/runner/test/audit-round5-tier3-production-deploy-v2.test.mjs`
- Later create on release only: `.agent-control/v1/orchestrator/TIER3_PRODUCTION_DEPLOY_REQUEST_v2.json`

**Interfaces:**
- Consumes: production secrets/variables already used by accepted deployment plus `PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN`.
- Produces: exact Tier 3 Worker + Pages production deployment and sanitized #170 receipt.

- [ ] **Step 1: Write the workflow static test first**

Require:

```text
trigger branch = orchestrator/round4-ci-base-v1
trigger path = .agent-control/v1/orchestrator/TIER3_PRODUCTION_DEPLOY_REQUEST_v2.json
PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN is required by name
Worker secret map key = AUDIT_CONTROLLER_GITHUB_TOKEN
npm install --ignore-scripts --no-audit --no-fund is present
npx --no-install wrangler is used after install
Ethereum/Base only production assertion is present
wallet/signing/broadcast authorization is false
workflow posts a sanitized #170 deployment receipt
```

- [ ] **Step 2: Run workflow static test and verify RED**

Expected: FAIL because v2 deployment workflow does not exist.

- [ ] **Step 3: Create workflow from the accepted deployment workflow**

Preserve accepted Cloudflare/R2/Pages operations. Change only the one-shot request contract, exact Tier 3 source validation, Tier 3 tests/build verification, controller secret binding, and post-deploy Tier 3 smoke checks.

The request validator must require:

```json
{
  "schemaVersion": "round5-tier3-production-deploy-request-v2",
  "repository": "CurveYield/contract-automation",
  "releaseBranch": "orchestrator/round4-ci-base-v1",
  "deploymentAuthorized": true,
  "dependencyInstallationAuthorized": true,
  "activeNetworks": ["ethereum", "base"],
  "walletSigningAllowed": false,
  "publicTransactionBroadcastAllowed": false,
  "controllerRepository": "CurveYield/audit-controller",
  "controllerSecretName": "PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN"
}
```

The workflow must also prove `github.event.before == request.expectedBeforeSha` and `git rev-parse HEAD == github.sha`.

- [ ] **Step 4: Add post-deploy smoke checks**

Verify with bounded retries:

```text
GET /api/v1/health -> 200
GET /api/v1/setup with client bearer -> ready and tier3Controller=true
GET /api/v1/chains with client bearer -> exactly Ethereum + Base
GET /api/v1/controller/compatibility with client bearer -> exact accepted adapter/controller/instruction release
GET Pages / -> contains Deep Assurance operator marker
GET Pages /execution/ -> contains PreflightSim Lite marker
OPTIONS controller route -> exact production CORS origin
```

Do not print response bodies containing authentication or upstream diagnostics.

- [ ] **Step 5: Run workflow/static/syntax verification**

Use Node tests plus a YAML parser already available in the environment or Python/Ruby standard library parsing. Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add .github/workflows/tier3-production-deploy-v2.yml docs/setup.md packages/runner/test/audit-round5-tier3-production-deploy-v2.test.mjs
git commit -m "ci: add one-shot Tier 3 production deployment v2"
```

---

### Task 5: Full verification, promotion, deployment, and production receipt

**Files:**
- No code initially.
- Create after promotion: `.agent-control/v1/orchestrator/TIER3_PRODUCTION_DEPLOY_REQUEST_v2.json`
- Update issue #170 with sanitized deployment receipt.

**Interfaces:**
- Consumes: Tasks 1–4 candidate.
- Produces: exact production candidate for #132 Stage 7.

- [ ] **Step 1: Run dependency-free verification on v2 branch**

Run every new Tier 3 test plus JS syntax and `git diff --check`.

- [ ] **Step 2: Confirm accepted-source immutability**

Run:

```bash
git diff --exit-code 2df81aacb6f5747f06b49297e89e02c3f013d4ef -- apps/web/public apps/api/src/index.mjs
```

Expected: no diff.

- [ ] **Step 3: Run the now-authorized dependency install and complete repository verification**

Run in CI or trusted environment:

```bash
npm install --ignore-scripts --no-audit --no-fund
npm test
npm run lint
npm run build
```

Expected: all PASS. This is the first step allowed to download/install project dependencies under the current account-owner authorization.

- [ ] **Step 4: Open and merge a PR from v2 into `orchestrator/round4-ci-base-v1`**

Merge only when GitHub reports mergeable, no required check is failing, and the PR diff still leaves `apps/web/public/**` and `apps/api/src/index.mjs` unchanged.

- [ ] **Step 5: Capture the exact release head and create the one-shot request as the only next release commit**

`expectedBeforeSha` equals the exact release head before the request commit. Include the current account-owner authorization and dependency-install authorization. No secret values go in the request.

- [ ] **Step 6: Observe the production workflow to terminal state**

If any step fails, inspect the exact failing job/log and apply systematic debugging; do not rerun blindly.

- [ ] **Step 7: Verify production independently from the workflow receipt**

Re-check the API/Pages routes and exact release SHA. Verify root Tier 3 and `/execution/` Lite are both served from the same accepted deployment.

- [ ] **Step 8: Post final #170 candidate receipt**

Record exact source SHA, workflow run ID, Pages project/deployment identity, Worker deployment identity, exact controller/instruction/automation compatibility, Ethereum/Base scope, and pass/fail of every smoke gate. Do not include secrets or raw upstream bodies.

- [ ] **Step 9: Leave #170 open for #132 Stage 7 unless the issue's completion rule explicitly permits closure before independent acceptance**

The deployed v2 release is the candidate handed to Worker 4; it is not final Round 5 sign-off.
