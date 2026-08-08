# Tier 3 Production Setup v2

## Scope

This supersedes `docs/setup-tier3-v1.md` for the Round 5 Tier 3 Deep Assurance browser integration.

The hosted operator now supports:

- freshness-enforced authoritative campaign reads; and
- session-capability-bound publication of exact controller command envelopes to GitHub mailboxes.

Compilation and pinned-fork simulation remain unchanged trusted subsystems. GitHub `audit-controller` state remains authoritative.

## Required additional GitHub secrets

Configure in the `CurveYield/contract-automation` production environment/repository secrets:

- `AUDIT_CONTROLLER_GITHUB_TOKEN`
- `AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN`

### Read credential

`AUDIT_CONTROLLER_GITHUB_TOKEN` is server-side only and restricted to `CurveYield/audit-controller`. It needs only the repository read permissions required to read hosted projections, hosted session authorization records and campaign-path commit history.

### Command credential

`AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN` is a separate server-side credential restricted to `CurveYield/audit-controller` and the issue-comment write capability required for validated mailbox command publication.

The command path does not require direct campaign-file writes, workflow dispatch, Actions administration, secret management or blockchain authority. Do not reuse `PREFLIGHTSIM_GITHUB_TOKEN` for either controller credential.

Neither controller credential may be exposed in Worker variables, browser storage, query parameters, issues, workflow receipts, screenshots or logs.

## Required repository variables

- `AUDIT_CONTROLLER_PROTOCOL_SHA` — exact lowercase 40-character Git commit containing the accepted compatible audit-controller protocol/projection implementation.
- `AUDIT_CONTROLLER_STATE_REF` — live controller state ref, normally `main`.

`AUTOMATION_RELEASE_SHA` is injected from the exact deployment `GITHUB_SHA` by the production deployment workflow.

## Exact-state freshness model

The Worker separates protocol compatibility from campaign freshness:

1. `AUDIT_CONTROLLER_PROTOCOL_SHA` pins the accepted controller implementation.
2. `AUDIT_CONTROLLER_STATE_REF` identifies the live controller branch.
3. The projection at `hosted-projections/v4/<campaignId>.json` declares its exact `campaignSource.path` and `campaignSource.commit`.
4. The Worker queries the latest commit that touched that exact campaign directory on the configured state ref.
5. The read succeeds only when that path-scoped latest commit exactly equals the projection's source commit.
6. The projection must also bind to the exact controller protocol SHA and exact automation release SHA.
7. The browser displays the verified exact campaign commit.

An unrelated campaign commit on the same branch does not invalidate the projection. Any later commit touching the target campaign directory does invalidate it until a new projection is published.

## Projection producer

The controller/orchestrator publishes derived campaign views under:

`CurveYield/audit-controller/hosted-projections/v4/<campaignId>.json`

Use `buildHostedProjectionV2` from `packages/hosted-projection/src/hosted-projection-v2.mjs` in the accepted controller release. Follow `CurveYield/audit-controller/docs/hosted-tier3-operation-v1.md`.

The projection is a regenerable view only and is never controller authority.

## Session-capability authorization

Hosted state-changing actions require a controller-issued authorization record at:

`CurveYield/audit-controller/hosted-authorizations/v1/<authorizationId>.json`

Create the record with `issueHostedSessionAuthorizationV1`. The record binds one campaign, actor, session, role, phase, mailbox issue, exact protocol SHA, allowed command types, instruction-proof key and expiry. It contains only the SHA-256 digest of the plaintext capability token.

The plaintext capability token is delivered to the authorized operator separately, is entered into the browser only for command publication, is never stored by the application, and is cleared from the input after each attempt.

## Command publication flow

The production browser POSTs only to:

`/api/v1/controller/campaigns/<campaignId>/commands`

The request contains exactly:

- `authorizationId`;
- `capabilityToken`; and
- one structured controller `command` object.

The Worker:

1. authenticates the normal browser API client;
2. reads the authorization with the read credential;
3. verifies exact campaign/protocol/actor/session/role/phase/expiry/token-hash binding;
4. validates the command against the current controller command catalog and exact command-envelope markers;
5. rejects request-selected repository or issue targeting;
6. posts exactly one envelope to the authorization-bound mailbox issue using the separate command credential; and
7. returns a bounded `SUBMITTED_TO_CONTROLLER_MAILBOX` receipt.

The browser must reload authoritative state after normal controller reconciliation. Mailbox submission itself is not controller acceptance.

## Active network scope

The Tier 3 production browser remains exactly:

- Ethereum;
- Base;
- Base as the sole browser default.

Katana, Fraxtal, Arbitrum, Polygon and Optimism remain deferred. The Tier 3 controller adapter does not expand the active network set.

## Deployment preparation

The feature-branch production deployment workflow has been updated to:

- require both controller credentials by name;
- upload both only through Worker secret bulk provisioning;
- never pass either controller credential with `--var`;
- require and validate the exact controller protocol SHA and live state ref; and
- continue injecting the exact automation deployment SHA.

The production deployment workflow triggers only from the approved release branch/request path. Editing it on `round5/tier3-audit-controller-web-v1` does not authorize or perform a production deployment.

## Production activation prerequisites

Do not promote or deploy this Tier 3 command path until:

1. the controller projection/authorization branch is reviewed and accepted into the controller release;
2. the exact accepted controller protocol SHA is selected;
3. both controller secrets are configured with minimum permissions;
4. the feature branch verification suite passes;
5. one exact Tier 3 production candidate is promoted under Round 5 issue #170; and
6. Worker 4 issue #132 remains reserved for independent Stage 7 acceptance of that candidate.
