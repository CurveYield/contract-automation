# Round 5 Tier 3 Audit-Controller Web Integration v2 — Design

**Status:** Approved implementation refinement  
**Date:** 2026-08-07  
**Parent:** Round 5 issue #125; implementation gate #170  
**Supersedes:** `2026-08-07-round5-tier3-audit-controller-web-integration-v1-design.md`

## 1. Purpose

v2 retains the v1 dependency order and GitHub-authoritative architecture, and makes two implementation discoveries explicit:

1. a project with `NO_ACTIVE_CAMPAIGN` has no campaign-bound mailbox, so hosted `campaign.create` requires a repository-level controller intake mailbox; and
2. the existing `PREFLIGHTSIM_GITHUB_TOKEN` is intentionally scoped to `CurveYield/contract-automation`, so audit-controller access requires a separate least-privilege credential rather than broadening or reusing the execution token.

The Round 5 order remains:

`Stages 1–6 stable → #170 Tier 3 implementation → #132 Stage 7 → Stage 8 recovery/rollback → final sign-off`.

## 2. Credential Separation

The production Worker uses two independent GitHub credentials:

- `PREFLIGHTSIM_GITHUB_TOKEN` → Worker binding `GITHUB_TOKEN`; restricted to `CurveYield/contract-automation` and used only for trusted compile/simulation workflow dispatch and existing contract-automation GitHub flows.
- `AUDIT_CONTROLLER_GITHUB_TOKEN` → Worker binding `AUDIT_CONTROLLER_GITHUB_TOKEN`; restricted to `CurveYield/audit-controller` with only repository metadata/read access, Contents read, and Issues read/write needed by the hosted projection/command adapter.

The two tokens must not be interchangeable in application code. The audit adapter must never receive `GITHUB_TOKEN`; compile/simulation dispatch must never receive `AUDIT_CONTROLLER_GITHUB_TOKEN`.

No token value may be rendered, logged, copied into issues, or exposed by compatibility/status routes.

## 3. Exact Production Compatibility Binding

The deployed Worker configuration must bind all of:

- `AUDIT_CONTROLLER_OWNER=CurveYield`;
- `AUDIT_CONTROLLER_REPO=audit-controller`;
- `AUDIT_CONTROLLER_REF=main`;
- `AUDIT_CONTROLLER_COMMIT=<exact accepted 40-character audit-controller main commit>`;
- `AUDIT_CONTROLLER_SKILL_RELEASE=ai-auditor-deep-assurance-v6@16.13.0`;
- `AUTOMATION_RELEASE=contract-automation@round5-tier3-v1` or its explicitly incremented successor;
- `AUDIT_CONTROLLER_INTAKE_ISSUE=64`;
- active chain scope exactly `ethereum,base`, with Base the browser default.

The compatibility API may expose release identities and `campaignCreateAvailable`, but it must not expose token values or the intake issue number.

A pointer/projection whose campaign ID, controller commit, skill release, or automation release disagrees with this compatibility contract is rejected before rendering or mutation.

## 4. Active-Campaign Hosted Path

For an active project:

1. read `.deep-assurance/active/<projectSlug>.json` from audit-controller `main`;
2. require `deep-assurance-active-pointer-v2`, `ACTIVE`, and `launchAuthorized: true`;
3. fetch the exact pointer-bound `HOSTED-OPERATOR-STATE-v1.json` from the exact campaign branch/path;
4. validate campaign/release binding;
5. render only allowlisted projection fields;
6. submit substantive commands only as one canonical `CURVEYIELD_AUDIT_COMMAND_V1` envelope to the pointer-bound campaign mailbox issue.

Posting the envelope is a request only. Authoritative state changes only when the browser controller/orchestrator validates and applies the command through `audit-controller`.

## 5. No-Active-Campaign Intake Path

For a project whose main pointer is the valid `NO_ACTIVE_CAMPAIGN` tombstone:

- only `campaign.create` with `actor.type: controller` may be submitted through the repository-level intake mailbox;
- the intake issue number comes only from trusted Worker configuration;
- an active project must fail closed if the intake path is attempted;
- successful comment creation does not imply that a campaign exists;
- the browser remains in a waiting/no-active state until a new authoritative active pointer and campaign projection are published.

The full campaign-create payload remains subject to current controller admission rules: exact source, `READY` capability preflight, current instruction policy/catalog, and the required Phase 0 orchestrator instruction-read proof.

## 6. Browser Command Safety

The operator page may compose only schema-v1 commands supported by the current reducer. UI availability is advisory; the controller remains authoritative.

- `instruction_read_proof.record` and `worker.register` are the only proof-bootstrap exemptions mirrored in UI advisory logic.
- Ordinary substantive commands require the exact accepted instruction proof for actor/session/role/phase when the controller policy requires one.
- Lease-bound commands use a dedicated password input; lease tokens are never put in browser storage and are cleared after every submit attempt.
- Payload JSON is forbidden from containing `leaseToken` or `instructionScope`; those use dedicated transient/scope fields so the UI can reason about authorization accurately.
- The browser never calls GitHub directly.
- Projection content is rendered with text-only DOM APIs, not HTML injection.

## 7. Stage 7 / Stage 8 Consequence

#132 Stage 7 must validate the exact Tier 3 release including:

- dedicated credential separation;
- active pointer/projection reads;
- inactive campaign-create intake;
- exact release mismatch rejection;
- instruction-proof and lease advisory states;
- authoritative-controller waiting/reload behavior after posted commands;
- all previously required Tier 3 read surfaces and accessibility/safe-rendering gates.

Stage 8 must redeploy and roll back the same complete release/configuration, including both GitHub credential bindings and exact controller compatibility pins.
