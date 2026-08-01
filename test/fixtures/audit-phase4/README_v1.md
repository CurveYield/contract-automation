# CurveYield Audit Phase 4 Inert Fixtures v1

This directory contains only CurveYield-owned synthetic JSON fixtures. The files model already-produced tool output and lifecycle metadata for the six Phase 4 parser profiles. They contain no submitted source code, executable commands, network destinations, credentials, real secrets, or machine-derived stack traces.

`normalized-snapshots-v1.json` stores the exact deterministic `tool-result-v1` output expected for every fixture. The parser tests read these bytes only; they never invoke Solidity, Foundry, Slither, Forge coverage, a process, a container, a package script, or a network.
