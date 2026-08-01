# Phase 6 Text Field Policy v2

## Deterministically redacted message/provenance fields

The following fields use fixed `[redacted]` and `[path]` replacement rules and reject unsafe control characters:

- assertion `description`;
- trace-step `detail`;
- counterexample `summary`;
- diagnostic `message`;
- parser-warning `message`;
- source-reference `sourceId`.

Patterns cover private keys, mnemonic/seed phrases, API/access keys, bearer/authorization tokens, `KEY=value`, `TOKEN=value`, `SECRET=value`, and absolute Windows/POSIX host paths.

## Semantic fields that are not secret-redacted

The following fields preserve exact formal meaning and receive only explicit length, numeric, identifier, and unsafe-control checks:

- obligation and assertion `expression`;
- model-entry `name`, `type`, and `value`;
- trace-step `operation`;
- normalized IDs and reference IDs.

A secret-looking byte string in an expression or model value is retained because replacing it would change the proof/model semantics. Unsafe C0 control characters are rejected instead of normalized.

## Validation paths

Only bounded grammar-conforming validation paths are emitted. Unknown, oversized, control-character, or secret-looking field names map to `$.[rejected-field]` and are never copied into parser output.
