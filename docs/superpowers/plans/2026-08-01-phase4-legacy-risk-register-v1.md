# Phase 4 Legacy Risk Register v1

**Repository:** `CurveYield/contract-automation`  
**Orchestrator branch:** `audit-orchestration/phases-4-6-v1`  
**Reviewed base:** `6d26ef2fa73d04acb732e1ed1ab2ef385791f724`  
**Purpose:** Pre-integration review criteria for Workers 1 and 2. Legacy branches are reference-only and must not be blindly merged or cherry-picked.

## Branch Topology Finding

The substantive legacy Phase 4 branches were created from merge base `eea324abc11cce640005cdd83ef1822698e0b9d1` and are 91 commits behind the repaired shared base.

| Legacy branch | Ahead of merge base | Behind repaired base | Files introduced |
|---|---:|---:|---|
| `audit-phase4/agent-1-profile-contracts` | 3 | 91 | profile package, implementation, tests |
| `audit-phase4/agent-2-adapters` | 3 | 91 | adapter package, implementation, tests |
| `audit-phase4/agent-3-parsers` | 3 | 91 | parser package, implementation, tests |
| `audit-phase4/agent-4-catalog-api-web` | 4 | 91 | catalog package and Phase 4 API test |
| `audit-phase4/agent-5-fixtures-ci-boundary` | 0 | 91 | no changes relative to its merge base |

`audit-phase4/integration-v3` is clean and identical to the repaired shared base. This is the correct integration target after worker acceptance.

## R-01 — Invocation Plan Validator Accepts Arbitrary Argument Tokens

**Legacy source:** `audit-phase4/agent-2-adapters`  
**Severity:** High  
**Status:** Must be repaired by Worker 1 before acceptance

The legacy `validateInvocationPlan` checks only that `arguments` is a bounded array of strings. It does not prove that the token sequence was deterministically derived from the profile ID and normalized configuration.

An externally constructed plan can therefore pass validation with arbitrary bounded argument tokens while retaining a permitted profile ID and immutable digest.

### Required repair

Validation must recompute the expected ordered token sequence from the validated profile contract and configuration, then require exact structural equality. Merely scanning tokens for forbidden words is insufficient.

The accepted contract must not allow callers to submit an independently authored argument array.

### Required regression evidence

A red test must demonstrate acceptance of a forged argument sequence on the legacy behavior. The green test must reject:

- additional tokens;
- reordered tokens;
- substituted subcommands;
- token omission;
- profile/configuration mismatch.

## R-02 — Nested Invocation Plan Structures Are Under-Validated

**Legacy source:** `audit-phase4/agent-2-adapters`  
**Severity:** High  
**Status:** Must be repaired by Worker 1 before acceptance

The legacy validator enforces exact keys only at the plan root. It performs partial type checks on nested structures but does not consistently enforce exact nested keys or immutable values for:

- `environmentPolicies`;
- `mounts`;
- individual input mounts;
- individual output mounts;
- `evidenceContract`;
- `artifactContract`;
- `cancellation`.

The validator also does not fully prove that mount keys, destinations, limits, policy IDs, schema versions, grace periods, adapter/parser versions, program identity, and digest repository are the deterministic values produced by the selected profile and context.

### Required repair

Every nested object must have an exact schema. Validation must reject unknown fields recursively and recompute deterministic fields from validated source inputs wherever possible.

Input and output mount descriptors must be validated element-by-element with bounded counts, exact target paths, read-only state, safe source keys, deterministic ordering, exact output destination prefix, and exact artifact size limits.

### Required regression evidence

Tests must reject unknown or altered nested values at every level, including unknown fields inside arrays of mount descriptors.

## R-03 — Recorder Boundary Depends on Weak Validation

**Legacy source:** `audit-phase4/agent-2-adapters`  
**Severity:** High  
**Status:** Must be repaired by Worker 1 before acceptance

The legacy `InMemoryExecutorTransport.submit` records any object accepted by `validateInvocationPlan`. Because that validator accepts forged argument tokens and under-validates nested structures, the recorder can retain attacker-authored plan semantics despite returning `executor_unavailable`.

Although the recorder does not directly execute, accepted data could later be consumed by an executor implementation. The contract must be safe before an executor exists.

### Required repair

