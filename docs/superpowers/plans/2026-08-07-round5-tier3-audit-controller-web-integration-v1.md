# Round 5 Tier 3 Audit-Controller Web Integration v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the production browser from PreflightSim Lite into a Tier 3 Deep Assurance operator surface while preserving GitHub `audit-controller` state as authoritative and keeping compile/simulate as a trusted subsystem.

**Architecture:** Add a read-first controller projection/compatibility adapter to the existing Cloudflare API, then add validated controller command submission only through versioned structured envelopes. The browser consumes those adapter routes, renders campaign/controller state separately from execution jobs, and refuses stale or incompatible controller releases rather than inventing local authority.

**Tech Stack:** Node.js 22 ESM; Cloudflare Worker/Pages; vanilla HTML/CSS/JavaScript; GitHub REST through the existing server-side GitHub credential boundary; zero new dependencies.

## Global Constraints

- No dependency installation.
- No smart-contract compilation.
- `CurveYield/audit-controller` GitHub records remain authoritative.
- The hosted UI must not become a second controller ledger or campaign state machine.
- The `audit-controller` repository remains GitHub-native and actionless.
- GitHub-only browser-agent audits must continue to work without Cloudflare.
- Compilation and simulation remain under the trusted `contract-automation` execution boundary.
- Active browser/RPC network scope remains exactly Ethereum and Base, with Base as default.
- Preserve instruction-read-proof, lease, replay/idempotency, evidence, remediation, and finalization rules.
- No wallet/signing/raw-transaction/broadcast capability.
- No secrets, raw RPC URLs, host paths, stack traces, or unredacted upstream errors in browser responses.

---

### Task 1: Tier 3 projection contract and release compatibility

**Files:**
- Create: `packages/protocol/src/tier3-controller-v1.mjs`
- Create: `packages/protocol/test/tier3-controller-v1.test.mjs`
- Modify: `packages/protocol/src/index.mjs`

**Interfaces:**
- Produces: `TIER3_CONTROLLER_ADAPTER_VERSION_V1`, `normalizeControllerProjectionV1(value)`, and `assertControllerCompatibilityV1(value)`.
- Consumers: API adapter routes and browser client.

- [ ] Write failing dependency-free Node tests that reject missing release identity, malformed campaign/phase/lane/proof/finding/report fields, completion/verdict conflation, and unsupported network scope.
- [ ] Run `node --test packages/protocol/test/tier3-controller-v1.test.mjs` and verify RED.
- [ ] Implement the minimal normalization/compatibility contract with exact Ethereum/Base scope and explicit completion/verdict separation.
- [ ] Re-run the targeted test and verify GREEN.
- [ ] Commit the protocol slice.

### Task 2: Read-only GitHub controller projection adapter

**Files:**
- Modify: `apps/api/src/index.mjs`
- Create: `apps/api/test/tier3-controller-projection-v1.test.mjs`

**Interfaces:**
- Consumes: `normalizeControllerProjectionV1` and server-side GitHub token/owner/repository configuration.
- Produces: authenticated `GET /api/v1/controller/compatibility` and `GET /api/v1/controller/campaigns/:campaignId` routes.

- [ ] Write failing tests for authorization, exact repository binding, upstream redaction, compatibility mismatch, not-found behavior, and successful bounded projection.
- [ ] Run the targeted API test and verify RED.
- [ ] Implement a fail-closed server-side GitHub fetch helper restricted to `CurveYield/audit-controller` and versioned controller records; never accept a caller-supplied repository or arbitrary URL.
- [ ] Implement compatibility and campaign projection routes returning only normalized bounded fields.
- [ ] Re-run targeted tests and verify GREEN.
- [ ] Commit the read-only adapter slice.

### Task 3: Tier 3 browser client and operator shell

