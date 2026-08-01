# CurveYield Phase 4 Tool Result Contracts v1

This private ESM package validates normalized `tool-result-v1` values and binds them to canonical Phase 4 invocation plans without interpreting or executing tool output.

## Public interfaces

- `PHASE4_RESULT_CONTRACT_SCHEMA_VERSION` pins `tool-result-v1`; versioned contract metadata is exported separately for runtime compatibility tracking.
- `validatePhase4ToolResult(value)` validates exact fields, exact profile/parser identity, nested bounds, lifecycle and classification consistency, path safety, truncation state, canonical collection order, profile-specific evidence identity, and summaries. It inspects only data descriptors and returns a recursively frozen defensive canonical clone.
- `PHASE4_TOOL_RESULT_DOCUMENTATION_VERSION` and `PHASE4_TOOL_RESULT_DOCUMENTATION` expose deterministic JSON-schema-style documentation for every accepted result field, nested evidence shape, bound, profile/parser pair, lifecycle rule, and profile-specific evidence rule.
- `serializePhase4ToolResultDocumentation()` serializes the frozen documentation deterministically for persistence, review, or external schema tooling.
- `assertPhase4FixtureInventory(fileNames)` validates the exact 14-file CurveYield-owned fixture envelope inventory without accessing storage.
- `assertPhase4PackageCompatibility(options?)` proves the six accepted profile IDs, templates, parser versions, safe unpublished template state, and any supplied canonical invocation plans remain aligned.
- `validatePhase4ResultForPlan(plan, result)` sanitizes and revalidates the invocation plan and result contract, then requires exact profile, parser, and result-schema identity.

## Adversarial boundary

Externally supplied values are copied through own data-property descriptors before validation. Accessors, symbols, non-enumerable fields, sparse or custom-prototype arrays, custom object prototypes, cycles, and hostile reflection traps are rejected without reading attacker-controlled property values. Plain-object keys are canonicalized by code-unit order; semantic duplicate collection entries cannot bypass deduplication by changing insertion order. Negative zero and NUL-bearing normalized strings are rejected because they are not canonical parser output.

The runtime validator remains authoritative. The schema documentation uses custom runtime-only behavior with `x-curveyield-*` keywords and never enables execution or silently broadens the accepted contract.

## Static security boundary

Production modules import only the stable Audit validation protocol and accepted Phase 4 profile, adapter, and parser packages. They perform no file access, storage enumeration, process operation, network or RPC operation, dynamic evaluation, package-manager or container operation, arbitrary command/image/binary/URL handling, credential or wallet handling, signing, transaction construction, broadcast, submitted-source handling, Lite import, or execution enablement.
