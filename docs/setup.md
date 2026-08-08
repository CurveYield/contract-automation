# PreflightSim Lite deployment setup

## Production endpoints

- Pages UI: `https://preflight.curveyield.online`
- Browser-agent UI: `https://preflight.curveyield.online/agent/`
- Tier 3 audit operator: `https://preflight.curveyield.online/audit-v1.html`
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
AUDIT_CONTROLLER_GITHUB_TOKEN
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

`PREFLIGHTSIM_GITHUB_TOKEN` must remain restricted to `CurveYield/contract-automation` and permit only the repository operations needed by trusted compile/simulation dispatch and the existing contract-automation GitHub bridge.

`AUDIT_CONTROLLER_GITHUB_TOKEN` is a separate least-privilege credential restricted to `CurveYield/audit-controller`. The hosted Tier 3 adapter requires repository metadata read, Contents read, and Issues read/write so it can read the authoritative active pointer/projection and post canonical controller command envelopes. Do not broaden `PREFLIGHTSIM_GITHUB_TOKEN` to cover this repository and do not use `AUDIT_CONTROLLER_GITHUB_TOKEN` for technical execution dispatch.

The RPC values are read-only fork sources; never store wallet keys or seed phrases. The final Round 5 browser/RPC scope is exactly Ethereum and Base, with Base the browser default. Deferred-network secret names may remain configured for compatibility but do not reactivate Katana, Fraxtal, Arbitrum, Polygon, or Optimism.

The Cloudflare token must be scoped to the CurveYield account and zone with permission to manage Workers Scripts, Worker custom domains/routes, Pages, R2 buckets/configuration, and the DNS/custom-domain operations required by the deployment workflow.

## Tier 3 audit-controller production binding

The production Worker must bind the hosted adapter to one exact compatible controller release:

```text
AUDIT_CONTROLLER_OWNER=CurveYield
AUDIT_CONTROLLER_REPO=audit-controller
AUDIT_CONTROLLER_REF=main
AUDIT_CONTROLLER_COMMIT=<exact accepted 40-character audit-controller main commit>
AUDIT_CONTROLLER_SKILL_RELEASE=ai-auditor-deep-assurance-v6@16.13.0
AUTOMATION_RELEASE=contract-automation@round5-tier3-v1
AUDIT_CONTROLLER_INTAKE_ISSUE=64
```

`AUDIT_CONTROLLER_COMMIT` is not optional for the final production candidate. It is filled only after the hosted adapter/projection changes are accepted into `audit-controller` main. Do not use a moving branch-only identity as final Round 5 evidence.

The Worker compatibility route may expose the exact repository/ref/release identities and whether campaign-create intake is configured. It must never expose either GitHub token or the intake issue number.

The hosted adapter reads `.deep-assurance/active/<projectSlug>.json` from `audit-controller` main. Active pointers bind the exact campaign branch, projection path, mailbox issue, controller commit, and skill release. A project with `NO_ACTIVE_CAMPAIGN` may submit only `campaign.create` through repository intake issue #64; all active-campaign commands go to the pointer-bound campaign mailbox.

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

The historical `Test and Deploy CurveYield Preflight` workflow provisions the Lite application. It is not final Tier 3 Round 5 acceptance evidence.

The versioned Tier 3 deployment workflow must, before deployment:

1. verify all legacy production secret/variable names plus `AUDIT_CONTROLLER_GITHUB_TOKEN` by name only;
2. bind the exact accepted audit-controller main commit and skill release;
3. run the approved dependency/security checks from the trusted contract-automation source;
4. build the static Pages application;
5. create or validate the `curveyield-preflight` R2 bucket and lifecycle/CORS configuration;
6. deploy the API Worker to `api.preflight.curveyield.online`;
7. upload the normal Worker authentication/R2 secrets plus the two separate GitHub credentials into their separate Worker bindings;
8. deploy the Tier 3 Pages application to `curveyield-preflight` and preserve `preflight.curveyield.online`;
9. verify the active browser scope remains exactly Ethereum and Base, Base default; and
10. publish only sanitized release/compatibility receipts.

Cloudflare custom-domain certificates can remain pending briefly after a successful deployment.

## Private Custom GPT

Import `integrations/custom-gpt/action-schema.json` into a private Custom GPT. Configure API-key authentication with `PREFLIGHTSIM_GPT_API_KEY` as the Bearer credential.

## Ordinary ChatGPT GitHub bridge

Create an issue from `.github/ISSUE_TEMPLATE/preflightsim-job.md` and apply the `preflightsim-job` label. The bridge validates the author, submits the job, polls the API, posts the result in issue comments, and closes the issue.
