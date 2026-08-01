# GitHub-Native Simulation Suite Design

## Goal

Add a second, fully GitHub-native live-fork simulation path to `CurveYield/contract-automation` while preserving the existing Cloudflare-backed PreflightSim function set byte-for-byte and behavior-for-behavior.

## Preservation boundary

The implementation is additions-only. It must not edit, rename, delete, relocate, or replace any existing file. In particular, the following existing areas remain untouched:

- `apps/**`
- `packages/api-client/**`
- `packages/protocol/**`
- `packages/runner/**`
- `.github/workflows/simulate.yml`
- `.github/workflows/deploy.yml`
- existing documentation, tests, scripts, and package metadata

The new suite may import existing runner modules through their current public module exports, but it must not change those modules or alter the existing Cloudflare transport.

## Selected architecture

A simulation job is committed atomically to an isolated branch named `github-native-sim/<job-id>`. The job lives under `github-native-sim/jobs/<job-id>/` and contains:

- `job.json`: a versioned, strictly validated simulation manifest;
- `project/`: Solidity source files treated only as inert compilation input.

A new permanent workflow, `.github/workflows/github-native-simulate.yml`, runs only when a job branch receives changes under `github-native-sim/jobs/**`. It checks out the branch, validates that the triggering commit changes only one job directory, installs the repository's trusted dependencies, invokes the new GitHub-native CLI, and uploads the complete result as a GitHub Actions artifact.

The CLI replaces only the transport layer. It reads the committed job locally and writes results to a local output directory. It reuses the existing trusted components without modification:

- `packages/runner/src/compiler.mjs`
- `packages/runner/src/project.mjs` for exact OpenZeppelin materialization only
- `packages/runner/src/engine.mjs`
- `packages/runner/src/workflow.mjs`
- `packages/runner/src/report.mjs`
- `packages/protocol/src/index.mjs` for chain metadata and workflow validation

## New components

### `packages/github-native-sim/src/schema.mjs`

Defines and validates the `github-native-sim/v1` manifest. It rejects unknown fields, private keys, mnemonics, RPC URLs, raw or signed transactions, shell commands, scripts, broadcast instructions, unsafe project paths, unsupported chains, invalid compiler versions, invalid optimizer settings, and invalid workflow actions.

### `packages/github-native-sim/src/project.mjs`

Resolves the manifest's project directory relative to the job directory and guarantees that it cannot escape that directory. No submitted script, package configuration, or executable file is run.

### `packages/github-native-sim/src/run-job-file.mjs`

Coordinates local job execution. It:

1. reads and validates `job.json`;
2. resolves and scans the committed Solidity project;
3. optionally downloads the exact requested OpenZeppelin release using the existing trusted helper;
4. compiles using the existing compiler module;
5. for simulation mode, selects the allowlisted RPC secret for the requested chain;
6. starts the existing Ganache fork engine;
7. executes the existing structured workflow;
8. writes success or failure artifacts before returning.

### `packages/github-native-sim/src/cli.mjs`

Provides a narrow command-line entrypoint:

```text
node packages/github-native-sim/src/cli.mjs --job <job.json> --output <directory>
```

It performs no shell execution and accepts no RPC URL or private key argument.

### Result artifact

Every run uploads a directory containing:

- `result.json`
- `report.html`
- `compiler-input.json` when compilation begins
- `compiler-output.json` when compilation succeeds
- `compiler-diagnostics.json`
- `artifacts/index.json`
- one normalized JSON artifact per compiled contract

Failure results are uploaded with the same structure whenever possible.

## Manifest

The manifest uses these fields:

```json
{
  "version": "github-native-sim/v1",
  "id": "example-job",
  "mode": "simulate",
  "projectPath": "project",
  "compilerVersion": "0.8.30",
  "openZeppelinVersion": "5.4.0",
  "chain": "ethereum",
  "block": "latest",
  "timeoutMinutes": 10,
  "optimizer": { "enabled": true, "runs": 200 },
  "viaIR": false,
  "workflow": { "steps": [] }
}
```

`mode` may be `compile` or `simulate`. `chain` is required for simulation and must map to an existing allowlisted `RPC_*` environment variable. `projectPath` is resolved only inside the job directory.

## Workflow security

The GitHub workflow has `contents: read` permissions and does not persist checkout credentials. It never exposes RPC secret values to job files. It rejects commits that change files outside one `github-native-sim/jobs/<job-id>/` directory. Project sources are inert data: the workflow does not run project scripts, install project dependencies, load project configuration, sign transactions, or broadcast to a live chain.

The only manually configured secrets required for simulation are the allowlisted chain RPC secrets already used by the original runner:

- `RPC_ETHEREUM`
- `RPC_BASE`
- `RPC_KATANA`
- `RPC_FRAXTAL`
- `RPC_ARBITRUM`
- `RPC_POLYGON`
- `RPC_OPTIMISM`

No Cloudflare, R2, PreflightSim API, runner API, GPT API, bridge API, or personal-access-token secret is required by this suite.

## Trigger and retrieval flow

1. A ChatGPT agent creates `github-native-sim/<job-id>` from `main`.
2. The agent creates one atomic commit containing the complete job directory.
3. The permanent workflow starts automatically from the push.
4. GitHub Actions executes the simulation and uploads the result artifact.
5. The agent reads the run status and downloads the artifact through the GitHub app.
6. The agent returns the report to the user and may close or delete the temporary branch when requested.

A manual `workflow_dispatch` entrypoint is also provided for repository operators who already have a committed job and want to select its path through the GitHub UI.

## Error handling

Validation failures, compiler failures, missing RPC secrets, fork startup errors, workflow-step failures, and report-write failures produce deterministic nonzero exits. The runner writes a normalized failure `result.json` and `report.html` before exiting whenever the output directory is writable. Workflow artifacts are uploaded with `if: always()`.

## Testing

The suite uses Node's built-in test runner. Tests cover:

- valid compile and simulation manifests;
- unknown and forbidden fields;
- unsafe project paths;
- unsupported chains and invalid versions;
- project-directory containment;
- compile-mode artifact generation using the repository's pinned local compiler;
- failure artifact generation when a required RPC secret is absent;
- CLI argument validation.

A dedicated additive CI workflow runs only the GitHub-native suite tests and syntax checks. Final review verifies that the PR diff contains additions only and that no pre-existing path changed.

## Success criteria

- The new compile-mode integration test passes.
- All new unit tests pass.
- New JavaScript modules pass syntax checks.
- The new GitHub-native workflow passes a real compile-only smoke job.
- The PR diff contains no modified or deleted pre-existing file.
- Existing Cloudflare-backed workflows and modules remain unchanged.
