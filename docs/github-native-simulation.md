# GitHub-Native Contract Simulation

The GitHub-native suite is an additional way to compile Solidity projects and run stateful single-chain live-RPC fork simulations. It is designed for connected ChatGPT agents that can create branches, commit files, inspect GitHub Actions, and download workflow artifacts directly through the GitHub app.

The original Cloudflare-backed PreflightSim service remains independent and unchanged. Its API, UI, R2 storage, authentication keys, deployment workflow, and `simulate.yml` runner continue to work exactly as before.

## Required secrets

Compilation requires no repository secret.

Live-fork simulation requires only the RPC secret matching the selected chain:

| Manifest chain | Repository secret |
|---|---|
| `ethereum` | `RPC_ETHEREUM` |
| `base` | `RPC_BASE` |
| `katana` | `RPC_KATANA` |
| `fraxtal` | `RPC_FRAXTAL` |
| `arbitrum` | `RPC_ARBITRUM` |
| `polygon` | `RPC_POLYGON` |
| `optimism` | `RPC_OPTIMISM` |

This suite does not use any of the following:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
PREFLIGHTSIM_CLIENT_API_KEY
PREFLIGHTSIM_GPT_API_KEY
PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY
PREFLIGHTSIM_RUNNER_API_KEY
PREFLIGHTSIM_GITHUB_TOKEN
PREFLIGHTSIM_R2_ACCESS_KEY_ID
PREFLIGHTSIM_R2_SECRET_ACCESS_KEY
```

GitHub supplies the workflow's read-only `GITHUB_TOKEN` automatically.

## Agent workflow

A connected agent performs these steps:

1. Create a branch from the latest trusted base using the name `github-native-sim/<job-id>`.
2. Create one job directory at `github-native-sim/jobs/<job-id>/`.
3. Put the versioned manifest at `job.json` and all Solidity files beneath the configured `projectPath`.
4. Commit the complete job directory atomically. The triggering commit must include `job.json` and must not change anything outside that one job directory.
5. The `GitHub-Native Contract Simulation` workflow starts automatically.
6. Inspect the workflow result and download the `github-native-sim-<job-id>-<run-id>` artifact.
7. Return `report.html`, `result.json`, or a packaged report to the user.
8. Close or delete the temporary job branch when cleanup is requested.

The atomic-commit requirement is important because the workflow rejects partial or multi-job commits. GitHub's Git data API can create all source blobs, one tree, one commit, and then move the branch ref once.

## Directory layout

```text
github-native-sim/jobs/my-job/
├── job.json
└── project/
    ├── ContractA.sol
    └── libraries/
        └── Library.sol
```

The project directory is resolved relative to `job.json`. Absolute paths, empty segments, `.` segments, and `..` traversal are rejected.

## Manifest format

```json
{
  "version": "github-native-sim/v1",
  "id": "my-job",
  "mode": "simulate",
  "projectPath": "project",
  "compilerVersion": "0.8.30",
  "openZeppelinVersion": "5.4.0",
  "chain": "ethereum",
  "block": "latest",
  "timeoutMinutes": 10,
  "optimizer": {
    "enabled": true,
    "runs": 200
  },
  "evmVersion": "cancun",
  "viaIR": false,
  "workflow": {
    "steps": [
      {
        "action": "deploy",
        "alias": "counter",
        "contract": "Counter",
        "args": []
      },
      {
        "action": "call",
        "target": "$counter",
        "function": "increment()"
      },
      {
        "action": "assertCall",
        "target": "$counter",
        "function": "value() view returns (uint256)",
        "equals": "1"
      }
    ]
  }
}
```

`mode` is either `compile` or `simulate`. Compile jobs may use an empty workflow and do not require a chain or RPC secret. Simulation jobs require an allowlisted chain and at least one structured workflow step.

The supported actions are inherited unchanged from the existing protocol validator:

```text
deploy
call
staticCall
expectRevert
setBalance
transferNative
mine
increaseTime
snapshot
revertSnapshot
assertBalance
assertCall
```

## Security model

The job manifest and Solidity project are treated as data. The system rejects private keys, mnemonics, seeds, signer secrets, user-provided RPC URLs, raw transactions, signed transactions, shell commands, scripts, npm scripts, and broadcast instructions.

The workflow:

- has `contents: read` permission only;
- checks out without persisted Git credentials;
- installs only the trusted root repository dependencies with lifecycle scripts disabled;
- never executes submitted project scripts or project package configuration;
- reads fork URLs only from allowlisted repository RPC secrets;
- runs transactions only inside the local Ganache fork;
- uploads the output artifact even when simulation execution fails.

RPC values are not included in result objects. Known RPC secret values are redacted from serialized error messages.

## Result artifact

Each artifact contains:

```text
result.json
report.html
compiler-input.json
compiler-output.json
compiler-diagnostics.json
artifacts/index.json
artifacts/0000-<source>-<contract>.json
```

`result.json` records status, mode, chain, block, compiler diagnostics, normalized compiled artifacts, deployments, workflow steps, errors, and timestamps. The HTML report is rendered by the unchanged PreflightSim report renderer.

## Manual execution

Repository operators can also use the workflow's **Run workflow** control and supply a committed path matching:

```text
github-native-sim/jobs/<job-id>/job.json
```

The selected branch must contain both the new suite and the specified job directory.

## Compile-only smoke example

A secret-free example is available at:

```text
github-native-sim/examples/compile-smoke/
```

Copy that example into `github-native-sim/jobs/<new-id>/`, update the manifest `id`, and commit the complete directory on a `github-native-sim/<new-id>` branch.
