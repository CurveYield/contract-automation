# Round 5 Tier 3 Audit-Controller Web Integration v1 — Design

**Status:** Approved sequencing amendment  
**Date:** 2026-08-07  
**Parent:** Round 5 production acceptance issue #125

## 1. Purpose

Round 5 must not be considered complete while the production browser application exposes only PreflightSim Lite compilation and simulation. The final production application must expose the Deep Assurance / audit-controller Tier 3 operator workflow before Round 5 Stage 7 web/operator acceptance and Stage 8 recovery/rollback acceptance are treated as final.

The correct order is:

1. stabilize and accept the Round 5 backend/control-plane prerequisites covered by Stages 1–6;
2. integrate the complete Tier 3 audit-controller operator experience into the production browser application;
3. run Stage 7 against that complete application;
4. run Stage 8 recovery, redeploy, rollback, and incident-path validation against that same accepted application;
5. publish final Round 5 production sign-off only after those gates pass.

## 2. Historical Browser Acceptance Is Not Final Stage 7

The completed production browser acceptance v3 and its preceding Pages/DNS repair work prove routing, Pages ownership, browser asset delivery, CORS, API liveness, authentication boundaries, Ethereum/Base scope, and read-only RPC connectivity for the accepted Lite deployment.

Those checks remain valid evidence for the infrastructure they tested, but they are a deployment/routing prerequisite only. They do not satisfy final Round 5 Stage 7 because the current Lite application does not yet expose the full Tier 3 audit-controller workflow.

Historical versioned acceptance specifications and receipts remain immutable. This v1 sequencing design adds the next required gate rather than rewriting completed historical evidence.

## 3. Required Dependency Order

### Gate A — Stages 1–6 backend/control-plane stability

Before Tier 3 UI integration is accepted, the implementation must have stable interfaces for the production capabilities the UI consumes, including as applicable:

- Cloudflare Pages/Worker deployment and exact-origin CORS;
- authentication and identity separation;
- job, report, fork, evidence, capability, and diagnostic APIs;
- R2 artifact handling and isolation;
- GitHub Direct / bridge behavior;
- trusted exact-source compile and pinned-fork simulation;
- read-only Ethereum and Base RPC operation;
- controller release identity, schemas, command envelopes, evidence rules, and report semantics.

A backend capability may still receive implementation fixes during this gate, but Stage 7 must not begin against interfaces that are known to be unstable or intentionally incomplete.

### Gate B — Tier 3 browser integration

After Gate A is sufficiently stable, implement the complete audit-controller operator surface in the production browser application. PreflightSim compilation and simulation become a subsystem used by the audit workflow rather than the top-level product boundary.

### Gate C — Round 5 Stage 7 full web/operator acceptance

Stage 7 runs only after Gate B is deployed from an exact trusted source SHA. Worker 4 remains an independent acceptance role and must test the completed application rather than build it.

### Gate D — Round 5 Stage 8 recovery and rollback

Stage 8 runs against the same full application accepted by Stage 7. Redeployment, rollback, key rotation, partial-publication recovery, GitHub reconciliation, observability, and incident evidence must therefore exercise the Tier 3-capable release, not the earlier Lite-only release.

### Gate E — final Round 5 sign-off

Round 5 may close only after Gates A–D pass and one exact final production SHA/configuration record is published.

## 4. Architecture Boundary

The browser integration must not create a second audit-controller authority.

```text
Production browser UI (Cloudflare Pages)
        |
        +--> contract-automation production API
        |        compile / simulate / jobs / artifacts / reports / forks
        |
        +--> Tier 3 controller adapter
                 |
                 +--> audit-controller GitHub-native command/state protocol
                          authoritative campaign ledger, mailboxes,
                          event chain, assignments, findings, remediation,
                          evidence and finalization
```

Required invariants:

- `CurveYield/audit-controller` GitHub state remains authoritative for Deep Assurance campaign semantics.
- The hosted UI is a projection and command adapter, not an independent state machine.
- The audit-controller repository remains GitHub-native and does not gain a requirement for Cloudflare or GitHub Actions.
- GitHub-only browser-agent audits must remain functional if the hosted UI is unavailable.
- Compilation and simulation execute only through the trusted `contract-automation` execution boundary.
- Any hosted controller mutation must map to the controller's validated structured command/envelope rules; the UI must not bypass instruction proofs, leases, gates, evidence checks, remediation rules, or finalization rules.
- Release identity and exact-source bindings must be visible and preserved across browser, API, GitHub controller state, execution requests, artifacts, and final reports.

## 5. Required Tier 3 Browser Surfaces

