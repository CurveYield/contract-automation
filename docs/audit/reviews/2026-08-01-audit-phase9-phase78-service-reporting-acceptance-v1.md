# Phase 9 Phase 7–8 Service and Reporting Acceptance Review v1

## Recommendation

**ACCEPT**

The Phase 9 persistent-fork and clean-room service/reporting layer is implemented as transport-neutral, execution-disabled, deterministic JavaScript contracts and pure publication/reporting plans on top of the accepted Phase 7–8 candidate.

## Exact assignment and candidate pins

- Worker: `worker-0`
- Mailbox sequence: `4`
- Message ID: `worker-0-phase9-phase78-service-reporting-v1-000004`
- Assignment blob SHA: `e9744263a965226b6ff10a80771845a0c81e0131`
- Issue: `#101`
- Branch: `audit-phase9/phase78-service-reporting-v1`
- Starting SHA: `4c875bb9291d3e714af9cd0013ee5d460f576a2b`
- Accepted implementation candidate SHA: `6a81f4e8831d74b7a52130031d11f8465eab3441`

The final documentation commit containing this review is recorded in issue #101, the Worker 0 completion status, and the append-only completion event because a Git commit cannot self-embed its own SHA.

## Durable checkpoints

1. Checkpoint 1 — strict service contracts and authorization: issue #101 comment `5154059851`
2. Checkpoint 2 — orchestration, retry, and truthful reporting: issue #101 comment `5154065775`
3. Checkpoint 3 — publication CAS, recovery, quotas, and pagination: issue #101 comment `5154076541`
4. Checkpoint 4 is posted after this review is committed and the final documented head is reverified.

## Exact changed-path inventory before this review

The implementation candidate contains exactly **35** assigned files:

- production source modules: 22
- package manifests: 4
- focused test files: 7
- inert JSON fixtures: 2
- unowned changed files: 0

Packages:

- `packages/audit-phase78-service/**`
- `packages/audit-fork-reporting/**`
- `packages/audit-clean-room-reporting/**`
- `packages/audit-phase78-publication/**`

No API, web, GitHub Direct, workflow, runner/RPC, Phase 1–6, GitHub-native simulation, CurveYield Lite, deployment, or unrelated path changed.

## Test-first evidence

### Initial RED

Before implementation:

```text
4 package interface tests
0 passed
4 failed
```

The complete initial matrix failed across nine test files because all four assigned packages were absent.

### Boundary-repair RED

Before the final reporting hardening:

- unsafe checkpoint object keys returned an incidental `invalid_identifier` rather than a stable object-key error;
- revoked merge digest arrays escaped as a raw JavaScript `TypeError`.

Both cases were captured as failing tests before repair.

### Final GREEN

```text
node --test test/audit-phase9-phase78-*.test.mjs

40 tests
40 passed
0 failed
0 cancelled
0 skipped
```

Additional final checks:

- `node --check` for all 22 changed production `.mjs` modules and all seven focused test modules: pass;
- all four package manifests and both JSON fixtures parse: pass;
- trailing-whitespace scan: pass;
- static prohibited-capability scan: zero matches.

## Service request/response contract matrix

Fifteen operations have exact closed payload schemas:

1. `fork.create`
2. `fork.read`
3. `fork.action`
4. `fork.checkpoint`
5. `fork.export`
6. `fork.delete`
7. `campaign.create`
8. `campaign.read`
9. `share.create`
10. `share.revoke`
11. `merge.create`
12. `merge.read`
13. `provenance.read`
14. `report.read`
15. `report.publish`

Every request binds operation, tenant, workspace, optional campaign/fork/merge identity, requester, exact scopes, idempotency key, optional version/ETag pair, canonical timestamp, and an operation-specific payload. Request, response, and error envelopes are deterministic, recursively frozen, digest-bound, and strict-key validated.

Unknown fields, wildcard/mutable identities, contradictory CAS data, unsafe messages, and credential/RPC/process/container/wallet/transaction/deployment-shaped payload fields reject.

## Authorization composition

Fork operations require exact tenant/fork identity and accepted `audit:read` or `audit:submit` scope. Missing resources return `resource_hidden`; cross-tenant identities do not authorize.

Campaign/merge/share/report operations compose the accepted Phase 8 campaign access context:

- exact tenant/workspace/campaign/requester;
- required read/write/merge/share scope;
- closed owner/reviewer/operator/reader role matrix;
- active/terminal/archived lifecycle rules;
- mutating operations limited to authorized active owner/operator contexts.

No API or transport adapter is embedded in the contract.

## Orchestration, state, CAS, and retry

Orchestration outputs are pure plans. They never execute a project, call an RPC, access a network, sign, broadcast, deploy, or trigger a workflow.

Properties verified:

- real external fork creation reports `awaiting_executor`, never `ready`;
- plans are deterministic and operation-accounted;
- mutating plans advance monotonically by one version;
- exact current version and blob-SHA ETag are required when CAS is supplied;
- stale state rejects;
- deleted/failed/cancelled/completed/policy-rejected states are protected from mutation;
- retries bind immutable request digest and exact current identity;
- maximum retry attempts: four;
- missing immutable records are recovered before the mutable pointer;
- conflicting replay rejects.

