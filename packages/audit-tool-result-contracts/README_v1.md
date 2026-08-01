# CurveYield Phase 4 Tool Result Contracts v1

This private ESM package validates normalized `tool-result-v1` values and binds them to canonical Phase 4 invocation plans without interpreting or executing tool output.

## Public interfaces

- `PHASE4_RESULT_CONTRACT_SCHEMA_VERSION` pins `tool-result-v1`; versioned contract metadata is exported separately for runtime compatibility tracking.
- `validatePhase4ToolResult(value)` validates exact fields, profile/parser identity, nested bounds, lifecycle consistency, path safety, truncation state, and profile-specific summaries. It returns a recursively frozen defensive clone.
- `assertPhase4FixtureInventory(fileNames)` validates the exact 14-file CurveYield-owned fixture envelope inventory without accessing storage.
- `assertPhase4PackageCompatibility(options?)` proves the six accepted profile IDs, templates, parser versions, safe unpublished template state, and any supplied canonical invocation plans remain aligned.
- `validatePhase4ResultForPlan(plan, result)` revalidates the invocation plan and result contract, then requires exact profile, parser, and result-schema identity.

Production modules import only the stable Audit validation protocol and accepted Phase 4 profile, adapter, and parser packages. They perform no file access, storage enumeration, process operation, network operation, dynamic evaluation, package operation, container operation, submitted-source handling, or execution enablement.