**Files:**
- Modify: `apps/web/src/client.mjs`
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/app.js`
- Modify: `apps/web/public/styles.css`
- Create: `apps/web/test/tier3-operator-shell-v1.test.mjs`

**Interfaces:**
- Consumes: controller compatibility/projection API routes plus existing compile/simulation client methods.
- Produces: controller connection status, campaign lookup, release compatibility banner, Tier 3 summary cards, phase/lane/proof/finding/remediation/report sections, and unchanged compile/simulate subsystem.

- [ ] Write failing static/client tests requiring Tier 3 navigation/landmarks, distinct completion/verdict rendering, instruction-proof visibility, exact release identifiers, campaign loading/error states, and exactly Ethereum/Base with Base default.
- [ ] Run targeted browser tests and verify RED.
- [ ] Add client methods for compatibility and campaign projection.
- [ ] Upgrade the browser shell to make Deep Assurance the primary product surface while retaining compile/simulation as an execution panel.
- [ ] Implement bounded rendering with text-only insertion and explicit stale/incompatible/error states.
- [ ] Re-run targeted tests and verify GREEN.
- [ ] Commit the browser projection slice.

### Task 4: Versioned structured controller command adapter

**Files:**
- Create: `packages/protocol/src/tier3-controller-command-v1.mjs`
- Create: `packages/protocol/test/tier3-controller-command-v1.test.mjs`
- Modify: `packages/protocol/src/index.mjs`
- Modify: `apps/api/src/index.mjs`
- Create: `apps/api/test/tier3-controller-command-v1.test.mjs`
- Modify: `apps/web/src/client.mjs`
- Modify: `apps/web/public/app.js`

**Interfaces:**
- Produces: strict `POST /api/v1/controller/commands` accepting only versioned structured command envelopes mapped to the current audit-controller protocol.
- No direct campaign snapshot, finding array, report, assignment, or event-chain mutation is permitted.

- [ ] Write RED protocol tests for unknown command types, arbitrary repository/URL/path input, missing instruction proof binding, replay key absence, malformed actor/session/role/phase scope, and unsupported direct state mutation.
- [ ] Implement minimal strict command-envelope validation.
- [ ] Write RED API tests proving server-side repository pinning and redacted GitHub publication failures.
- [ ] Implement bounded GitHub issue/comment publication using the pinned controller repository and accepted command envelope only.
- [ ] Add browser command submission only for commands that the current controller release explicitly supports; disabled controls explain missing proof/lease/gate authority.
- [ ] Run targeted tests and verify GREEN.
- [ ] Commit the command-adapter slice.

### Task 5: Tier 3 state coverage and safe rendering

**Files:**
- Modify: `apps/web/public/index.html`
- Modify: `apps/web/public/app.js`
- Modify: `apps/web/public/styles.css`
- Modify: `apps/web/test/tier3-operator-shell-v1.test.mjs`

**Interfaces:**
- Consumes: normalized campaign projection and command results.
- Produces: loading, empty, ready, active, waiting, stale, unauthorized, forbidden, not-found, conflict/replay/lease-expiry, retryable failure, validation failure, operator-intervention, COMPLETE/PASS, and COMPLETE/NO_GO presentation.

- [ ] Add RED fixtures/assertions for every required state and hostile/Unicode/bidi/oversized text handling.
- [ ] Implement state-specific status language and focusable error/status regions without `innerHTML` for controller-supplied content.
- [ ] Verify no process `FAIL` is rendered as a security finding and no security verdict is rendered as process completion.
- [ ] Run targeted tests and verify GREEN.
- [ ] Commit the state/safe-rendering slice.

### Task 6: Dependency-free verification and Round 5 handoff

**Files:**
- Modify: `docs/setup.md`
- Create: `docs/superpowers/specs/2026-08-07-round5-tier3-implementation-receipt-v1.md`
- Update: issue `#170` with exact commit/test evidence.

**Interfaces:**
- Produces: exact implementation candidate SHA and a bounded handoff for independent Worker 4 Stage 7 acceptance.

- [ ] Run all newly added Node 22 targeted tests without installing dependencies.
- [ ] Run repository dependency-free syntax/check commands that do not compile contracts or download packages.
- [ ] Re-fetch all modified files from GitHub and compare expected release/version/network/controller invariants.
- [ ] Record exact compatible `audit-controller` and `contract-automation` release identities.
- [ ] Publish the implementation receipt and issue #170 evidence.
- [ ] Do not mark #170 complete or activate #132 unless verification proves the required Tier 3 gate is actually met.
