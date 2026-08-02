# Round 5 Activation Runbook v1

## Purpose

Convert the queued Round 5 templates into active worker assignments immediately after Round 4 closes, without overlapping current assignments or exposing production credentials.

## Hard prerequisites

Do not activate any Round 5 worker until all are true:

1. Round 4 master issue #119 records one exact assembled release-candidate SHA accepted by Workers 0, 1, 3, and 4.
2. Worker 2's Round 4 integration assignment is durably completed.
3. The orchestrator independently verifies the exact SHA, branch head, reports, manifests, combined gates, protected blobs, and merge to the approved release branch.
4. The production-test, rollback, observability, secret-name/binding, and resource manifests are committed and mutually consistent.
5. PR #126 or successor BlockPI/live-RPC work is declared complete by the account owner, independently reviewed, and reconciled into the accepted release SHA.
6. The account owner confirms required secret and variable names exist. Never read or record values.

## Activation compilation

For each worker:

1. Verify its current `STATUS_v1.json` has `state: completed`, `activeSequence: null`, exact final SHA, recommendation, final report reference, and matching branch head.
2. Read the queued template from `.agent-control/v1/rounds/round5/QUEUED_ASSIGNMENTS/`.
3. Replace the release placeholder with the exact accepted Round 4 release SHA and add:
   - approved release branch;
   - exact source/report/manifest references;
   - activation timestamp;
   - precise live-test authorization scope;
   - any account-owner manual prerequisites still pending.
4. Write the immutable compiled assignment to the worker's `ASSIGNMENTS/` directory at the queued sequence.
5. Fetch and pin the assignment blob SHA.
6. Create the planned worker branch from the exact accepted release SHA.
7. Update `NEXT_v1.json` from `queued` to `ready`, adding starting SHA, compiled assignment path/blob, and activation comment ID.
8. Update `CURRENT_v1.json` to the same sequence/path/blob only after the previous assignment is complete.
9. Post one activation comment on the worker issue and #125.
10. Require the worker to verify the pointer/blob and create one ACK before editing or performing live operations.

## Startup order

All five assignments may be activated after the hard prerequisites resolve, but live stages are checkpoint-gated:

1. **Worker 0** begins release/configuration/resource/rollback preflight.
2. **Worker 2** begins trusted workflow/deployment preflight and publishes the deployment checkpoint.
3. **Workers 1, 3, and 4** may begin static production-manifest review immediately, but must not issue live API/R2/GitHub/UI requests until Worker 2 publishes the exact deployment checkpoint and the orchestrator verifies it.
4. **Worker 0** performs final semantic acceptance only after Workers 1, 2, 3, and 4 publish final production reports bound to the same exact SHA/configuration digest.
5. **Worker 2** publishes the combined production acceptance record only after all specialist reports are durable and mutually consistent.

## Failure handling

- Any stale SHA, branch-head mismatch, manifest disagreement, missing worker completion, missing credential-name readiness, or unresolved PR #126 reconciliation keeps the queue inactive.
- Any critical identity, cross-tenant, credential, workflow-trust, RPC-policy, deployment-integrity, rollback, data-loss, or hidden-resource failure is `REJECT` and requires halt/rollback.
- Never silently waive a gate or activate a replacement assignment over an active sequence.

## Queued mapping

- Worker 0 sequence 7 → issue #128 → `audit-round5/production-recovery-acceptance-v1`
- Worker 1 sequence 6 → issue #129 → `audit-round5/live-api-auth-gpt-r2-v1`
- Worker 2 sequence 9 → issue #130 → `audit-round5/production-deployment-integration-v1`
- Worker 3 sequence 9 → issue #131 → `audit-round5/github-direct-actions-security-v1`
- Worker 4 sequence 4 → issue #132 → `audit-round5/web-operator-live-e2e-v1`
