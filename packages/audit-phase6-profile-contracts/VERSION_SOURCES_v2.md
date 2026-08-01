# Phase 6 Official Version Sources v2

Retrieval date: **2026-08-01**.

| Component | Exact candidate | Release identifier | Official tag commit | Official primary evidence |
|---|---:|---|---|---|
| Solidity compiler / SMTChecker | `0.8.30` | `v0.8.30` | `73712a01b2de56d9ad91e3b6936f85c90cb7de36` | Solidity official GitHub release `v0.8.30`; Solidity `v0.8.30` SMTChecker documentation |
| Halmos | `0.3.3` | `v0.3.3` | `ba94bdc232c746b61f12eeacef6136eace81c7c2` | a16z Halmos official `v0.3.3` tag and repository |
| Z3 package | `4.12.6.0` | `z3-4.12.6` | `fa2c0e027894a8d55d2b841e27cbeecc99692a3f` | Z3Prover official `z3-4.12.6` release; Halmos `v0.3.3` `pyproject.toml` exact pin `z3-solver==4.12.6.0` |

## Compatibility decision

Solidity `0.8.30` remains the exact SMTChecker/compiler candidate. Halmos `0.3.3` remains the exact symbolic-tool candidate. Z3 package `4.12.6.0` remains the common solver candidate because Halmos pins it exactly and Solidity `0.8.30` satisfies the documented modern Z3 compatibility floor.

No compiler, solver, Halmos, formal engine, or image was executed. The exact combined image composition remains execution-unverified. No immutable image digest is recorded or invented.
