# Phases 4–6 — Tool Profile Integrations v2

## Scope

Current-stack development includes every allowlisted profile contract, argument validator, result parser, normalized evidence schema, safe fixture, and GitHub Actions test workflow for:

```text
solidity-compile-v1
foundry-test-v1
foundry-fuzz-v1
foundry-invariant-v1
slither-v1
coverage-forge-v1
hardhat-test-v1
echidna-v1
mutation-v1
dependency-scan-v1
solidity-smt-v1
halmos-v1
formal-obligations-v1
```

## GitHub Actions restriction

Actions may run CurveYield-owned trusted fixtures committed in this repository to prove adapters and parsers. Workflows MUST reject or ignore uploaded source locations, issue-body commands, arbitrary refs, custom images, and submitted project scripts.

## Executor contract

Each profile resolves to:

- immutable profile ID and image digest;
- adapter and parser versions;
- exact tool/compiler versions;
- allowlisted structured configuration;
- resource and network policy IDs;
- expected normalized result schema;
- expected artifact manifest;
- random-seed rules;
- cancellation behavior.

The output parsers can be production-complete before the executor exists. The public job system remains execution-disabled.

## R2 use

R2 stores profile metadata, fixture result bundles, parser snapshots, normalized results, and evidence. Container layers remain in GHCR and do not consume R2 storage.
