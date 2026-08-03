# Round 5 Production Current-Source Smoke V2 Design

## Goal

Accept the currently deployed source `2c6e543dfcaa17ca975bbde3c15302269bbf8072` with a fresh exact-parent, read-only production smoke gate after PR #150 changed the operator UI.

## Why a new gate is required

Production smoke run `30807373463` succeeded for prior deployed source `fbe27b824da8084970915b31f2051679abe39cfc`. PR #150 then changed the deployed Pages application and redeployed source `2c6e543dfcaa17ca975bbde3c15302269bbf8072` through deployment v4 run `30808377849`, job `91668946456`. The earlier smoke remains valid historical evidence but cannot accept the changed UI source.

## Bounded checks

The live workflow will perform only:

- Pages GET availability;
- public API health and setup GETs;
- unauthenticated rejection GET;
- authenticated `/api/v1/chains` GET and CORS inspection;
- deployed HTML and `app.js` GETs to prove Ethereum/Base-only selector scope, Base default, API synchronization, and deferred-network exclusion;
- `eth_chainId` and `eth_blockNumber` on Ethereum and Base RPCs.

It will not submit API jobs or uploads, invoke wallet/signing methods, execute contract workflows, deploy resources, mutate R2, or broadcast transactions.

## Trust binding

- release branch: `orchestrator/round4-ci-base-v1`
- exact expected parent and deployed source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- production deployment run: `30808377849`
- production deployment job: `91668946456`
- trigger: one new request path only
- environment: `production`
- failed/historical workflow reruns: forbidden

## Test-first sequence

1. Add the focused requirement test only and capture natural RED CI.
2. Add the immutable request and trusted push workflow.
3. Capture fresh exact-head GREEN CI.
4. Inspect exact diff, reviews, threads, and mergeability.
5. Merge only the verified head.
6. Inspect the live acceptance job and every step.
7. Record sanitized evidence to issue #125 and the control plane.
