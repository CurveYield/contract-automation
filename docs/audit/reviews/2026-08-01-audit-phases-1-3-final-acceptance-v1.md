# CurveYield Audit Phases 1–3 Final Acceptance Report v1

## Determination

**Integration recommendation: REJECT the exact reviewed head pending repair and fresh approved CI.**

The reviewed code head is `6d26ef2fa73d04acb732e1ed1ab2ef385791f724`. The three requested GitHub Actions runs did not execute any job; all concluded `action_required` before job creation. Static exact-head review also found a guaranteed repository test-contract failure and material unresolved specification/runtime mismatches. No production credentials should be added, and no security control should be weakened.

## Worker and runtime

- Worker ID: `worker-0-finalize`
- Runtime/session ID: `0ed888c2dabd`
- Assigned branch: `audit-finalize/phases-1-3-v1`
- Isolated source workspace: `/mnt/data/contract-automation-worker-0-finalize-connector`
- Expected starting SHA: `6d26ef2fa73d04acb732e1ed1ab2ef385791f724`
- Exact reviewed code SHA: `6d26ef2fa73d04acb732e1ed1ab2ef385791f724`
- Branch drift at startup: none; branch and expected SHA compared identical (`ahead_by=0`, `behind_by=0`)
- Start UTC: `2026-08-01T10:30:47Z`
- Start America/Los_Angeles: `2026-08-01T03:30:47-0700`
- Acceptance review finish UTC: `2026-08-01T10:40:44Z`
- Acceptance review finish America/Los_Angeles: `2026-08-01T03:40:44-0700`
- Issue #44 access: confirmed
- PR #43 access: confirmed
- `AGENTS.md`: absent at the assigned ref

An independent single-branch clone was attempted first. The runtime could not resolve `github.com`, so exact-ref repository state, files, pull requests, branches, workflow metadata, jobs, and artifacts were retrieved through the connected GitHub app. No dependency was installed or downloaded.

## Scope and ownership

### Owned path changed by this worker

- `docs/audit/reviews/2026-08-01-audit-phases-1-3-final-acceptance-v1.md` — this report only.

### Non-owned paths changed by this worker

- None.

### Behavior changes

- None.
- Red/green evidence for worker-authored behavior changes: not applicable.
- No contract, runtime, workflow, test behavior, deployment configuration, or Lite file was modified.

## GitHub Actions investigation

| Run ID | Workflow | Status | Conclusion | Jobs | Artifacts |
|---:|---|---|---|---:|---:|
| `30693011187` | Test CurveYield Audit Phase 1 | completed | `action_required` | 0 | 0 |
| `30693011196` | Regenerate Audit Specification Manifest Once | completed | `action_required` | 0 | 0 |
| `30693011226` | Dry Run CurveYield Audit Deployment | completed | `action_required` | 0 | 0 |

### Exact cause classification

The runs were blocked by **GitHub workflow approval gating before job creation**.

Evidence:

1. Every requested run has zero jobs and zero artifacts.
2. PR #43 modifies both existing Audit workflows and introduces the one-time manifest workflow.
3. No checkout, install, test, build, Wrangler, environment, permission-sensitive job step, or secret-consuming step ever started.
4. The Audit test and dry-run workflows are intentionally secret-free.

Therefore these conclusions are **not evidence of** a test failure, a workflow command/configuration failure inside a runner, missing production secrets, insufficient job permissions encountered by a running job, an environment deployment approval wait, or a build/Wrangler failure.

Required GitHub step: a repository user with sufficient Actions permission must approve the pending workflow execution. However, approval and rerun should occur only after the exact-head defects below are repaired.

The connected GitHub app does not expose the workflow-approval operation, so no approval was attempted.

## Exact-head acceptance findings

### A-01 — Guaranteed manifest test failure — blocking

`docs/audit/specifications-v2/MANIFEST_v2.json` now uses `schemaVersion`, `generatedAtUtc`, `files`, and `fileCount`. `scripts/rebuild-audit-spec-manifest.mjs` regenerates that same shape.

The exact-head test `test/audit-infra.test.mjs`, in `v2 current-stack specifications are complete and hash-verified`, still requires:

- `manifest.version === 2`
- `manifest.package === 'CurveYield Audit Current-Stack Specifications'`

Those properties are absent from the exact manifest. The full test suite cannot be green at this head. This is a deterministic source/test contract contradiction, not a speculative runtime concern.

