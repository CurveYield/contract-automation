# Agent-Native Production Deployment Trigger Design

## Goal

Allow the connected orchestrator to start the already-authorized Round 5 production deployment without requiring the account owner to click GitHub's **Run workflow** button.

## Constraints

- Deployment executes only from `orchestrator/round4-ci-base-v1`.
- The GitHub `production` environment remains mandatory.
- Only Ethereum and Base are active; Arbitrum, Fraxtal, Katana, Optimism, and Polygon remain deferred and blocked.
- Secret values are never read, recorded, or committed.
- No wallet signing or public transaction broadcasting is introduced.
- Historical or failed workflow runs are not rerun.
- The existing manual `workflow_dispatch` path remains available as a fallback.

## Selected Approach

Add a narrowly scoped `push` trigger to `.github/workflows/deploy.yml`:

- branch: `orchestrator/round4-ci-base-v1`
- path: `.agent-control/v1/orchestrator/DEPLOY_REQUEST_v1.json`

The workflow validates that the request file contains the exact one-time request ID `round5-production-deploy-20260803T0904Z-v1`, the trusted repository and release branch, account-owner deployment/live-test authorization, Ethereum/Base as the only active networks, the five deferred networks, and no secret values.

A pull request adds both the workflow trigger and the attested request file. Merging that PR into the trusted release branch creates the push event that starts deployment naturally. Ordinary commits cannot start deployment because the path filter is restricted to the request file. Reusing or changing the request requires a reviewed workflow/request update with a new request ID.

## Error Handling

The job fails closed before dependency installation or Cloudflare mutation when:

- the event is neither an approved push nor manual dispatch;
- the branch is not the trusted release branch;
- the request file is absent or malformed on a push event;
- the request ID, authorization, network scope, or safety fields differ from the approved values;
- any required repository secret/variable name is absent.

## Verification

A focused test first fails against the current manual-only workflow. The implementation is accepted only after natural pull-request CI confirms:

- the exact push branch/path trigger;
- the one-time request-file validation step;
- the production environment remains mandatory;
- `workflow_dispatch` remains supported;
- Ethereum/Base-only scope and deferred-network blocking;
- no secret values in the request file.

After merge, the resulting push-triggered deployment run is inspected directly. No rerun is permitted if it fails; failures are diagnosed and corrected through a new reviewed commit.
