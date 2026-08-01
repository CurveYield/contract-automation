# Audit Phase 6 Profile Contracts v1

This package defines strict, versioned, data-only contracts for:

- `solidity-smt-v1`;
- `halmos-v1`;
- `formal-obligations-v1`.

It does not execute a compiler, solver, formal engine, container, command, script, package manager, or submitted source.

## Exported contracts

- immutable profile templates and exact version metadata;
- strict per-profile configuration validators;
- recursive forbidden-field rejection;
- resource, network, timeout, cancellation, evidence, artifact, and publication policies;
- normalized validators for proof obligations, assertions, proof outcomes, models, traces, counterexamples, source references, diagnostics, and parser warnings;
- immutable-digest publication validation that never enables execution.

## Normalized outcomes

`proved`, `disproved`, `unknown`, `timeout`, `resource_exhausted`, `cancelled`, and `parser_error`.

## Security boundary

All profile templates set both `executionEnabled: false` and `runnable: false`. Network access is disabled. Publication requires a real immutable lowercase `sha256:` digest, but the returned published metadata remains non-runnable and execution-disabled.

## Bounds

The package enforces explicit limits for input bytes, symbolic expression length, obligations, assertions, trace depth, traces, model entries, models, counterexamples, diagnostics, source references, parser warnings, identifier/string/numeric sizes, and nested collection depth. The authoritative values are exported as `PHASE6_BOUNDS`.
