# Audit Round 1 Integration Notes v2

The Round 1 integration branch is `audit-round1/integration-v1`, reset before Audit transplants to reviewed latest `main` SHA `c1f624cee5de9644736d6ab8f967661e6ae348fd`.

The previously accepted Phase 3 source `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c` and current `main` diverge after shared merge base `f0a1dd46551fc867778a295eef525262efb51b00`. Integration must reconstruct accepted Audit-owned paths onto latest main while preserving every later GitHub-native simulation fix.

Stale PRs #43 and #73 are closed and must not be merged. Phase 4 branches carry stale ancestry and must be transplanted by accepted owned path.

The isolated Phase 7 issue #80 and Phase 8 issue #91 verdicts are superseded by independent source review. Their branches are untrusted source inputs only. Issue #97 owns the latest-main Phase 7–8 reconstruction, required repairs, cross-phase acceptance, and source/destination provenance.

Issue #95 owns the latest-main Phase 1–6 reconstruction. Issue #72 owns the remaining Phase 4 catalog/API source. Phase 9 GitHub Direct core proceeds independently on issue #98 and is not an input to this Round 1 Phase 1–8 branch until its own acceptance and later Phase 9 integration gate.

The authoritative control records are:

- `.agent-control/v1/integration/ROUND1_INTEGRATION_GATE_v1.json`
- `.agent-control/v1/integration/ROUND1_RECONSTRUCTION_MANIFEST_v1.json`
- `.agent-control/v1/integration/ROUND1_ACCEPTANCE_CHECKLIST_v1.md`
- `.agent-control/v1/integration/ROUND1_SOURCE_REGISTRY_v1.json`

No Audit submitted-project execution is enabled. No integration change may be merged to `main` before combined acceptance.