Required repair: choose one canonical manifest contract and update the generator, manifest, and all tests atomically. Preserve hash verification and the 22-file count.

### A-02 — Approved secret-name mapping remains unresolved — blocking

The approved v2 secret specification defines `AUDIT_CLIENT_API_KEY`, `AUDIT_GPT_API_KEY`, `AUDIT_EDGE_CONTROL_PLANE_TOKEN`, and `AUDIT_ATTESTATION_PRIVATE_KEY`.

The exact runtime authentication/readiness paths continue to consume legacy/internal names: `AUDIT_READ_API_KEY`, `AUDIT_SUBMIT_API_KEY`, `AUDIT_ADMIN_API_KEY`, and `AUDIT_INTERNAL_SERVICE_KEY`.

No exact-head mapping from the approved client/GPT/edge identities to those runtime bindings was found in `entry.mjs`, `runtime.mjs`, or `wrangler.toml`. The production-readiness tests also seed the legacy/internal names, so they do not prove deployment with the approved specification names.

This was listed in PR #43 as a confirmed root cause under repair, but it remains outstanding.

Required repair: implement and test the documented scope mapping without adding extra persistent secrets, or revise the specification and deployment documentation consistently after security review.

### A-03 — Caller-authored mutable index paths remain — blocking

The Phase 2 specification requires server-side services to read and merge authoritative indexes; callers may supply an expected ETag but may not author full index snapshots.

Exact-head behavior still includes:

- `importGitHubWorkspace` requiring and validating caller-supplied `tenantIndex`, building `storedIndex` from it, and writing it as authoritative state;
- `attachLayer` requiring caller-supplied `layerIndex` and using it for the index write;
- the public API schema accepting/passing these snapshots.

Uploaded-workspace sealing reads the stored tenant index, but still unnecessarily requires a caller `tenantIndex` payload. GitHub import and layer attachment remain clobber-capable or stale-snapshot dependent.

This was also listed in PR #43 as a confirmed root cause under repair.

Required repair: remove full mutable index snapshots from public/service inputs, read current deterministic indexes server-side, merge entries, and conditionally write using the stored ETag or create-only condition. Add red/green regression coverage for preserving earlier entries and partial-write retries.

### A-04 — Phase 1 root-script names do not match the v2 deliverable — specification mismatch

Phase 1 specification 04 requires root scripts named `audit:test`, `audit:lint`, and `audit:build`.

The exact `package.json` instead defines `test:audit`, `build:audit`, and `audit:boundary`, with no `audit:lint` script.

Required resolution: either add compatibility aliases or revise the Phase 1 specification and acceptance tests to the chosen naming convention.

### A-05 — Fresh acceptance evidence is absent — blocking

The requested runs never created jobs. Consequently the exact repair head has no fresh authoritative evidence for total tests, JavaScript syntax module count, Audit/Lite boundary counts, separate Audit web build, or Wrangler dry run.

Older PR descriptions report historical counts for pre-repair heads, but those are stale and must not be represented as evidence for `6d26ef2f...`.

### A-06 — Automatic external deployment evidence exists — operational risk

PR #43 contains a Cloudflare bot report stating a successful production deployment for exact commit `6d26ef2f` at `2026-08-01 09:36 UTC`.

This worker did not trigger, authorize, or perform that deployment. The evidence does not substitute for the required Audit web build or Wrangler dry-run checks. Repository/Cloudflare Git integration should be reviewed so audit repair branches cannot unintentionally deploy production resources.

## Positive exact-head evidence

- `AUDIT_EXECUTION_ENABLED = "false"` remains in the Audit Wrangler configuration.
- Runtime capability/readiness objects hard-code `executionEnabled: false`.
- Function-valued test adapters are hidden outside `AUDIT_TEST_MODE=true`.
- GitHub import, generated layers, evidence acceptance, and report publication are feature-gated where the runtime identifies missing production integrations.
- Audit workflows use `npm ci --ignore-scripts --no-audit --no-fund` and immutable action commit SHAs.
- The workflow files do not add production secrets to PR CI.
- PR #43 is 91 commits and 46 changed files ahead of `audit-phase3/integration-v2`.
- Lite files were not changed by this worker.

These properties do not override the blocking defects or missing fresh executed evidence.

## Verification ledger

