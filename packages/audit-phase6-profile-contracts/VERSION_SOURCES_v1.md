# Phase 6 Official Version Sources v1

Retrieval date: **2026-08-01**

This record identifies exact candidates only. It does not authorize execution or publication. Every profile template remains unpublished, non-runnable, and execution-disabled until a real immutable lowercase `sha256:` GHCR digest and orchestrator acceptance are supplied.

## Candidate matrix

| Profile | Component | Exact version | Release identifier | Official primary source | Compatibility decision |
|---|---|---:|---|---|---|
| `solidity-smt-v1` | Solidity compiler and SMTChecker | `0.8.30` | `v0.8.30` | `https://github.com/ethereum/solidity/releases/tag/v0.8.30` | Solidity `0.8.30` includes SMTChecker and is above the official documented `solc >=0.8.14` requirement for Z3 versions at or above `4.8.16`. |
| `solidity-smt-v1` | Z3 Python/package version | `4.12.6.0` | `z3-4.12.6` | `https://github.com/Z3Prover/z3/releases/tag/z3-4.12.6` | Selected as the exact shared solver candidate because Halmos `0.3.3` pins `z3-solver==4.12.6.0`; no solver execution was performed. |
| `halmos-v1` | Halmos | `0.3.3` | `v0.3.3` | `https://github.com/a16z/halmos/tree/v0.3.3` | Official `v0.3.3` metadata requires Python `>=3.11` and pins `z3-solver==4.12.6.0`. |
| `halmos-v1` | Solidity compiler candidate | `0.8.30` | `v0.8.30` | `https://github.com/ethereum/solidity/releases/tag/v0.8.30` | Recorded as the exact compiler candidate for eventual immutable image composition. The exact Halmos/Foundry/compiler image composition remains unverified because execution and dependency retrieval are forbidden. |
| `halmos-v1` | Z3 Python/package version | `4.12.6.0` | `z3-4.12.6` | `https://github.com/a16z/halmos/blob/v0.3.3/pyproject.toml` | Direct exact dependency pin in Halmos `v0.3.3`; official Z3 release tag resolves the corresponding upstream release. |
| `formal-obligations-v1` | CurveYield normalized schema | `1.0.0` | `formal-obligations-v1` | `https://github.com/CurveYield/contract-automation/issues/48` | Internal data contract only; compiler and solver are not applicable. |

## Additional official compatibility source

The Solidity `0.8.30` SMTChecker documentation is the compatibility authority for target behavior, timeout/unknown behavior, deterministic resource-limit behavior, and supported solver relationships:

`https://docs.soliditylang.org/en/v0.8.30/smtchecker.html`

## Publication decision

No immutable container digest was available or invented. Consequently:

- `publication.status` remains `unpublished` in every template;
- `publication.imageDigest` remains `null` in every template;
- `runnable` remains `false` even after metadata-only publication validation;
- `executionEnabled` remains `false` without exception;
- no floating tags, `latest` tags, version ranges, or unofficial version assumptions are accepted.

## Unresolved compatibility decisions

1. The exact immutable GHCR image composition for Solidity SMTChecker and Halmos is deferred until real image digests are supplied.
2. The eventual Halmos adapter must prove that its selected Foundry/compiler combination is compatible with Halmos `0.3.3`; this branch does not execute or install those tools.
3. Direct raw-tool output mapping is deferred to the accepted non-executing recorder/adapter interface. This branch parses only CurveYield-owned inert capture envelopes.
