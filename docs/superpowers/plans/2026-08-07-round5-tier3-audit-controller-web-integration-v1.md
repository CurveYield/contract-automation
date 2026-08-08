# Round 5 Tier 3 Audit-Controller Web Integration v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Round 5 browser application from PreflightSim Lite to a complete Tier 3 Deep Assurance operator surface without creating a second audit-controller authority.

**Architecture:** `CurveYield/audit-controller` remains authoritative and publishes a bounded hosted projection derived from controller state. The Cloudflare Worker in `CurveYield/contract-automation` reads the main-branch active project pointer plus the exact campaign-branch projection, and submits canonical `CURVEYIELD_AUDIT_COMMAND_V1` envelopes to the campaign mailbox issue. The Pages UI renders the projection and submits validated commands while existing compile/simulate jobs remain an independent trusted subsystem.

**Tech Stack:** Node.js 22 ESM; dependency-free audit-controller core/projection tests; Cloudflare Worker fetch API; static HTML/CSS/ES modules; existing GitHub token and client bearer authentication; no new dependencies.

## Global Constraints

- No dependency installation.
- No smart-contract compilation.
- No wallet keys, seed phrases, signers, raw signed transactions, or public-chain broadcast paths.
- Active browser/RPC scope remains exactly Ethereum and Base, with Base as the sole default.
- `CurveYield/audit-controller` GitHub state remains authoritative.
- The hosted layer is a projection and validated command adapter, never a second controller event ledger or reducer.
- GitHub-only browser-agent audits remain functional if Cloudflare is unavailable.
- Every substantive command remains subject to the controller's instruction-read proof, role/phase/session, lease, replay/idempotency, gate, evidence, remediation, publication, delivery, and finalization rules.
- Historical Lite browser acceptance remains infrastructure evidence only and does not satisfy final Stage 7.
- New files use explicit `v1` version suffixes; edits must increment versions when the repository's versioned-file convention requires a new immutable artifact.

---

### Task 1: Audit-controller hosted projection contract

**Files:**
- Create in `CurveYield/audit-controller`: `packages/controller-core/test/hosted-operator-projection-v1.test.mjs`
- Create in `CurveYield/audit-controller`: `packages/controller-core/src/hosted-operator-projection-v1.mjs`
- Create in `CurveYield/audit-controller`: `protocol/schemas/hosted-operator-state-v1.schema.json`
- Create in `CurveYield/audit-controller`: `protocol/schemas/hosted-campaign-pointer-v1.schema.json`
- Modify in `CurveYield/audit-controller`: `docs/chat-agent-operation.md`

**Interfaces:**
- Produces: `projectHostedOperatorStateV1(state, compatibility)` -> JSON-safe hosted projection.
- Produces: `projectHostedCampaignPointerV1(input)` -> active project pointer for `.deep-assurance/active/<projectSlug>.json`.
- The hosted state contains campaign/source/preflight/status/topology/gates/workers/assignments/instruction-proof summaries/publication/delivery/event metadata plus optional report/findings/remediation summaries if present.
- The projection excludes lease tokens/hashes, raw evidence refs, raw event payloads, session prompt hashes, signed URLs, RPC URLs, secrets, host paths, stack traces, and unredacted upstream errors.

- [ ] **Step 1: Write RED projection tests.** Test exact schema/version/compatibility binding, PASS/NO_GO separation, gate and assignment summaries, accepted instruction-proof summary, event metadata without payload, and rejection/omission of sensitive fields.
- [ ] **Step 2: Verify RED.** Run `node --test packages/controller-core/test/hosted-operator-projection-v1.test.mjs`; expected failure is `ERR_MODULE_NOT_FOUND` for `hosted-operator-projection-v1.mjs`.
- [ ] **Step 3: Implement the minimal projection module.** Use allowlisted fields only; never recursively copy reducer objects wholesale.
- [ ] **Step 4: Verify GREEN.** Run the targeted projection test and the existing dependency-free controller-core tests.
- [ ] **Step 5: Add the two JSON Schemas and operating rule.** Active pointers for hosted-capable campaigns must bind `controllerBranch`, `workspacePath`, `campaignId`, `campaignGenerationId`, `mailboxIssueNumber`, `projectionPath`, `controllerCommit`, and `skillReleaseIdentity`. The campaign branch must publish the projection at the bound `projectionPath` after every accepted controller state mutation before hosted UI state may claim to be current.
- [ ] **Step 6: Commit on `hosted-ui/tier3-adapter-v1`.**

