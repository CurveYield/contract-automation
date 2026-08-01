# Audit Phase 6 Inert Parsers v1

This package normalizes explicitly supplied inert `Uint8Array` capture bytes for:

- Solidity SMTChecker captures;
- Halmos captures;
- normalized formal-obligation captures.

## Parser interface

- `parseSoliditySmtBytes(bytes)`
- `parseHalmosBytes(bytes)`
- `parseFormalObligationsBytes(bytes)`

Each parser accepts only an explicitly supplied `Uint8Array`. It does not open files, resolve URLs, invoke a tool, execute source, spawn a process, use a network, or retrieve dependencies.

## Capture envelopes

The accepted inert envelope schema versions are:

- `solidity-smt-capture-v1`;
- `halmos-capture-v1`;
- `formal-obligations-capture-v1`.

Every accepted fixture envelope must declare `fixtureOwner: "CurveYield"` and the matching profile ID. Raw tool-output adapters are deliberately deferred until predecessor recorder interfaces are accepted.

## Determinism and failure behavior

Collections are bounded, deterministically ordered, and normalized through the Phase 6 formal-result contract. Malformed, oversized, invalid UTF-8, or invalid-schema captures return a bounded `parser_error` result without exposing raw input, stack traces, secrets, or internal filesystem paths. Truncation is explicit through `truncated: true` and bounded parser warnings.
