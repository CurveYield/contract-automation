# Round 5 Explicit Pages Production Deployment V6 Design

## Confirmed failure mechanism

Production-target deployment v5 run `30814064657` verified the Pages project production branch and successfully uploaded the accepted static assets, but Wrangler inferred the detached Git checkout as branch `HEAD`. The resulting deployment was attached to the `head` preview alias, while `preflight.curveyield.online` continued serving the older production deployment. The six bounded custom-domain checks therefore failed with `unexpected chain option scope`.

## Selected repair

Create a one-time exact-parent deployment from release SHA `669591985d27a7c9e7a3dee8be1ff1ab8821d2e2`. Query the Pages project and require its configured production branch to equal `orchestrator/round4-ci-base-v1`. Deploy the accepted static assets with both:

- `--branch="$RELEASE_BRANCH"`
- `--commit-hash="$APPLICATION_SOURCE_SHA"`

This prevents Wrangler from inferring detached `HEAD` and explicitly classifies the deployment against the configured production branch.

## Minimal operation

The workflow deploys only the static files under `apps/web/public`. It does not redeploy the API Worker, install or mutate secrets, modify R2, submit jobs/uploads, invoke RPC, sign, or broadcast. Existing source and repository verification evidence from PR #155 and run `30814064657` remains accepted and is not repeated as a prerequisite to upload.

Before deployment, the workflow performs only local file-presence and static-content assertions using shell and Python standard-library tools. After deployment it verifies:

1. the deployment command reports success;
2. the production custom domain serves exactly Ethereum then Base;
3. Base is the sole default;
4. deferred networks are absent from the selector;
5. the live client retains API-driven chain synchronization;
6. a guaranteed sanitized result is posted to issue #125.

## Historical evidence preservation

The workflow and request explicitly bind and forbid reruns of:

- deployment v4 run `30808377849`;
- smoke v2 run `30813209037`;
- deployment v5 run `30814064657`.

A successful v6 deployment enables, but does not replace, a separate read-only production acceptance v3.