The recorder must accept only a fully canonical, deterministic, revalidated invocation plan. Prefer accepting source inputs and constructing the plan internally, or require exact canonical equality against a recomputed plan.

The recorder must retain no process, network, filesystem mutation, container, package-manager, wallet, signer, transaction, or broadcast capability.

## R-04 — Compiler Parser Dead Destructuring Loop

**Legacy source:** `audit-phase4/agent-3-parsers`  
**Severity:** Medium  
**Status:** Known mandatory Worker 2 repair

The legacy compiler parser contains a loop equivalent to:

```js
for (const [index, item] of array(root.errors ?? [], '$.resultJson.errors')) {
  void index;
}
```

Compiler diagnostic entries are objects rather than iterable pairs. The dead loop throws before the real diagnostic loop and converts valid compiler failure output into a normalized `parser_error` rather than `tool_failure`.

### Required repair

Remove the dead loop and preserve the actual indexed diagnostic traversal. Do not alter the expected result to hide the defect.

### Required regression evidence

The red test must show valid compiler diagnostics becoming `parser_error`. The green test must show deterministic normalized diagnostics and `tool_failure` classification.

## R-05 — Duration Domain Error Is Collapsed Into Generic Integer Error

**Legacy source:** `audit-phase4/agent-3-parsers`  
**Severity:** Medium  
**Status:** Known mandatory Worker 2 repair

`prepareInput` validates `durationMs` through the generic integer helper, producing `invalid_integer` rather than the required domain-specific `invalid_duration` result.

### Required repair

Add a duration-specific validator and stable `invalid_duration` code. Preserve explicit bounds and deterministic sanitized messages.

## R-06 — Required Deduplication Is Incomplete

**Legacy source:** `audit-phase4/agent-3-parsers`  
**Severity:** Medium  
**Status:** Must be addressed by Worker 2

The legacy compiler parser deduplicates diagnostics, but other normalized collections are sorted without equivalent deduplication, including test cases, fuzz cases/counterexamples, invariants/counterexamples, and potentially downstream finding/coverage collections.

The governing Phase 4 requirement calls for deterministic sorting and deduplication.

### Required repair

Define explicit identity keys for each normalized collection and deduplicate before final sorting. Counterexample identity must be deterministic and bounded.

### Required regression evidence

Fixtures containing duplicate entries must produce one normalized entry in a deterministic position, without silently merging distinct records that share only a display name.

## R-07 — Legacy Fixture/CI Branch Contains No Recoverable Work

**Legacy source:** `audit-phase4/agent-5-fixtures-ci-boundary`  
**Severity:** Informational  
**Status:** Do not rely on legacy completion claims

The branch contains no commits beyond its old merge base. Worker 2 must create the required fixture corpus independently on the repaired base. The orchestrator must add any CI/boundary integration later under orchestrator ownership.

## R-08 — Legacy Catalog/API Work Must Wait for Accepted Interfaces

**Legacy source:** `audit-phase4/agent-4-catalog-api-web`  
**Severity:** Medium  
**Status:** Orchestrator-owned review after Workers 1 and 2 stabilize

The old branch adds a catalog package and an API test from the outdated base. It must not be integrated before the final profile and parser interfaces are accepted.

The orchestrator will independently review and port only relevant behavior after Worker 1 and Worker 2 acceptance. No blind cherry-pick is permitted.

## Worker 1 Acceptance Addendum

Worker 1's final report must explicitly state how R-01, R-02, and R-03 were prevented, with red/green evidence and exact final interfaces.

A branch that only reproduces the legacy adapter code is `REJECT`.

## Worker 2 Acceptance Addendum

Worker 2's final report must explicitly state how R-04, R-05, and R-06 were repaired, with red/green evidence and fixture inventory.

A branch that changes expected tests to accept the legacy classifications is `REJECT`.

## Orchestrator Review Procedure

When worker commits land:

1. freeze the exact worker head SHA;
2. compare it to the repaired shared base;
3. reject any non-owned changed path;
4. inspect every added and modified source file;
5. map each risk in this register to a code location and test;
6. record `resolved`, `partially resolved`, `unresolved`, or `not applicable`;
7. integrate only after all High findings are resolved and all Medium findings are resolved or explicitly accepted with a bounded repair plan.
