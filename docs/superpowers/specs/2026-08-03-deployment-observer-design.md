# Deployment Observer Design

## Goal

Observe the push-triggered `Test and Deploy CurveYield Preflight` run for deployment commit `81b7d3b2f4cf4636f204ae778617103804c30012` despite the connected GitHub interface filtering workflow-run reads to pull-request events.

## Approach

Add a one-time, secretless GitHub Actions observer triggered only when `.agent-control/v1/orchestrator/DEPLOY_OBSERVE_REQUEST_v1.json` is merged into `orchestrator/round4-ci-base-v1` directly after deployment commit `81b7d3b2f4cf4636f204ae778617103804c30012`.

The observer uses the job's read-only Actions permission to query GitHub's own workflow-runs API for `deploy.yml`, filters by the exact deployment commit SHA and push event, waits within a bounded window for completion, and posts only run/job/step status metadata to issue #125. It does not read job logs, repository secrets, environment secrets, artifacts, or Cloudflare credentials. It cannot start, rerun, approve, or modify the deployment.

## Safety

- exact release branch and one-time expected-parent guard;
- exact observer request path and request ID;
- `contents: read`, `actions: read`, `issues: write` only;
- no production environment and no secrets;
- no workflow rerun or dispatch endpoint;
- bounded polling and fail-closed result;
- status metadata only, with no log bodies.
