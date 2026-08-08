# Tier 3 Production Setup v1

## Scope

This supplements `docs/setup.md` for the Round 5 Tier 3 Deep Assurance browser integration.

The hosted controller surface is read-only until a future version introduces session-bound Deep Assurance actor authentication. Compilation and simulation remain unchanged trusted subsystems.

## Required additional GitHub secret

Configure in `CurveYield/contract-automation` production environment/repository secrets:

- `AUDIT_CONTROLLER_GITHUB_TOKEN`

This credential is server-side only. It must be restricted to `CurveYield/audit-controller` and needs only the repository read permissions required by the active read-only adapter. Do not reuse `PREFLIGHTSIM_GITHUB_TOKEN`, which is scoped to `CurveYield/contract-automation` execution dispatch.

Do not expose or copy the token into issues, browser storage, workflow receipts, screenshots, or logs.

## Required additional repository variables

- `AUDIT_CONTROLLER_PROTOCOL_SHA` — exact lowercase 40-character Git commit containing the accepted compatible audit-controller protocol/projection implementation.
- `AUDIT_CONTROLLER_STATE_REF` — live controller state ref, normally `main`.

`AUTOMATION_RELEASE_SHA` is not configured manually. The production deployment workflow injects the exact deployment `GITHUB_SHA` into the Worker at deploy time.

## Exact-state model

The Worker separates immutable protocol compatibility from live campaign state:

1. `AUDIT_CONTROLLER_PROTOCOL_SHA` pins the accepted controller implementation.
2. `AUDIT_CONTROLLER_STATE_REF` identifies the live state branch.
3. Each API read resolves that ref to an exact commit.
4. The campaign projection is fetched at that exact commit.
5. The projection must bind to the pinned protocol SHA and exact automation release SHA.
6. The browser displays the resolved exact state commit.

A stale/incompatible projection fails closed with a bounded error.

## Projection producer

The controller/orchestrator publishes derived campaign views under:

`CurveYield/audit-controller/hosted-projections/v3/<campaignId>.json`

Use the controller's `buildHostedProjectionV3` projection builder from authoritative state. The projection is a regenerable view only; it never becomes controller authority.

## Current hosted mutation boundary

The existing browser bearer key authenticates access to the hosted application but does not cryptographically prove a Deep Assurance actor/session.

Therefore this release must not expose a reducer-command submission endpoint or controls that let a browser-key holder choose an arbitrary controller/worker actor. Such a path could impersonate an actor whose instruction proof is already accepted.

State-changing controls remain disabled until a later reviewed authentication design binds a hosted request to the exact actor/session/role/phase and preserves instruction-proof, lease, replay/idempotency, gate, evidence, remediation and finalization authorization.

GitHub-native browser-agent operation remains fully available and authoritative.

## Deployment

The existing production deployment workflow has been prepared to:

- require `AUDIT_CONTROLLER_GITHUB_TOKEN` by name;
- require and validate `AUDIT_CONTROLLER_PROTOCOL_SHA` and `AUDIT_CONTROLLER_STATE_REF`;
- upload the controller credential as a Worker secret;
- inject the exact automation deployment SHA plus controller protocol/state bindings as Worker variables.

Do not run production deployment until the implementation branch is independently verified and the account owner has configured the additional secret and variables.
