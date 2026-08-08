# Round 5 Tier 3 Current Controller Integration v3 — Design Addendum

**Status:** Current release design  
**Date:** 2026-08-08  
**Supersedes for release compatibility:** v16.13 controller assumptions in `2026-08-08-round5-tier3-clean-v2-design.md`  
**Preserves:** clean-v2 browser/API isolation topology

## Current Release Tuple

The production Tier 3 surface targets the current Deep Assurance Phase-0 contract:

- adapter: `tier3-controller-adapter-v2`;
- controller repository: `CurveYield/audit-controller`;
- controller compatibility commit: `48b031f06c7d7ed3573b42e371e123299722b451`;
- controller release identity: `audit-controller@48b031f06c7d7ed3573b42e371e123299722b451`;
- process: `deep-assurance-v6`;
- instruction release: `ai-auditor-deep-assurance-v6@16.14.0`;
- contract-automation compatibility commit: `ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8`;
- network scope: exactly Ethereum and Base, Base default.

## Current Active-Pointer Semantics

A `deep-assurance-active-pointer-v2` can represent an `ACTIVE` controller campaign while Phase-0 launch remains fenced. `ACTIVE` does not imply assignment claims, source access, or substantive work are authorized.

The current hosted adapter therefore validates the active pointer and controller-create receipt, derives the workspace from `controllerCampaignCreateReceipt`, and reads only bounded control-plane records needed to represent operator state:

- `CONTROLLER_CAMPAIGN_CREATE_RECEIPT-v1.json`;
- `CONTROLLER_TOPOLOGY-v1.json`;
- `ASSIGNMENT_PLAN-v1.json`;
- `FAILOVER_STATE-v1.json`;
- `ORCHESTRATOR_LEASE-v1.json`.

It emits `controller-operator-state-v2` rather than requiring the retired v16.13 pointer-embedded hosted projection path.

## Phase-0 Authorization Boundary

For a bootstrap-fenced campaign the hosted projection separately exposes:

- campaign status;
- `launchAuthorized`;
- assignment-plan bootstrap status;
- claim authorization;
- source-access authorization;
- topology assignment-claim authorization;
- substantive-work authorization;
- failover health;
- orchestrator authority state.

The current browser enables hosted command submission only from the explicit authoritative `project.commandRouting` result. An active Phase-0 campaign with `launchAuthorized=false` is rendered read-only with reason `PHASE0_BOOTSTRAP_FENCED`.

The server rejects active-campaign hosted mutation before GitHub write while that fence is present. If launch later becomes authorized but the controller still has not published an authoritative hosted mailbox binding, the server remains fail-closed with `controller_mailbox_unpublished`.

The browser and Worker never infer a mailbox issue number from campaign metadata.

## No-Active-Campaign Boundary

A valid legacy `NO_ACTIVE_CAMPAIGN` tombstone may route only `campaign.create` from a controller actor through trusted intake issue 64. The issue number is Worker configuration and is never browser input.

A queued intake comment is not a campaign transition. The browser must reload authoritative controller state before representing campaign creation as accepted.

## Redaction Boundary

The current projection is allowlist-only. In particular it does not return:

- GitHub credentials;
- raw poll task IDs;
- raw lease tokens or token hashes;
- arbitrary control-plane file contents;
- raw evidence payloads;
- RPC secrets or wallet material;
- caller-selected repository, ref, issue, or mailbox targets.

## Accepted Lite Isolation

The clean-v2 topology remains unchanged:

```text
/             current Tier 3 Deep Assurance operator
/execution/   accepted PreflightSim Lite tree
```

`apps/web/public/**` and `apps/api/src/index.mjs` remain byte-unchanged from accepted release `2df81aacb6f5747f06b49297e89e02c3f013d4ef`.

## Verification and Deployment

Source promotion to the Round 5 release branch does not deploy production. The merged source first runs `.github/workflows/tier3-release-verification-v1.yml`, which posts dependency-free and account-owner-authorized dependency/build receipts to issue #173.

Only after both exact merged-release receipts pass may the orchestrator create `.agent-control/v1/orchestrator/TIER3_PRODUCTION_DEPLOY_REQUEST_v4.json` as the next release commit.

Production workflow `.github/workflows/tier3-production-deploy-v4.yml` remains request-gated and preserves:

- explicit dependency-install authorization;
- Ethereum + Base only;
- no wallet signing;
- no public transaction broadcast;
- separate controller and execution GitHub credentials;
- exact v16.14 compatibility verification;
- live vlSDT Phase-0 fenced-state verification;
- Deep Assurance root plus accepted Lite `/execution/` verification.

A successful deployment is only the candidate for independent Stage 7 acceptance under #132.