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

The Cloudflare token must be scoped to the CurveYield account and zone with permission to manage Workers Scripts, Worker custom domains/routes, Pages, R2 buckets/configuration, and the DNS/custom-domain operations required by the deployment workflow.

## Tier 3 controller compatibility

The hosted controller adapter is fixed to:

```text
repository=CurveYield/audit-controller
ref=main
compatibilityCommit=d4851886ece3e8793dcc2a99f97f6d34da10e1cd
releaseIdentity=audit-controller@hosted-tier3-v1
processId=deep-assurance-v6
instructionReleaseIdentity=ai-auditor-deep-assurance-v6@16.13.0
controllerIntakeIssue=64
automationRelease=contract-automation@round5-tier3-v1
networkScope=ethereum,base
defaultChain=base
```

The adapter reads `.deep-assurance/active/<projectSlug>.json` from the fixed controller repository/ref. An active pointer must bind the compatible controller release, skill release, exact campaign branch, workspace, mailbox issue, and hosted projection path. A `NO_ACTIVE_CAMPAIGN` pointer may route only `campaign.create` to controller intake issue 64. All other hosted commands require an active pointer and route only to that pointer's campaign mailbox.

A queued GitHub comment is only a request. The hosted browser must reload authoritative controller state before showing a transition as accepted.

## Browser topology

Round 5 Tier 3 clean v2 intentionally keeps the accepted Lite source unchanged:

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

## Tier 3 production deployment v3

The current Tier 3 production workflow is `.github/workflows/tier3-production-deploy-v3.yml`. It supersedes the untriggered v2 deployment workflow and fixes the accepted-release verification checkout by using full Git history. It does not support an ordinary manual production deployment. It runs only when the accepted Round 5 release branch receives the one-shot request file:

```text
.agent-control/v1/orchestrator/TIER3_PRODUCTION_DEPLOY_REQUEST_v3.json
```

The request schema is `round5-tier3-production-deploy-request-v3`. The request must bind the exact pre-request release SHA and explicitly authorize both deployment and dependency installation while preserving `walletSigningAllowed=false`, `publicTransactionBroadcastAllowed=false`, and `activeNetworks=["ethereum","base"]`.

The account owner explicitly authorized the pinned dependency-install/deployment path for this Tier 3 release. The workflow therefore runs:

```text
npm install --ignore-scripts --no-audit --no-fund
npm test
npm run lint
npm run build
```

and then uses `npx --no-install wrangler` for R2, Worker, and Pages operations. There is no explicit Foundry, Hardhat, Forge, or `solc` compilation command in the Tier 3 production workflow. The install occurs only inside the trusted GitHub Actions deployment run after exact-source/request validation.

Before deployment the workflow checks out full history, verifies the accepted Lite source boundary against `2df81aacb6f5747f06b49297e89e02c3f013d4ef`, verifies required production configuration names, intake issue 64, and Ethereum/Base-only scope. After deployment it verifies Worker health, Tier 3 readiness, exact controller compatibility, exact `/api/v1/chains`, the root Deep Assurance marker, the `/execution/` PreflightSim Lite marker, and production controller-route CORS.

A sanitized deployment receipt is posted to issue #170. A successful deployment creates the exact candidate for independent Worker 4 Stage 7 acceptance under issue #132; it is not final Round 5 sign-off by itself.

## Private Custom GPT

Import `integrations/custom-gpt/action-schema.json` into a private Custom GPT. Configure API-key authentication with `PREFLIGHTSIM_GPT_API_KEY` as the Bearer credential.

## Ordinary ChatGPT GitHub bridge

Create an issue from `.github/ISSUE_TEMPLATE/preflightsim-job.md` and apply the `preflightsim-job` label. The bridge validates the author, submits the job, polls the API, posts the result in issue comments, and closes the issue.
