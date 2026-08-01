# Phase 6 Inert Parsers v2

These parsers consume only caller-supplied `Uint8Array` bytes. They never execute Solidity, SMTChecker, Halmos, Z3, a container, a package manager, submitted code, or an external process.

Capture envelopes require the exact producer identity `curveyield-formal-capture-producer-v1`. The former test-only `fixtureOwner` capture field is rejected; repository ownership is checked by `FIXTURE_INVENTORY_v2.json` and focused tests.

All required capture keys are exact and allowlisted. Tool versions are exact: Solidity `0.8.30`, Halmos `0.3.3`, and formal obligations `1.0.0`. Malformed inert bytes produce bounded `parser_error` results. Validation paths are sanitized and never echo attacker-controlled field names.

Canonical sorting, exact-duplicate deduplication, conflicting-duplicate rejection, referential integrity, deterministic text redaction, bounded truncation, and replay/permutation invariance are enforced before normalized output is returned.
