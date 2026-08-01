# CurveYield Audit Phase 4 Result Contracts v1

This package validates already-normalized `tool-result-v1` values and binds them to canonical Phase 4 invocation plans. It performs deterministic in-memory validation only. It does not read files, invoke tools, start processes, access networks, install packages, or execute submitted projects.

Public interfaces:

- `validatePhase4ToolResult(value)` validates the complete normalized result contract and returns a recursively frozen defensive clone.
- `assertPhase4PackageCompatibility(plans?)` verifies the six accepted profile/template/parser identities and, when supplied, the six canonical invocation plans.
- `validatePhase4ResultForPlan(plan, result)` validates and returns a frozen canonical plan/result binding.

The package imports only the accepted shared validation, profile-contract, invocation-plan, and parser identity modules. Fixture replay remains test-only.