### Task 2: Cloudflare GitHub controller adapter

**Files:**
- Create: `apps/api/test/audit-controller-adapter-v1.test.mjs`
- Create: `apps/api/src/audit-controller-adapter-v1.mjs`
- Modify: `apps/api/src/index.mjs`

**Interfaces:**
- `createAuditControllerAdapterV1({ fetcher, token, owner, repo, mainRef })`.
- `getProject(projectSlug)` reads `.deep-assurance/active/<slug>.json`, validates the pointer, then fetches the exact campaign-branch projection and rejects release/path/campaign mismatches.
- `submitCommand({ projectSlug, command })` resolves the active pointer, renders exactly one canonical v1 command envelope, and posts it to the bound campaign mailbox issue.
- Routes: `GET /api/v1/audit/projects/:slug`, `POST /api/v1/audit/projects/:slug/commands`, and `GET /api/v1/audit/compatibility`.

- [ ] **Step 1: Write RED adapter tests.** Cover active pointer + projection success, `NO_ACTIVE_CAMPAIGN`, malformed slug/path, mismatched campaign/release, GitHub 404/403 normalization, exact command markers, prototype-pollution rejection, and no raw GitHub error/body reflection.
- [ ] **Step 2: Verify RED.** Run `node --test apps/api/test/audit-controller-adapter-v1.test.mjs`; expected failure is missing adapter module.
- [ ] **Step 3: Implement the minimal adapter.** Use only GitHub Contents/Issues APIs under `CurveYield/audit-controller`; base64-decode bounded JSON; canonicalize command JSON; never log token or GitHub response bodies.
- [ ] **Step 4: Wire authenticated API routes.** Existing client authentication remains mandatory; `GITHUB_TOKEN` stays Worker-side. CORS remains exact production-origin controlled.
- [ ] **Step 5: Verify GREEN.** Run the targeted adapter test and existing API tests that require no installed dependencies.
- [ ] **Step 6: Commit on `round5/tier3-web-integration-v1`.**

### Task 3: Browser API client and Tier 3 state model

**Files:**
- Create: `apps/web/test/tier3-model-v1.test.mjs`
- Create: `apps/web/src/tier3-model-v1.mjs`
- Modify: `apps/web/src/client.mjs`

**Interfaces:**
- Client methods: `getAuditCompatibility()`, `getAuditProject(projectSlug)`, `submitAuditCommand(projectSlug, command)`.
- Model functions: `normalizeHostedAuditStateV1(payload)`, `deriveAuditProgressV1(state)`, `deriveInstructionAuthorizationV1(state)`, and `deriveOperatorActionsV1(state)`.
- Model never manufactures controller state; all derived labels/actions must be functions of authoritative projection fields.

- [ ] **Step 1: Write RED model/client tests.** Cover DRAFT/ACTIVE/COMPLETE, process FAIL versus finding severity, COMPLETE+PASS versus COMPLETE+NO_GO, proof missing/stale/accepted, lease-expired state, and mixed-version rejection.
- [ ] **Step 2: Verify RED.** Run targeted Node tests; expected failure is missing Tier 3 model functions/client methods.
- [ ] **Step 3: Implement minimal model and client methods.** Reject unknown projection schema/release incompatibility visibly.
- [ ] **Step 4: Verify GREEN.** Run targeted tests.
- [ ] **Step 5: Commit.**

### Task 4: Tier 3 operator UI shell and read surfaces

