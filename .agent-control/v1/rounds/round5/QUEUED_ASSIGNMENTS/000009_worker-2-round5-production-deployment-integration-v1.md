# Queued Assignment Template — Worker 2 Round 5

## Template state

`QUEUED / INACTIVE / NOT CONSUMABLE`

Do not acknowledge or execute this template. It becomes an assignment only after the orchestrator resolves every activation placeholder, writes an immutable copy into Worker 2's `ASSIGNMENTS/` directory, updates `CURRENT_v1.json`, and posts the activation comment on issue #130.

## Identity

- Worker: `worker-2`
- Planned sequence: `9`
- Master issue: `#125`
- Worker issue: `#130`
- Planned branch: `audit-round5/production-deployment-integration-v1`
- Starting SHA: `<ROUND4_ACCEPTED_SHA_RESOLVE_AT_ACTIVATION>`

## Preconditions

- Current Round 4 assignment is durably completed and Worker 2 status has no active sequence.
- Issue #119 records one exact release SHA accepted by Workers 0, 1, 3, and 4 and independently verified by the orchestrator.
- Approved release branch, production-test, rollback, observability, protected-blob, and secret-name/binding manifests are complete.
- PR #126 or successor BlockPI/live-RPC work is declared complete by the account owner, independently reviewed, and reconciled into the accepted release SHA.
- Required secret/variable names are confirmed by the account owner; values are never read or printed.

## Objective

Lead trusted production deployment, seven-network read-only RPC verification, and immutable integration of all production acceptance evidence.

## Required work

1. Verify compiled assignment blob, exact accepted SHA, trusted workflow SHA, and issue #130 activation.
2. Verify action pins, permissions, environment protection, concurrency, inputs, rollback target, and artifact naming.
3. Run only the explicitly approved deployment/test workflow from accepted source.
4. Record sanitized run/job/step/deployment/artifact/resource identifiers and configuration digests.
5. Verify Worker, Pages, R2, bindings, domains, TLS, CORS, lifecycle, and expected GitHub resources.
6. For Ethereum, Base, Katana, Fraxtal, Arbitrum, Polygon, and Optimism, run one bounded inert read/fork fixture and verify chain ID, pinned block, allowed methods, fail-closed rejection, retries, quotas, and provider limitations.
7. Prove no signing, wallet key, transaction broadcast, `eth_sendRawTransaction`, or write-capable RPC path.
8. Integrate Worker 0/1/3/4 reports into one immutable production acceptance record; reject stale or mismatched evidence.
9. Publish combined recommendation, rollback state, exact production SHA/configuration digest, final SHA, and final report reference.

## Prohibitions

- No secret values, raw RPC URLs, tokens, signed URLs, wallet keys, signing, transactions, or broadcasts.
- No branch-supplied deployment authority, mutable action refs, or unapproved workflow execution.
- No waiver of critical specialist failures.

## Completion gate

Worker-owned status must be `completed`, `activeSequence: null`, and bind an exact final SHA, recommendation, final report ID/URL, complete changed-path/blob manifest, workflow/deployment provenance, seven-network RPC matrix, rollback target, specialist report index, and exact production configuration digest.
