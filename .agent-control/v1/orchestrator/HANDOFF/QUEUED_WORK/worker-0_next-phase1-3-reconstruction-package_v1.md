# Queued Work Package — Worker 0

**Status:** prepared, not active  
**Target duration:** 45–60 minutes  
**Activation condition:** Worker 0 issue #51 final SHA is independently accepted by the orchestrator. The orchestrator must publish a new immutable assignment and exact starting SHA before Worker 0 may execute this package.

## Proposed objective

Construct the clean Phase 1–3 replacement integration chain from the accepted repair head without merging to `main`, deploying, compiling, or weakening security boundaries.

## Ordered subtasks

1. **Accepted-head inventory**
   - Re-fetch the orchestrator-approved repair SHA.
   - Produce an exact changed-file inventory grouped by Phase 1, Phase 2, Phase 3, shared infrastructure, and non-portable operational configuration.
   - Identify cross-phase dependencies and files that cannot be safely split.

2. **Three-phase reconstruction map**
   - Define exact target branches for the replacement Phase 1, Phase 2, and Phase 3 chain.
   - Map every accepted repair file and hunk to its owning phase.
   - Record explicit ordering constraints and expected parent SHA for each reconstructed branch.

3. **Reconstruct the Phase 1 branch**
   - Port only accepted Phase 1-scoped manifest, root-script, identity/configuration, boundary, and test-contract fixes.
   - Preserve execution-disabled behavior and avoid deployment changes.
   - Add focused source-only tests where a missing phase boundary is exposed.

4. **Reconstruct the Phase 2 branch on accepted Phase 1**
   - Port accepted workspace, generated-layer, server-owned-index, lifecycle, CORS, and profile-registry fixes.
   - Prove no caller-authored authoritative index snapshots remain in Phase 2 public/service inputs.

5. **Reconstruct the Phase 3 branch on accepted Phase 2**
   - Port accepted campaign/job, state transition, logs, evidence, report-consistency, and capability-truth fixes.
   - Keep submitted execution disabled.

6. **Static acceptance package**
   - Run only permitted direct Node/source checks that do not install dependencies or compile.
   - Produce exact branch SHAs, changed-path lists, cross-phase dependency notes, blocked checks, and residual risks.
   - Do not open or merge PRs unless the activated immutable assignment explicitly authorizes PR creation.

7. **Consolidated report**
   - Post one issue report covering all three reconstructed branches, exact parent/child SHAs, ownership, tests, blocked checks, and recommendation.

## Restrictions

No dependency installation/download, compilation, deployment, workflow approval, submitted execution, external audit tools, production secrets, AWS, CurveYield Lite modification, or merge to `main`.
