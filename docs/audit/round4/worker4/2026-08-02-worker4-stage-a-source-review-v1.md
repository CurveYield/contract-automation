# Worker 4 Round 4 Stage A Source Review v1

## Assignment identity

- Worker: `worker-4-round4-web-direct-e2e-review-v1`
- Mailbox sequence: `3`
- Issue: `#124`
- Branch: `audit-round4/review-web-direct-e2e-v1`
- Starting SHA: `fdc55d684be2cd5053c1e617aa09399fdfcf60c2`
- Assignment blob SHA: `496f26cdcd61bb6fae9e577133bc1e903c7627a0`

## Exact authoritative inputs

| Input | Exact identity | Result |
|---|---|---|
| Worker 4 Round 3 web documentation head | `fdc55d684be2cd5053c1e617aa09399fdfcf60c2` | branch starts exactly here |
| Worker 3 Round 3 documentation head | `1672b31a71674dd78eddc3bf5fc2fbe39d4ae07d` | verified |
| Worker 3 code/workflow candidate | `46873f805199e2212af3902c8525c0f3e4501721` | verified |
| Worker 3 final report | issue `#115`, comment `5156758072` | verified |
| Worker 3 compatibility manifest | `direct-compatibility-2a7b937fd31fac897e936414` | verified |
| Worker 3 release manifest | `direct-round3-release-418edd6cf9b65dbd77032a08` | verified |
| Worker 3 command schema | `github-direct-service-command-v1` | verified |
| Worker 3 result schema | `github-direct-service-result-v2` | verified |
| Worker 3 error schema | `github-direct-service-error-v1` | verified |
| Worker 0 Phase 7–8 head | `4d7513b7eabd2e2217b1e3fed43d999df828a93f` | verified from mailbox history |
| Worker 1 API/GPT/auth head | `6d877e2d87f1a91380a6c5d1efc47550527d8729` | verified from mailbox history |

## Public compatibility boundary

The allowed dependency direction is:

`Worker 3 service public index + Worker 0/1 transport-neutral fixtures -> Worker 4 version-locked adapters -> strict UI contracts -> defensive view models -> route renderers -> injected read-only client`

Forbidden dependency directions:

- UI to GitHub Direct ledger, auth, adapter, runner or workflow internals;
- UI to Worker 0 storage/service internals;
- UI to Worker 1 route/auth implementation internals;
- UI to credentials, signing, workflow mutation or submitted execution;
- any import from the frozen GitHub-native simulation addon.

Worker 3’s handoff explicitly permits only `packages/audit-github-direct-service/src/index.mjs` and the public command/result/error contracts. The existing Worker 4 compatibility package does not yet name or validate those versions.

## GitHub Direct source state model

Worker 3 `DIRECT_STATES`:

1. `requested`
2. `validating`
3. `admitted`
4. `awaiting_executor`
5. `fixture_running`
6. `publishing`
7. `completed`
8. `failed`
9. `cancelled`
10. `policy_rejected`
11. `execution_plane_unavailable`

Worker 3 public service result states:

- `accepted`
- `completed`
- `cancelled`
- `execution_plane_unavailable`
- `failed`

The accepted service state is a transport result whose nested current state is `awaiting_executor`; it must never be rendered as execution progress.

## Complete Stage A state-to-view truth matrix

| Canonical external state | UI label | Terminal | Execution implication | Required view behavior |
|---|---|---:|---|---|
| `requested` | Requested | no | none | immutable request received only |
| `validating` | Validating | no | none | policy/schema validation only |
| `admitted` | Admitted | no | none | admitted, not executing |
| `accepted` | Accepted — awaiting executor | no | none | service accepted; derive nested truth |
| `awaiting_executor` | Awaiting executor | no | unavailable | explicitly state no executor is running |
| `fixture_running` | Trusted fixture running | no | repository-owned inert fixture only | never imply submitted-project execution |
| `provisioning` | Provisioning | no | not yet running | Phase 7 service operation only |
| `running` | In progress | no | subsystem-specific | no percentage or ETA invention |
| `collecting_evidence` | Collecting evidence | no | evidence collection only | no completion implication |
| `publishing` | Publishing | no | publication only | no execution implication |
| `checkpointing` | Checkpoint pending | no | persistent-fork operation | read-only status |
| `exporting` | Export pending | no | persistent-fork operation | read-only status |
| `restoring` | Restore pending | no | persistent-fork operation | read-only status |
| `deleting` | Deletion pending | no | persistent-fork operation | read-only status |
| `completed` | Completed | yes | completed per public record | show immutable report/result references only |
| `failed` | Failed | yes | no progress | stable redacted error only |
| `cancelled` | Cancelled | yes | not executed or stopped | no retry/mutation control |
| `timed_out` | Timed out | yes | no progress | stable bounded diagnostic |
| `policy_rejected` | Policy rejected | yes | never admitted | no hidden policy detail leakage |
| `resource_limit` | Resource limit reached | yes | stopped | bounded resource fact only |
| `execution_plane_unavailable` | Execution plane unavailable | yes for current operation | execution absent | explicitly state no execution occurred |
| `tombstoned` | Tombstoned | yes | unavailable | no prior-resource count leakage |
| `offline_stale` | Offline — cached data | no | unknown/currently unreachable | announce stale cache and scope |
| `unavailable` | Unavailable | yes for view | absent capability | no action control |
| `not_found` / hidden | Not found | yes for view | none | observationally identical response/view |

