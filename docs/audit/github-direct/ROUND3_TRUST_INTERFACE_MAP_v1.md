# GitHub Direct Audit Round 3 Trust and Interface Map v1

## Trust/data-flow diagram

```text
protected default-branch workflow source (github.workflow_sha)
        |
        v
trusted CLI host ---- opaque token provider ---- GitHub API transport
        |                                      |
        |                                      +-- exact repository/commit/ledger reads
        |                                      +-- immutable/CAS ledger writes
        |                                      +-- reconciled Check/status/comment writes
        |                                      +-- target-scoped artifact metadata only
        v
strict service command -> authorization capability -> adapter -> service state machine
        |                                                        |
        |                                                        +-- .audit-direct/v1 requests
        |                                                        +-- current pointer + jobs index CAS
        |                                                        +-- events/results/reports/manifests
        |                                                        +-- publication journal
        v
target commit SHA is identity/data only; submitted source is never imported or executed
```

## Public module interfaces

| Package | Public interfaces | Trust responsibility |
|---|---|---|
| protocol | request/state/event/capability/result/report builders and validators; canonical JSON/SHA; bounded scalar/object helpers | canonical identities, hostile-reflection safety, no credential fields |
| ledger | closed path parser/builders; immutable/CAS mutation plans; state/index transitions; partial-write recovery | server-owned namespaces, monotonic state, exact blob-fingerprint CAS, replay convergence |
| auth | `createInjectedAuthorizationBroker`, `AUTH_TRANSPORT_METHODS` | exact repository/install/SHA/capability attestation; opaque transport only |
| adapter | permission manifest, exact transport facade, publication plans/reconciliation, artifact metadata | capability checks and response identity validation before caller use |
| runner | fixture allowlist, admission, execution-disabled outcome, publication planning | no submitted execution; truthful fixture/unavailable outcomes |
| reporting | submission/terminal/cancellation bundles and artifact index | exact result/report/publication binding and metadata-only artifacts |
| service | six strict commands, service result/error contracts, orchestration | command-specific capabilities, state/replay/cancellation convergence, no fallback |
| CLI | bounded flag parser, stable JSON, stable exit codes | no arbitrary command/path/URL/runner/image input; response validation before output |
| workflow transport | trusted GitHub API host and ledger snapshot reader | token confinement, exact API URLs, publication side-effect reconciliation |
| workflow | dispatch and trusted runner source | server-owned scope, operation-specific permissions, target SHA as inert data |

## Command and capability inventory

| Command | Required capabilities | Expected result |
|---|---|---|
| submit | read source, write control ledger, publish Check/comment/status, read artifact metadata | non-fixture stops at `awaiting_executor`; allowlisted fixture may complete modeled publication |
| status | read source | validated current state only |
| cancel | read source, write control ledger, publish comment/status | immutable cancellation bundle and terminal `cancelled` state |
| report | read source, write control ledger, publish comment/status, read artifact metadata | truthful terminal/unavailable reporting |
| capabilities | read source | least-privilege permission manifest |
| verify-fixture | read source | pure exact-SHA fixture lookup; no execution |

## Permission inventory

| Capability | GitHub resource/access |
|---|---|
| read-source | contents: read |
| write-control-ledger | contents: write |
| publish-check | checks: write |
| publish-status | statuses: write |
| publish-comment | issues: write |
| read-artifact-metadata | actions: read |

Round 3 workflow jobs must request only the subset required by their fixed operation. No command receives administration, secrets, workflow, deployment, package, environment, or identity-provider permissions.

## Independent source-review findings at starting SHA

1. Mixed-case canonical GitHub repository names are rejected instead of normalized.
2. Request-publication and ledger-transition validators accept swapped, generically valid child operations without cross-record/path/content binding.
3. Publication journals use a path family outside the closed ledger parser.
4. Service result/error outputs lack strict public validators; result data is not a closed command/state schema.
5. Reporting and artifact-index validators do not fully validate nested identities, plans, publications, timestamps, or duplicate artifacts.
6. A publication side effect can succeed before its journal write; retry can duplicate the Check/status/comment.
7. Artifact metadata ingestion is repository-wide rather than exact-target/job scoped.
8. Workflow callers select installation and report-issue scope; all operations share broad write permissions and in-progress runs are cancelled.
9. Transport-neutral API/integration compatibility and deterministic Round 4 handoff manifests are absent.

## Observed RED

The committed Round 3 boundary gate was executed against an exact/source-equivalent starting-tree mirror without network or dependency installation:

```text
12 tests
0 passed
12 failed
```

All twelve failures correspond to the findings above. Production implementation begins only after this evidence point.
