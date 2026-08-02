# Worker 0 Round 4 Stage A Review Plan

**Goal:** Independently verify and minimally harden the Worker 2 Phase 1–6 integration spine before Phase 7–8/API/full-platform intake.

## Gate 1 — Source truth and observed RED

- Pin issue #114 report, release review, release manifest, starting SHA, and protected simulation/RPC blobs.
- Map each Phase 7–8 dependency to the Phase 1–6 identity, lifecycle, result, evidence, report, CAS, storage-prefix, and public-interface contracts it relies on.
- Add observed RED tests for empty or unowned interface locks, recommendation/adaptation mismatch, ambiguous shared-file fields, aliased paths, and empty release intake.
- Publish Checkpoint 1 before any production change.

## Gate 2 — Minimal integration-spine repairs

- Modify only `packages/audit-release-integration/**` unless an integration-owned fixture/document is required.
- Route builders and validators through the same semantic checks.
- Preserve deny-by-default capabilities and all Phase 7–8/API/web/Direct/frozen-addon production blobs.
- Add compatibility, hostile-input, stale-source/blob, overlap, shared-union, and deterministic replacement tests.
- Publish Checkpoint 2 with exact changed paths and test evidence.

## Gate 3 — Broad acceptance and Stage B intake

- Run all permissible direct Node tests, syntax/JSON/static checks, changed-path allowlist, provenance checks, and protected-blob verification.
- Publish the Stage A review report and a deterministic Phase 7–8/API intake contract under `docs/audit/round4/worker0/`.
- Publish Checkpoint 3 and then monitor issue #119 and issue #122 for Stage B activation.

## Restrictions

No dependency installation/download, compilation/build, live process/container/network/RPC, wallet/signing, transaction/broadcast, deployment, workflow approval, production secret, PR, branch merge, or merge to `main`.
