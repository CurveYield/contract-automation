# PreflightSim Lite deployment setup

## Production endpoints

- Pages UI: `https://preflight.curveyield.online`
- Browser-agent UI: `https://preflight.curveyield.online/agent/`
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

Use independent long random values for the four Preflight API keys. `PREFLIGHTSIM_GITHUB_TOKEN` must be restricted to `CurveYield/contract-automation` and permit Actions workflow dispatch. The RPC values are read-only fork sources; never store wallet keys or seed phrases.

The Cloudflare token must be scoped to the CurveYield account and zone with permission to manage Workers Scripts, Worker custom domains/routes, Pages, R2 buckets/configuration, and the DNS/custom-domain operations required by the deployment workflow.

## Optional repository variables

```text
PREFLIGHTSIM_API_URL=https://api.preflight.curveyield.online
PAGES_PROJECT_NAME=curveyield-preflight
PREFLIGHTSIM_ALLOWED_GITHUB_USERS=James-Nexus
```

The workflows already use these values as defaults.

## Automated provisioning

Run the `Test and Deploy CurveYield Preflight` workflow manually after all required secrets are present. It will:

1. Run the unit/security test suite and JavaScript syntax checks.
2. Build the static Pages application.
3. Create the `curveyield-preflight` R2 bucket when missing.
4. Apply browser-upload CORS for `https://preflight.curveyield.online` and 30-day retention.
5. Deploy the API Worker to `api.preflight.curveyield.online`.
6. Upload the Worker authentication and R2 signing secrets.
7. Create and deploy the `curveyield-preflight` Pages project.
8. Attach `preflight.curveyield.online` to Pages.
9. Create the `preflightsim-job` GitHub issue label.

Cloudflare custom-domain certificates can remain pending briefly after a successful deployment.

## Private Custom GPT

Import `integrations/custom-gpt/action-schema.json` into a private Custom GPT. Configure API-key authentication with `PREFLIGHTSIM_GPT_API_KEY` as the Bearer credential.

## Ordinary ChatGPT GitHub bridge

Create an issue from `.github/ISSUE_TEMPLATE/preflightsim-job.md` and apply the `preflightsim-job` label. The bridge validates the author, submits the job, polls the API, posts the result in issue comments, and closes the issue.