The final Stage 7 application must expose, at minimum, production-capable views and actions for:

1. campaign creation, admission state, lifecycle, and terminal status;
2. capability/readiness preflight and blocker visibility;
3. phase, gate, review-lane, and completion progress;
4. worker registration, capability state, sessions, and role/phase authorization;
5. Deep Assurance instruction-read proof status, exact pinned skill release, and proof failures;
6. assignment creation, leases, claims, submissions, review state, expiry, and conflicts;
7. event-sourced campaign history and provenance sufficient for operator diagnosis without exposing sensitive data;
8. findings, severity, validation, deduplication, residual risk, and unresolved blocker state;
9. remediation requests, remediation evidence, regression/re-review status, and acceptance/rejection;
10. exact-source compile/simulation request state and bound evidence/artifact validation;
11. report completeness validation, evidence index, exact release manifest, and completion status;
12. final `PASS` / `NO_GO` security verdict distinct from process completion;
13. explicit blocking of incomplete/invalid finalization;
14. GitHub mailbox / structured controller-command visibility and bounded operator actions;
15. jobs, forks, clean-room review state, reports, diagnostics, and GitHub Direct views already required by Round 5;
16. links between controller state and the underlying compile/simulation evidence without duplicating or weakening authority.

## 6. UX and State Requirements

Every Tier 3 surface must cover the applicable states:

- loading;
- empty/not-started;
- ready;
- active/in-progress;
- waiting on a real dependency;
- stale/out-of-date;
- unauthorized/forbidden;
- not found/hidden resource;
- conflict/replay/lease expiry;
- retryable upstream failure;
- non-retryable validation failure;
- process blocker / operator intervention required;
- completed PASS;
- completed NO_GO.

The UI must never visually collapse process failure into a security finding, or security verdict into completion status.

## 7. Tier 3 Security and Integrity Requirements

The UI and adapter must preserve the controller's fail-closed rules, including:

- no substantive controller action without the required accepted instruction-read proof for the exact release/session/role/phase;
- no stale, mismatched, replayed, incomplete, wrong-role, wrong-phase, or wrong-release proof authorization;
- no claim/submission/review outside valid assignment and lease state;
- no gate transition without required accepted evidence;
- no remediation acceptance without required re-review/regression evidence;
- no finalization with missing phases, lanes, evidence, exact-release identity, or required report fields;
- no silent waiver of High/Critical unresolved security blockers;
- no secret, token, signed URL, raw RPC URL, host path, stack trace, validation token, or unredacted upstream error rendering;
- no wallet, signing, raw transaction, or blockchain broadcast capability.

## 8. Stage 7 Acceptance Requirements

Worker 4 Stage 7 acceptance must run against the exact Tier 3-capable production deployment and verify:

- production route/version/origin integrity;
- every required Tier 3 operator flow and state transition exposed by the UI;
- consistency between browser rendering, production API responses, audit-controller GitHub state, R2/artifact evidence, GitHub Direct state, and read-only RPC evidence;
- stale-version and mixed-version rejection;
- loading/empty/error/unauthorized/not-found/conflict/retry/cancel/partial-result behavior;
- keyboard, focus, semantic, screen-reader, responsive, long-content, Unicode/bidi, malformed-content, and hostile-content behavior;
- safe rendering and redaction;
- exact final recommendation bound to the tested production SHA/configuration digest.

Passing the earlier Lite browser acceptance does not waive any of these checks.

## 9. Stage 8 Acceptance Requirements

Recovery testing must use the Tier 3-capable release and prove, at minimum:

- idempotent redeployment of the accepted complete application;
- rollback to the last accepted complete release/configuration;
- no mixed Lite/Tier 3 browser/API/controller versions after rollback or redeploy;
- bounded key rotation and old-key rejection;
- safe R2 partial-publication recovery;
- GitHub duplicate/replay reconciliation;
- controller state remains authoritative and uncorrupted through infrastructure recovery;
- operator runbook and incident evidence capture cover Tier 3 controller failures as well as compile/simulation failures.

## 10. Completion Rule

Round 5 is not complete merely because Cloudflare Pages, the API, CORS, R2, GitHub bridge, and RPC connectivity are healthy.

Final Round 5 acceptance requires one exact production release that includes the Tier 3 audit-controller browser integration and passes both:

- Stage 7 full web/operator acceptance; and
- Stage 8 observability/recovery/rollback acceptance.

Any materially incomplete Tier 3 workflow, authority split, controller-rule bypass, unsafe rendering, mixed-version deployment, or inability to recover/rollback the complete application blocks final Round 5 sign-off.
