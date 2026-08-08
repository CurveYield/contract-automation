# Round 5 Tier 3 Audit-Controller Web Integration v2 Implementation Plan

> Supersedes v1 only for the additional pre-campaign intake requirement discovered during implementation. All unchanged v1 tasks and constraints remain in force.

**Goal:** Complete the Tier 3 hosted operator surface while preserving GitHub authority, including safe creation requests when a project has `NO_ACTIVE_CAMPAIGN` and therefore no campaign-bound mailbox.

## Added requirement — pre-campaign intake

- Create one repository-level audit-controller intake issue dedicated to hosted `campaign.create` requests.
- Configure its numeric issue ID only in trusted Worker configuration as `AUDIT_CONTROLLER_INTAKE_ISSUE`.
- Extend the hosted adapter with `submitCampaignCreate({ projectSlug, command })`.
- The method must read the main-branch project pointer first and accept only `NO_ACTIVE_CAMPAIGN`.
- It must accept only command type `campaign.create` and controller actor type.
- It posts one canonical `CURVEYIELD_AUDIT_COMMAND_V1` envelope to the configured intake issue.
- A successful GitHub comment is only an accepted request; it does not imply campaign creation.
- Compatibility exposes only `campaignCreateAvailable: true|false`, never the issue number.
- Add `POST /api/v1/audit/projects/:slug/campaigns` and browser client `submitAuditCampaignCreate(projectSlug, command)`.
- The UI shows campaign creation only for an inactive project and shows a waiting state after submission until a new authoritative pointer/projection appears.
- Active campaign commands continue to use only the pointer-bound campaign mailbox.

## TDD addition before Task 5

1. Extend adapter tests for inactive-only campaign creation, exact command type/actor, configured-intake requirement, bounded response, and zero GitHub mutation on invalid/active state.
2. Extend route/client tests for `/campaigns`.
3. Extend browser model/UI tests for command construction, proof-exempt controller mechanics, transient lease-token handling, and no local/session storage of lease tokens.
4. Implement the generic command composer and inactive campaign-create panel only after those RED checks fail for the expected missing behavior.

## Completion relationship

The Tier 3 implementation gate #170 cannot be complete if the browser can inspect campaigns but cannot request a new Deep Assurance campaign from the `NO_ACTIVE_CAMPAIGN` state.
