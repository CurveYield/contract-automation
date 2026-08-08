# PreflightSim deployment setup

## Production endpoints

- Tier 3 Deep Assurance UI: `https://preflight.curveyield.online/`
- Accepted PreflightSim Lite execution UI: `https://preflight.curveyield.online/execution/`
- Browser-agent UI: `https://preflight.curveyield.online/execution/agent/`
- Worker API: `https://api.preflight.curveyield.online/api/v1/`

## GitHub Actions secrets

Configure these repository secrets in `CurveYield/contract-automation`:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
PREFLIGHTSIM_CLIENT_API_KEY
PREFLIGHTSIM_GPT_API_KEY
PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY
PREFLIGHTSIM_RUNNER_API_KEY
PREFLIGHTSIM_GITHUB_TOKEN
PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN
PREFLIGHTSIM_R2_ACCESS_KEY_ID
PREFLIGHTSIM_R2_SECRET_ACCESS_KEY
RPC_ETHEREUM
RPC_BASE
RPC_KATANA
RPC_FRAXTAL
RPC_ARBITRUM
RPC_POLYGON
RPC_OPTIMISM
```

Use independent long random values for the four Preflight API keys.

`PREFLIGHTSIM_GITHUB_TOKEN` remains restricted to `CurveYield/contract-automation` and is used for trusted execution/bridge operations. `PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN` is a separate least-privilege credential restricted to `CurveYield/audit-controller`; the Worker receives it only as `AUDIT_CONTROLLER_GITHUB_TOKEN` for controller Contents reads and Issues mailbox reads/writes. Do not broaden or interchange the two GitHub credentials.

The RPC values are read-only fork sources; never store wallet keys or seed phrases. The active production execution scope is exactly Ethereum and Base. Deferred-network secret names may remain configured but do not activate Katana, Fraxtal, Arbitrum, Polygon, or Optimism.

## Tier 3 controller compatibility — current release

The current hosted controller adapter is `tier3-controller-adapter-v2` and is fixed to the live Deep Assurance 16.14 release tuple:

```text
repository=CurveYield/audit-controller
ref=main
compatibilityCommit=48b031f06c7d7ed3573b42e371e123299722b451
releaseIdentity=audit-controller@48b031f06c7d7ed3573b42e371e123299722b451
processId=deep-assurance-v6
instructionReleaseIdentity=ai-auditor-deep-assurance-v6@16.14.0
controllerIntakeIssue=64
automationCompatibilityCommit=ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8
automationReleaseIdentity=contract-automation@ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8
networkScope=ethereum,base
defaultChain=base
```

The adapter reads `.deep-assurance/active/<projectSlug>.json` from `audit-controller/main` and supports the current Phase-0 `deep-assurance-active-pointer-v2` shape. For an active campaign it derives the campaign workspace from `controllerCampaignCreateReceipt` and reads only the bounded control-plane records required for operator state:

```text
CONTROLLER_CAMPAIGN_CREATE_RECEIPT-v1.json
CONTROLLER_TOPOLOGY-v1.json
ASSIGNMENT_PLAN-v1.json
FAILOVER_STATE-v1.json
ORCHESTRATOR_LEASE-v1.json
```

The browser receives a bounded `controller-operator-state-v2` projection. It does not receive raw poll task IDs, controller tokens, raw lease material, raw evidence payloads, or arbitrary controller files.

### Phase-0 fencing semantics

A controller campaign can be `ACTIVE` while launch/substantive work is still fenced. The browser must display these conditions separately.

For the current vlSDT v20 Phase-0 state, the expected authoritative conditions are:

```text
campaign.status=ACTIVE
project.launchAuthorized=false
controlPlane.bootstrapStatus=BOOTSTRAP_FENCED
controlPlane.claimAuthorized=false
controlPlane.sourceAccessAuthorized=false
controlPlane.assignmentClaimsAuthorized=false
controlPlane.substantiveWorkAuthorized=false
controlPlane.failoverStatus=HEALTHY
controlPlane.authorityState=ACTIVE
project.commandRouting.available=false
project.commandRouting.reason=PHASE0_BOOTSTRAP_FENCED
```

While that fence is present, the hosted UI disables substantive controller commands. It does not infer authorization from `campaign.status=ACTIVE`.

If a future active pointer becomes launch-authorized but still does not publish an authoritative hosted campaign mailbox binding, hosted mutation still fails closed with `controller_mailbox_unpublished`. The browser must never guess an issue number or mailbox target.

A legacy `NO_ACTIVE_CAMPAIGN` tombstone may route only a valid controller `campaign.create` request to trusted intake issue 64. A queued GitHub comment is only a request; authoritative controller state must be reloaded before any transition is shown as accepted.

## Browser topology

Round 5 Tier 3 clean v2 keeps the accepted Lite source unchanged:

```text
/             Tier 3 Deep Assurance operator shell
/execution/   accepted PreflightSim Lite static tree
```

`apps/web/public/**` remains the accepted Lite source. `apps/web/tier3/**` is the separate controller-only root. `scripts/build.mjs` copies the Lite tree unchanged under `dist/web/execution/` and builds the Tier 3 root at `dist/web/`.

The Tier 3 browser contains no wallet connection, signing, public-transaction broadcast, direct GitHub access, caller-selected issue number, caller-selected branch, or caller-selected mailbox URL.

## Fork RPC method policy

The Cloudflare-backed runner sends external fork traffic through a local fail-closed guard. Only methods listed in [`rpc-method-policy-v2.md`](rpc-method-policy-v2.md) may reach an `RPC_*` secret.

An unsupported method receives JSON-RPC code `-32601` with application code `CALL_NOT_SUPPORTED`, after which the complete simulation attempt terminates. Mixed batches are rejected before any batch entry is forwarded. Local Ganache control methods remain local and are not restricted by the external-RPC allowlist.

Repository RPC providers must support the subset of allowed methods actually requested by Ganache and the job. A provider-tier failure for an allowed method is reported as an upstream RPC failure rather than a policy violation.

## Required repository variables

```text
PREFLIGHTSIM_API_URL=https://api.preflight.curveyield.online
PAGES_PROJECT_NAME=curveyield-preflight
PREFLIGHTSIM_ALLOWED_GITHUB_USERS=James-Nexus
```

## Tier 3 production deployment v4

The current production workflow is `.github/workflows/tier3-production-deploy-v4.yml`. It is inert during feature development and runs only when the accepted Round 5 release branch receives:

```text
.agent-control/v1/orchestrator/TIER3_PRODUCTION_DEPLOY_REQUEST_v4.json
```

The request schema is `round5-tier3-production-deploy-request-v4`. The request binds the exact pre-request release SHA and explicitly authorizes both deployment and dependency installation while preserving:

```text
activeNetworks=["ethereum","base"]
walletSigningAllowed=false
publicTransactionBroadcastAllowed=false
controllerRepository=CurveYield/audit-controller
controllerSecretName=PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN
```

The account owner explicitly authorized the pinned dependency-install/deployment path for this Tier 3 release. The workflow runs:

```text
npm install --ignore-scripts --no-audit --no-fund
npm test
npm run lint
npm run build
```

and then uses `npx --no-install wrangler` for R2, Worker, and Pages operations. There is no explicit Foundry, Hardhat, Forge, or `solc` compilation command in the Tier 3 production workflow.

Before deployment, v4 checks out full Git history, verifies the accepted Lite source boundary against `2df81aacb6f5747f06b49297e89e02c3f013d4ef`, verifies required production configuration names, intake issue 64, and Ethereum/Base-only scope. After Worker deployment it verifies:

- `/api/v1/health`;
- authenticated `/api/v1/setup` with `tier3Controller=true`;
- authenticated `/api/v1/chains` exactly Base + Ethereum;
- current v16.14 controller compatibility;
- authenticated `/api/v1/controller/projects/vlsdt` returns the live Phase-0 fenced state rather than rejecting it;
- hosted command routing remains unavailable for that fenced live campaign;
- Pages root contains the Deep Assurance shell;
- `/execution/` contains accepted PreflightSim Lite;
- controller CORS allows exactly the production Pages origin.

A sanitized deployment receipt is posted to issue #170. A successful deployment creates the exact candidate for independent Worker 4 Stage 7 acceptance under issue #132; it is not final Round 5 sign-off by itself.

## Private Custom GPT

Import `integrations/custom-gpt/action-schema.json` into a private Custom GPT. Configure API-key authentication with `PREFLIGHTSIM_GPT_API_KEY` as the Bearer credential.

## Ordinary ChatGPT GitHub bridge

Create an issue from `.github/ISSUE_TEMPLATE/preflightsim-job.md` and apply the `preflightsim-job` label. The bridge validates the author, submits the job, polls the API, posts the result in issue comments, and closes the issue.
