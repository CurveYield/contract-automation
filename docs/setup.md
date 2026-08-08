# CurveYield Deep Assurance Console deployment setup

## Production endpoints

- Pages UI: `https://preflight.curveyield.online`
- Browser-agent UI: `https://preflight.curveyield.online/agent/`
- Worker API: `https://api.preflight.curveyield.online/api/v1/`

The production browser combines the Tier 3 Deep Assurance operator surface with Preflight compile/simulation as a trusted execution subsystem. `CurveYield/audit-controller` remains the authoritative campaign ledger.

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

`PREFLIGHTSIM_GITHUB_TOKEN` is the contract-automation execution token. Restrict it to `CurveYield/contract-automation` and to the permissions required for trusted workflow dispatch.

`PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN` is a separate Tier 3 controller token. Restrict it to `CurveYield/audit-controller` only. The hosted v1 adapter requires repository contents **read** permission to read authoritative active pointers and `HOSTED-OPERATOR-STATE-v1.json`, plus repository issues **write** permission to post one canonical `CURVEYIELD_AUDIT_COMMAND_V1` comment to either the fixed pre-campaign intake mailbox or the active pointer-bound campaign mailbox. It must not grant Actions, administration, secrets, deployments, or unrelated repository access. The value is uploaded to the Worker as `AUDIT_CONTROLLER_GITHUB_TOKEN` and must never be logged, returned to the browser, copied into an issue, or stored in browser state.

The RPC values are read-only fork sources; never store wallet keys or seed phrases. The active production browser/RPC scope is exactly Ethereum and Base, with Base as the browser default. Deferred-network secret names do not reactivate Katana, Fraxtal, Arbitrum, Polygon, or Optimism.

The Cloudflare token must be scoped to the CurveYield account and zone with permission to manage Workers Scripts, Worker custom domains/routes, Pages, R2 buckets/configuration, and the DNS/custom-domain operations required by the deployment workflow.

## Tier 3 controller binding

The Worker has one non-secret, release-controlled intake binding:

```text
AUDIT_CONTROLLER_INTAKE_ISSUE=64
```

Issue 64 in `CurveYield/audit-controller` is the only pre-campaign `campaign.create` intake mailbox for this hosted release. The browser cannot supply or override an issue number, repository, branch, or GitHub URL.

For an active campaign, the Worker first reads `.deep-assurance/active/<projectSlug>.json` from `audit-controller` `main`, validates the exact hosted pointer release, then reads the pointer-bound `HOSTED-OPERATOR-STATE-v1.json` from the exact campaign branch. Active mutation requests are posted only to the mailbox issue number bound by that validated pointer.

A successful HTTP `202` from the hosted command route means only that the canonical request was **queued** to the controller mailbox. It does not mean the controller accepted or executed the state transition. Authoritative acceptance is observable only after the controller/orchestrator processes the request and regenerates the canonical hosted projection.

## Fork RPC method policy

The Cloudflare-backed runner sends external fork traffic through a local fail-closed guard. Only methods listed in [`rpc-method-policy-v2.md`](rpc-method-policy-v2.md) may reach an `RPC_*` secret.

An unsupported method receives JSON-RPC code `-32601` with application code `CALL_NOT_SUPPORTED`, after which the complete simulation attempt terminates. Mixed batches are rejected before any batch entry is forwarded. Local Ganache control methods remain local and are not restricted by the external-RPC allowlist.

Repository RPC providers must support the subset of allowed methods actually requested by Ganache and the job. A provider-tier failure for an allowed method is reported as an upstream RPC failure rather than a policy violation.

## Optional repository variables

```text
PREFLIGHTSIM_API_URL=https://api.preflight.curveyield.online
PAGES_PROJECT_NAME=curveyield-preflight
PREFLIGHTSIM_ALLOWED_GITHUB_USERS=James-Nexus
```

The workflows already use these values as defaults.

## Automated provisioning

Run the `Test and Deploy CurveYield Preflight` workflow manually only after all required secrets are present and the exact release candidate has passed its required acceptance gates. It will:

1. Run the unit/security test suite and JavaScript syntax checks.
2. Build the static Pages application.
3. Create the `curveyield-preflight` R2 bucket when missing.
4. Apply browser-upload CORS for `https://preflight.curveyield.online` and 30-day retention.
5. Deploy the API Worker to `api.preflight.curveyield.online`.
6. Upload the Worker authentication, dedicated audit-controller, and R2 signing secrets.
7. Create and deploy the `curveyield-preflight` Pages project.
8. Attach `preflight.curveyield.online` to Pages.
9. Create the required Preflight GitHub issue labels.

Cloudflare custom-domain certificates can remain pending briefly after a successful deployment.

## Private Custom GPT

Import `integrations/custom-gpt/action-schema.json` into a private Custom GPT. Configure API-key authentication with `PREFLIGHTSIM_GPT_API_KEY` as the Bearer credential. The Custom GPT API identity is not authorized for hosted controller routes.

## Ordinary ChatGPT GitHub bridge

Create an issue from `.github/ISSUE_TEMPLATE/preflightsim-job.md` and apply the `preflightsim-job` label. The bridge validates the author, submits the job, polls the API, posts the result in issue comments, and closes the issue. The GitHub bridge API identity is not authorized for hosted controller routes.