**Files:**
- Create: `apps/web/public/audit-v1.html`
- Create: `apps/web/public/audit-v1.js`
- Create: `apps/web/public/audit-v1.css`
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/styles.css` only if shared navigation requires it.
- Create: `apps/web/test/tier3-operator-ui-v1.test.mjs`

**Interfaces:**
- Project selector accepts a bounded project slug and loads only through the authenticated Worker API.
- Required read panels: exact release/source identity; capability preflight; campaign completion/security verdict; 10 phases/gates; 7 lanes/assignments; worker/session authorization; instruction-read proof state; findings/remediation/report summaries when published; publication/delivery status; bounded event timeline; compile/simulation evidence links provided by the projection.

- [ ] **Step 1: Write RED static/UI-contract tests.** Assert required landmarks/IDs, accessibility labels/live regions, no wallet/broadcast controls, exact Ethereum/Base scope retained in the Lite subsystem, and no direct browser GitHub token field.
- [ ] **Step 2: Verify RED.** Run `node --test apps/web/test/tier3-operator-ui-v1.test.mjs`; expected failure is missing audit files/navigation.
- [ ] **Step 3: Implement the read-only Tier 3 shell.** Render text with `textContent`; do not inject projection HTML. Preserve Lite compile/simulate as a separate navigation destination/subsystem.
- [ ] **Step 4: Verify GREEN.** Run UI-contract and Tier 3 model tests.
- [ ] **Step 5: Commit.**

### Task 5: Tier 3 command composer and fail-closed action states

**Files:**
- Modify: `apps/web/public/audit-v1.html`
- Modify: `apps/web/public/audit-v1.js`
- Modify: `apps/web/src/tier3-model-v1.mjs`
- Modify: `apps/web/test/tier3-model-v1.test.mjs`
- Modify: `apps/web/test/tier3-operator-ui-v1.test.mjs`

**Interfaces:**
- Command composer creates schemaVersion `1` commands with explicit `commandId`, actor `{type,id}`, `type`, and object `payload`.
- High-risk controller semantics remain server/controller validated; UI availability is advisory only.
- Lease token inputs, when a controller command requires them, use password fields, are never stored in local/session storage, are cleared after submission, and are never rendered in the event/result panels.
- Instruction proof commands require the exact controller-defined proof object; substantive actions show blocked state when the projection says authorization is absent/stale/mismatched.

- [ ] **Step 1: Add RED tests for command construction and blocked states.** Include proof-required blocking, lease-token non-persistence, commandId requirement, actor binding, and stale projection warning.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement the minimal composer.** Submit only through `submitAuditCommand`; never directly call GitHub from Pages.
- [ ] **Step 4: Verify GREEN.** Run Tier 3 model/UI/client/adapter tests.
- [ ] **Step 5: Commit.**

### Task 6: Version binding, safe deployment candidate, and #170 evidence

**Files:**
- Create: `packages/runner/test/audit-round5-tier3-web-integration-v1.test.mjs`
- Create: `.agent-control/v1/orchestrator/TIER3_WEB_INTEGRATION_REQUEST_v1.json` only after the verification workflow/source is preinstalled and exact-parent bound.
- Create or increment a versioned Round 5 deployment/verification workflow rather than editing historical immutable receipts/workflows.
- Update: `docs/setup.md` with controller-side GitHub token permissions and exact compatibility pins.
- Update issue #170 with sanitized receipts.

**Interfaces:**
- Production candidate declares exact `contract-automation` source SHA, exact `audit-controller` commit, exact skill release identity, active Ethereum/Base scope, and projection schema version.

- [ ] **Step 1: Write RED release-contract test.** Require all Tier 3 files/routes/version pins and reject Lite-only production acceptance as #170 completion evidence.
- [ ] **Step 2: Verify RED.** Run the dependency-free release-contract test before deployment workflow/request creation.
- [ ] **Step 3: Add the new versioned verification/deployment workflow and exact-parent request.** No historical workflow reruns. No secret values in issue receipts.
- [ ] **Step 4: Run dependency-free source tests first.** Do not install dependencies or compile contracts as part of this development verification. If final Pages deployment requires the repository's existing dependency-backed build, treat that as a separate deployment gate and do not silently perform it without the operator's existing authorization boundary.
- [ ] **Step 5: Publish sanitized #170 evidence.** Include exact SHAs, schema/release compatibility, tests executed, no-dependency/no-contract-compile statement, and remaining deployment gate if any.
- [ ] **Step 6: Do not activate #132 until #170 has one exact deployed Tier 3 candidate.**