| Check | Exact result |
|---|---|
| Branch/SHA identity | exact match before report-only commit |
| Required workflow conclusions | 3 × `action_required` |
| Jobs created | 0 for each requested run |
| Artifacts created | 0 for each requested run |
| Fresh tests passed/failed | unavailable; workflow did not execute; exact source contains a guaranteed failing test contract |
| JavaScript syntax-valid module count | unavailable; no approved run |
| Audit boundary count | unavailable; no approved run |
| Lite boundary count | unavailable; no approved run |
| Audit web build | not freshly evidenced |
| Wrangler dry run | not freshly evidenced |
| Execution-disabled assertion | confirmed statically in Wrangler and runtime |
| Existing external Cloudflare result | successful production deployment bot report at exact SHA; not worker-initiated and not accepted as dry-run evidence |
| Repair diff | 91 commits, 46 changed files versus Phase 3 integration head |

## Checks intentionally not run

The following were not run because they would violate the standing no-install/no-download/no-compile restriction or because the approved CI job never started:

- `npm install`
- `npm ci`
- compilation/build commands requiring dependency execution;
- `npm test` in a reconstructed partial tree;
- `npm run build:audit`;
- `wrangler deploy --dry-run`;
- any deployment command;
- any submitted-project, external audit-tool, package hook, Solidity compiler, or hostile workload execution.

No production secret was added and no permission/security boundary was weakened to obtain a green check.

## Consolidated submission chain

The intended clean chain already exists as open draft PRs:

1. Phase 1 — PR #13: `audit-phase1/integration-v2` → `main`
2. Phase 2 — PR #24: `audit-phase2/integration-v2` → `audit-phase1/integration-v2`
3. Phase 3 — PR #35: `audit-phase3/integration-v2` → `audit-phase2/integration-v2`

PR #43 is the repair gate based on Phase 3. Its accepted changes have not yet been reconstructed into #13/#24/#35.

Required replacement sequence after repairing and verifying the repair head:

1. Backport Phase 1-scoped CI, lockfile, manifest-contract, root-script, identity/configuration, and boundary fixes to the Phase 1 integration branch; update PR #13.
2. Rebase/reconstruct Phase 2 on accepted Phase 1; include lifecycle/CORS, workspace, generated-layer, profile-registry, and server-owned-index fixes; update PR #24.
3. Rebase/reconstruct Phase 3 on accepted Phase 2; include campaigns/jobs, state transitions, logs, object-reference transport, evidence attestation, report consistency, runtime capability truth, and final integration tests; update PR #35.
4. Run the full approved workflow set on each exact reconstructed head.
5. Only after the replacement chain is reviewable should obsolete fragmented branches/PRs be closed or clearly superseded.

The historical agent PRs for Phases 1–3 are already merged/closed into their integration branches. No additional obsolete-workstream closure was performed.

## Commits and files authored by worker-0

- Behavior commits: none.
- Report-only commit: created through the connected GitHub contents operation on `audit-finalize/phases-1-3-v1`; the resulting commit SHA is recorded in issue #44 because a Git commit cannot self-embed its own hash.
- File authored: `docs/audit/reviews/2026-08-01-audit-phases-1-3-final-acceptance-v1.md`.

## Residual risks

1. Approving the blocked workflows without repairing A-01 will expose an immediate test failure.
2. Production configured only with approved secret names may remain unready or reject authentication because runtime mapping is absent.
3. Caller-authored index snapshots can still lose or overwrite authoritative state on GitHub import/layer attachment paths.
4. Existing Phase 1–3 PR verification numbers are stale relative to the repair head.
5. Automatic Cloudflare Git deployment may deploy repair branches without an explicit release decision.
6. The connected environment could not independently clone through Git transport, so no local whole-tree execution was represented as performed.

## Final recommendation

**REJECT** the exact reviewed repair head for Phase 1–3 integration.

Minimum acceptance gate:

1. Repair A-01 through A-04 with test-first evidence.
2. Review/disable unintended automatic deployment behavior.
3. Obtain the required GitHub workflow approval.
4. Run fresh exact-head tests, syntax validation, boundary verification, Audit web build, and Wrangler dry run.
5. Record exact counts and zero failures.
6. Reconstruct and review PRs #13, #24, and #35 from that accepted head.

Do not merge to `main`, deploy, add production secrets, or enable submitted execution as part of these repairs.
