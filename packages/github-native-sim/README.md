# GitHub-Native Simulation Package

This package provides a second transport for CurveYield contract compilation and live-fork simulation. It reads a committed GitHub job directory and writes a GitHub Actions artifact. It does not replace or modify the Cloudflare-backed PreflightSim service.

## Boundaries

The package imports the existing trusted compiler, Ganache engine, workflow executor, report renderer, OpenZeppelin materializer, chain map, and workflow validator. It does not modify those modules and does not communicate with the PreflightSim API.

Submitted projects are inert Solidity source data. The package does not run project scripts, install project dependencies, read project package configuration, accept private keys, accept user RPC URLs, sign live transactions, or broadcast to a live chain.

## CLI

```bash
node packages/github-native-sim/src/cli.mjs \
  --job github-native-sim/jobs/example/job.json \
  --output /tmp/github-native-sim-example
```

The CLI accepts only `--job` and `--output`.

## Job directory

```text
github-native-sim/jobs/example/
├── job.json
└── project/
    └── Contract.sol
```

`projectPath` is resolved relative to the directory containing `job.json` and cannot escape that directory.

## Outputs

```text
output/
├── result.json
├── report.html
├── compiler-input.json
├── compiler-output.json
├── compiler-diagnostics.json
└── artifacts/
    ├── index.json
    └── 0000-<source>-<contract>.json
```

A failed simulation writes `result.json` and `report.html` before returning a nonzero exit whenever the output directory is writable.

## Tests

```bash
node --test packages/github-native-sim/test/*.test.mjs
```
