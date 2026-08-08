# Round 5 Tier 3 Clean Implementation v2 — Design

**Status:** Approved by account owner through #170 and current deployment authorization  
**Date:** 2026-08-08  
**Parent:** #170, superseding the experimental `audit-round5/tier3-controller-ui-v1` candidate only  
**Accepted release base:** `orchestrator/round4-ci-base-v1` at `2df81aacb6f5747f06b49297e89e02c3f013d4ef`

## Purpose

Implement the complete hosted Deep Assurance / audit-controller Tier 3 operator surface without modifying the accepted PreflightSim Lite browser experience that already passed production infrastructure acceptance.

The v1 experiment proved the controller protocol, read adapter, command adapter, browser presenter, detailed projection model, and secret-bound deployment wiring, but it also replaced the accepted Lite root UI. v2 keeps the tested controller components and changes the topology so Tier 3 is additive rather than invasive.

## Topology

```text
https://preflight.curveyield.online/
    Tier 3 Deep Assurance operator shell
        |
        +--> authenticated /api/v1/controller/* adapter
        |       |
        |       +--> fixed CurveYield/audit-controller GitHub-native state
        |       +--> canonical CURVEYIELD_AUDIT_COMMAND_V1 mailbox requests
        |
        +--> /execution/
                exact accepted PreflightSim Lite static tree

https://api.preflight.curveyield.online/
    Tier 3 entry wrapper
        |
        +--> /api/v1/controller/* : controller adapter/command adapter
        +--> every other route   : accepted Lite API unchanged
```

`CurveYield/audit-controller` remains authoritative. The hosted layer is only a bounded state projection and validated command transport. It never applies controller events, invents campaign state, bypasses instruction-read proofs or leases, or creates a second finalization path.

## Browser Isolation

The accepted Lite source tree under `apps/web/public/` is immutable for this implementation. v2 must not edit `apps/web/public/index.html`, `apps/web/public/app.js`, `apps/web/public/styles.css`, the accepted agent pages, or privacy page.

The build creates two static surfaces:

1. copy `apps/web/public/` unchanged to `dist/web/execution/` and copy the accepted browser client to `dist/web/execution/client.js`;
2. copy a new Tier 3-only source tree from `apps/web/tier3/` to `dist/web/` and copy only Tier 3 client/presenter/model modules required by that root shell.

The Tier 3 shell contains a prominent link to `/execution/`. The Lite application remains internally self-consistent because all of its relative assets and links move together under the same `/execution/` subtree.

## API Isolation

The accepted Lite API implementation in `apps/api/src/index.mjs` remains unchanged.

`apps/api/src/entry.mjs` is the only accepted API routing file modified. It may:

- include Tier 3 readiness in `/api/v1/setup`;
- intercept only `/api/v1/controller/*` routes;
- delegate controller GET/OPTIONS requests to the tested read adapter;
- delegate controller POST/OPTIONS requests to the tested command adapter;
- pass every other request to the existing Lite worker with the existing Ethereum/Base production allowlist behavior unchanged.

The v1-tested controller adapters are transplanted as focused new modules rather than folded into `index.mjs`.

## Controller Compatibility

The hosted adapter is fixed to:

- repository: `CurveYield/audit-controller`;
- ref: `main`;
- process: `deep-assurance-v6`;
- instruction release: `ai-auditor-deep-assurance-v6@16.13.0`;
- intake issue: `64` for inactive-project `campaign.create` requests;
- automation repository: `CurveYield/contract-automation`.

The adapter validates the exact hosted controller compatibility contract implemented and tested in the v1 branch. A mixed or unsupported pointer/projection/release fails closed instead of rendering guessed state.

## Credential Boundary

The existing `PREFLIGHTSIM_GITHUB_TOKEN` remains dedicated to `CurveYield/contract-automation` execution/bridge operations.

Tier 3 uses repository secret `PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN`, exposed to the Worker only as `AUDIT_CONTROLLER_GITHUB_TOKEN`. It is restricted to `CurveYield/audit-controller` and the minimum contents-read / issues-read-write permissions required by the adapter.

No browser response, compatibility payload, issue receipt, log, or static asset may contain either GitHub token.

## Controller Command Boundary

The browser may submit one structured command object to the hosted API. It cannot provide a repository, branch, issue number, mailbox URL, or GitHub credential.

The Worker resolves routing from authoritative controller state:

- valid `NO_ACTIVE_CAMPAIGN` + exact `campaign.create` → trusted intake issue 64;
- valid active campaign → pointer-bound campaign mailbox;
- all mismatched or invalid states → fail closed.

Posting a GitHub comment means only “request queued.” The browser must reload authoritative controller state before representing a transition as accepted.

## Tier 3 Browser Surface

The root shell provides:

- API connection/authentication;
- project-slug load;
- exact controller and instruction release identity;
- active/no-active campaign state and exact source;
- phase/gate summary;
- lane summary;
- instruction-proof summary;
- assignments/leases/submission/review summary;
- findings and residual-risk summary;
- remediation summary;
- evidence/artifact summary;
- completion status distinct from PASS/NO_GO verdict;
- bounded structured controller-command queueing;
- detailed controller projection rendering using the tested detail model;
- a direct transition to the accepted `/execution/` Lite subsystem.

All controller-derived copy is rendered as text, never trusted HTML.

## Production Chain Scope

The active execution scope remains exactly Ethereum and Base. Base remains the browser default. Tier 3 does not activate Katana, Fraxtal, Arbitrum, Polygon, Optimism, or any wallet/broadcast path.

## Build and Deployment

The existing production deployment workflow is retained. The v2 candidate may add only the controller secret binding/required-name check needed for Tier 3. Dependency installation is now explicitly authorized by the account owner for this deployment, so the existing pinned `npm install --ignore-scripts --no-audit --no-fund` plus `npx --no-install wrangler` path may be used after source verification.

No deployment is triggered by ordinary v2 development commits. A one-shot deployment request is created only after:

1. v2 tests pass;
2. accepted Lite-source immutability is proven;
3. build output proves `/execution/` matches the accepted Lite source tree;
4. controller/API security tests pass;
5. the v2 candidate is promoted to the release branch or the deployment gate is explicitly updated to one exact trusted candidate source;
6. required production configuration names, including `PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN`, are present.

## Verification Gates

The implementation must prove:

- v2 branch descends directly from the accepted Round 5 release;
- no accepted Lite static source file changed;
- non-controller API behavior remains delegated to the accepted worker;
- controller routing is isolated to `/api/v1/controller/*`;
- controller token and execution token are separate;
- browser controller state is bounded and safely rendered;
- command routing cannot accept browser-selected mailbox targets;
- inactive campaign create and active campaign command routing fail closed on mismatches;
- exact Ethereum/Base scope is preserved;
- JavaScript syntax passes;
- full repository tests pass after the now-authorized dependency install;
- build output contains a Tier 3 root plus byte-identical accepted Lite source assets under `/execution/` (apart from the generated `client.js` copy expected by the accepted build);
- production deployment and browser/API smoke checks pass before #170 is considered deployed.

## Stage 7 Handoff

Successful deployment does not close Round 5. It produces one exact Tier 3 production candidate for independent Worker 4 acceptance under #132. Stage 7 must test the deployed v2 surface; Stage 8 recovery/rollback follows only after that acceptance.