## Fork reporting truth

Report schemas:

- `audit-phase9-fork-report-v1`
- `audit-phase9-fork-awaiting-executor-report-v1`
- `audit-phase9-checkpoint-report-v1`
- `audit-phase9-export-report-v1`
- `audit-phase9-fork-delete-report-v1`

Checkpoint reports pin tenant/fork/attempt/object/digest/bytes, remain opaque, and enforce a maximum one-day lifetime. Export reports pin the original object/digest, explicitly state that bytes are not copied, and enforce a maximum seven-day lifetime. Deletion reports require accepted `deleted` state plus tombstone truth.

Object keys reject traversal, absolute/backslash paths, duplicate separators, arbitrary URLs, and invalid characters.

## Clean-room reporting truth and non-interference

Report schemas:

- `audit-phase9-campaign-report-v1`
- `audit-phase9-merge-report-v1`
- `audit-phase9-provenance-report-v1`
- `audit-phase9-relation-summary-v1`
- `audit-phase9-hidden-report-v1`

Campaign reports preserve success, findings, partial, truncated, failed, cancelled, and policy-rejected semantics. Merge reports pin terminal-manifest, duplicate-map, conflict-map, provenance, policy, and operation-summary digests.

Absent and unauthorized resources produce byte-identical hidden envelopes across status, error, body, counts, facets, relation summaries, notifications, signed-resource plan, operation budget, cache tag, and timing class.

Relation summaries expose no hidden identity or hidden count. Provenance output includes only globally visible nodes and explicitly authorized campaign nodes. Hidden and absent target nodes are indistinguishable.

## Publication operation, quota, retention, and recovery matrix

Immutable publication of `N` records:

- Class A: `N`
- Class B: `N`
- Free: `0`
- one exact head precondition and one immutable `if-none-match:*` write per record

Mutable pointer publication:

- Class A: `1`
- Class B: `0`
- exact blob-SHA `if-match`
- next version equals current version plus one
- operation digest is distinct from content digest

Limits:

- records: 64
- retained bytes: 20,000,000
- retention: 90 days
- active checkpoints: 8
- exports: 8
- page size: 100
- checkpoint report lifetime: 86,400 seconds
- export report lifetime: 604,800 seconds

Recovery was tested after zero, one, two, and three completed immutable writes. Exact completed writes are skipped, remaining writes are deterministic, the pointer is retried last, identical replay converges, and an out-of-plan completed digest rejects.

No prefix listing is used.

## Pagination contract

Cursors bind tenant, workspace, resource kind, exact index digest, offset, page size, sort key, and cursor digest. Tampering, malformed values, and scope substitution reject. Page size is limited to 100. Input reversal produces identical pages, and final-page termination is deterministic.

## Multi-tenant and adversarial evidence

Scenarios include:

- two tenants with separate forks, checkpoints, exports, and reports;
- external fork truth preserved as `awaiting_executor`;
- campaign terminal report to merge report to immutable publication and CAS pointer;
- partial publication failure and deterministic recovery;
- same-name cross-tenant hidden campaign substitution;
- hidden versus absent byte equivalence;
- oversized 200,001-node provenance graph rejection before traversal;
- at least 16 one-field request-output mutations;
- 15 operation payload-expansion mutations;
- six independent quota overages;
- unsafe object-key, hostile-array, malformed-cursor, stale-CAS, terminal-state, request-digest, and recovery-conflict cases.

The explicit rejection/substitution corpus contains at least **59** assertions, excluding ordinary authorization-denial truth-table cases.

## Static capability proof

Production modules expose no:

- process, shell, child process, worker thread, filesystem enumeration, or submitted-code execution;
- network, HTTP, RPC, socket, WebSocket, arbitrary URL, or fetch capability;
- package-manager, installation, container, image, binary, or dynamic-code capability;
- wallet, private key, mnemonic, signer, calldata, transaction, broadcast, or deployment capability;
- workflow trigger or execution-enablement state.

Every `executionEnabled` report field is fixed to `false`.

## Blocked checks — no success claimed

- dependency installation or package-manager commands;
- compilation/build;
- production R2 binding integration;
- real executor/RPC/fork compute;
- submitted-project/tool execution;
- containers;
- API/web/GitHub Direct integration;
- deployment or workflow execution;
- full Round 1 combined branch integration;
- PR creation or merge to `main`.

## Residual risks

1. These packages produce service/report/publication contracts and plans; a future transport adapter must preserve every identity, scope, digest, version, ETag, non-interference, and operation-budget field.
2. Production R2 behavior is not claimed until an authorized binding adapter proves the planned preconditions and CAS operations against the accepted store contract.
3. Real fork execution remains outside this package and must continue to report `awaiting_executor` until a separately authorized hardened executor exists.
4. Full Phase 9 integration with other Round 1 worker candidates remains an orchestrator gate.

## Restrictions observed

No dependency was installed or downloaded. No package manager, compilation, build, submitted project/tool execution, process/container, network/RPC, wallet/key/signing, transaction/broadcast, deployment, workflow approval, production secret, PR, branch merge, or merge to `main` occurred.