## Entity compatibility registry

Worker 4’s Round 3 registry contains 22 versioned entity kinds:

- capability
- catalog tool
- workspace
- campaign
- job
- evidence
- report
- persistent fork
- checkpoint
- export
- clean-room campaign
- merge
- provenance
- quota
- retention
- operation budget
- profile
- parser
- result
- GitHub Direct status
- release provenance
- diagnostic

Required Round 4 compatibility additions are not new transport authority. They are strict projections for:

- `github-direct-service-result-v2`;
- `github-direct-service-error-v1`;
- command kind and nested current-state truth;
- immutable result/report identifiers and digests;
- execution-performed false/unavailable truth;
- retryability and stable error code;
- hidden/not-found non-interference.

## Independent findings

### F-01 — missing GitHub Direct v2 compatibility adapter

`packages/audit-web-compat/src/index-v1.mjs` locks only API, Phase 7–8 service and output fixture versions. It accepts a generic `githubDirect` object and passes it straight to the status view model. It does not verify `github-direct-service-result-v2` or `github-direct-service-error-v1`.

Impact: unsupported or contradictory GitHub Direct records can bypass the public schema/version boundary before rendering.

### F-02 — incomplete external lifecycle labels

The lifecycle map does not explicitly label multiple Worker 3, Phase 7–8 and assembled states, including `requested`, `validating`, `fixture_running`, `publishing`, `policy_rejected`, `execution_plane_unavailable`, `provisioning`, `collecting_evidence`, `timed_out`, `offline_stale`, `unavailable` and `not_found`.

Impact: valid public states render as `Unknown`, weakening operator truth and accessibility announcements.

### F-03 — duplicate and conflicting report references

Report references are sorted but not grouped by identifier. Identical duplicates remain duplicated; conflicting same-ID references remain simultaneously visible.

Impact: one immutable identifier can appear to point to contradictory labels or destinations.

### F-04 — hidden report count and content drift

The report contract/view-model path ignores an explicit `visible:false` marker rather than failing closed or filtering it. A hidden record therefore changes list total, pagination and rendered content compared with the absent case.

Impact: hidden-resource non-interference is not proven at the UI boundary.

### F-05 — diagnostic token-prefix leakage

Diagnostic redaction removes labeled bearer/basic values and common key assignments, but raw GitHub credential token formats such as `ghp_...` and `github_pat_...` remain visible.

Impact: attacker/provider error text could expose credential-shaped values in operator diagnostics.

### F-06 — generic GitHub Direct projection loses public result identity

The current GitHub Direct status view has no fields for command kind, service result ID/digest, nested current state, execution state or retryable error truth.

Impact: the UI cannot prove that a visible status corresponds to one immutable public service result, and can collapse service state with lifecycle state.

## Observed RED evidence

Command executed against an exact local mirror of the relevant starting modules:

```text
node --test test/audit-round4-worker4-source-review-v1.test.mjs
```

Result:

```text
6 tests
0 passed
6 failed
0 cancelled
0 skipped
```

Observed failures:

1. required lifecycle labels are absent;
2. duplicate references are not deduplicated and conflicts do not fail closed;
3. hidden report records change totals/content;
4. GitHub Direct public result/error versions and adapters are absent;
5. generic API fixture projection bypasses GitHub Direct version validation;
6. GitHub token-prefix diagnostic values remain visible.

## Protected simulation/RPC blobs

All are re-fetched from the Round 4 starting branch and match the prior accepted Worker 4 package:

| Path | Blob SHA |
|---|---|
| `.github/workflows/github-native-simulate.yml` | `54e446d4a715ca9678ed4d7434f7ba90b2c67c96` |
| `packages/github-native-sim/src/cli.mjs` | `17d3a5597bbd83ed155ef115efa2fd2528d2ff0b` |
| `packages/github-native-sim/src/select-job.mjs` | `c0cc36e865d7cfd78464ce3e1ef9012f7194f173` |
| `packages/github-native-sim/src/run-job-file.mjs` | `8c4c82d76e249b74efc630c8cbf0d7707d25b5f2` |
| `packages/github-native-sim/src/fork-rpc-proxy.mjs` | `4d7e2bd1114f5a37914b26447c9c79a1e40a58e6` |
| `packages/github-native-sim/src/chain-fixtures.mjs` | `6a7c9b0e7300765fe9f8485eed4cbdc0fe9ec9db` |
| `packages/github-native-sim/src/ganache-accounts.mjs` | `f1018079c3f552dfb2c6719698296a831efdcd2b` |
| `packages/github-native-sim/src/project.mjs` | `d1529658c7f6dda3ef2f41b255fe99aa66de4a9d` |
| `packages/github-native-sim/src/schema.mjs` | `4efcbf5b8b95a68f8e4d476f299f4f93e951dfd7` |
| `packages/runner/src/rpc-method-policy.mjs` | `59dfa72f41a697d533720a4d8f939a81aeba6736` |
| `packages/runner/src/fork-rpc-guard.mjs` | `73690f16b506baa50ca471ce5b5566ccb601e765` |

## Planned minimal repair boundary

Only the following Worker 4-owned surfaces are currently justified for repair:

- versioned compatibility adapter;
- UI contract and GitHub Direct status projection;
- lifecycle labels;
- report reference canonicalization and hidden-record filtering;
- diagnostic redaction;
- focused fixtures/tests and Round 4 documentation.

No Worker 3 ledger/auth/workflow/internal repair is justified by the current findings.
