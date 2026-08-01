# Phase 6 Profile Contracts v2

This package defines data-only, execution-disabled contracts for `solidity-smt-v1`, `halmos-v1`, and `formal-obligations-v1`.

## Publication boundary

Publication accepts exactly `imageDigest` and `releaseIdentifier`. The digest must be lowercase `sha256:` plus 64 hexadecimal characters. The release identifier must exactly equal the immutable template tool release (`v0.8.30`, `v0.3.3`, or `formal-obligations-v1`). Floating labels, ranges, unrelated tags, custom fields, forbidden nested fields, and mismatched profile/version labels are rejected. Published metadata remains `runnable=false`, `executionEnabled=false`, with `executor.available=false`.

No template contains or invents an image digest. Until the orchestrator supplies a real immutable GHCR digest, templates remain unpublished and non-runnable.

## Object and normalization boundary

Every externally supplied object must use `Object.prototype` or a null prototype. Class instances and custom prototypes are rejected. Normalized identity collections deduplicate byte-identical normalized records and reject conflicting equal identities with `conflicting_duplicate`. All collections and nested reference arrays are canonically ordered.

Referential integrity is owned here: obligation assertion IDs, source-reference IDs, and counterexample obligation/assertion/model/trace IDs must resolve within the same normalized result.

## Text safety

See `TEXT_FIELD_POLICY_v2.md`. Message and provenance fields receive deterministic redaction. Symbolic expressions, trace operations, and model values preserve formal semantics and receive only size, numeric, and unsafe-control validation.

## Execution boundary

The package does not import, spawn, compile, install, download, invoke, or connect to any compiler, solver, formal engine, container, network destination, executor, or submitted source. `AUDIT_EXECUTION_ENABLED` remains false outside this isolated package and no executor integration is provided here.
