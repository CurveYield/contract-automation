# CurveYield Audit Tool Parsers v1

## Boundary

This package normalizes only explicitly supplied inert UTF-8 text or JSON bytes. It never invokes tools, compilers, processes, containers, networks, or submitted code. The parser module imports only the shared Audit protocol validation primitives and has no filesystem, process, network, dynamic-code, or executable capability.

`parseToolOutput(profileId, input)` accepts one of the six Phase 4 profile IDs and a bounded envelope described by `schemas/parser-input-v1.schema.json`. A completed result requires serialized JSON in `resultJson` plus an exit code. Timeout, cancellation, and resource-exhaustion envelopes are normalized without interpreting partial result data.

## Normalized interface

Every call returns the stable `tool-result-v1` shape described by `schemas/tool-result-v1.schema.json`. The schema always includes diagnostics, tests, counterexamples, invariants, findings, coverage, warnings, errors, and summary fields, even when a field is empty for the selected profile.

Profiles and parser versions:

| Profile | Parser version |
|---|---|
| `solidity-compile-v1` | `solidity-compile-parser-v1` |
| `foundry-test-v1` | `foundry-test-parser-v1` |
| `foundry-fuzz-v1` | `foundry-fuzz-parser-v1` |
| `foundry-invariant-v1` | `foundry-invariant-parser-v1` |
| `slither-v1` | `slither-parser-v1` |
| `coverage-forge-v1` | `coverage-forge-parser-v1` |

## Determinism

Deterministic sorting and deduplication use code-unit string ordering, numeric ordering, and exact normalized JSON identity. Compiler diagnostics, tests, fuzz cases, invariants, findings, source references, and coverage files are sorted and deduplicated. Trace entries preserve original semantic order and are bounded without reordering. Conflicting coverage entries for one path become a parser error rather than being merged ambiguously.

Collections exceeding their output limit are truncated after normalization and emit stable `truncated` warnings with an exact omitted count. The top-level `truncated` flag is derived from those warnings.

## Bounds

Runtime bounds are exported as `PARSER_LIMITS` and cover total input bytes, total lines, findings, test cases, trace entries, source references, string length, numeric magnitude, nesting depth, raw collection entries, object fields, counterexample bytes, and duration. Unsafe absolute, parent-relative, URI-shaped, or machine-specific source paths are rejected.

## Parser-error sanitization

Parser-error sanitization maps failures to a closed catalog of stable codes, fixed messages, and bounded JSON paths. Raw exception text, stack traces, secrets, host filesystem paths, runtime versions, and machine-specific messages are never copied into normalized results. Results are recursively frozen before return.

## Trusted fixtures

CurveYield-owned inert fixtures and exact normalized snapshots are stored in `test/fixtures/audit-phase4/`. They cover success, tool findings or failures, malformed output, timeout, cancellation, resource exhaustion, unsafe paths, counterexamples, and truncation.
