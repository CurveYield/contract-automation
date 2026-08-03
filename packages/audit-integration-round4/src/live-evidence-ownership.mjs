export const ROUND4_LIVE_OWNERSHIP_SOURCE = Object.freeze({
  "schemaVersion": "round4-live-path-ownership-v1",
  "domains": [
    {
      "domain": "api",
      "candidateIds": ["api-auth-reviewed"],
      "ownedPrefixes": ["apps/audit-api"],
      "ownedFiles": []
    },
    {
      "domain": "github-direct",
      "candidateIds": ["web-direct-reviewed"],
      "ownedPrefixes": ["packages/audit-github-direct", "packages/github-direct-"],
      "ownedFiles": []
    },
    {
      "domain": "phase1-6-integration",
      "candidateIds": ["phase1-6-reviewed"],
      "ownedPrefixes": ["packages/audit-release-integration"],
      "ownedFiles": []
    },
    {
      "domain": "phase7-8",
      "candidateIds": ["phase7-8-reviewed"],
      "ownedPrefixes": [
        "packages/audit-clean-room-reporting",
        "packages/audit-fork-reporting",
        "packages/audit-phase78-publication",
        "packages/audit-phase78-service"
      ],
      "ownedFiles": []
    },
    {
      "domain": "web",
      "candidateIds": ["web-direct-reviewed"],
      "ownedPrefixes": [
        "apps/audit-web",
        "packages/audit-report-view-model",
        "packages/audit-ui-contracts",
        "packages/audit-web-compat"
      ],
      "ownedFiles": []
    }
  ],
  "quarantinedPaths": [
    ".github/workflows/export-v27-hardhat-harness.yml",
    ".github/workflows/github-native-sim-ci.yml",
    ".github/workflows/github-native-simulate.yml",
    ".github/workflows/live-fork-engine-smoke.yml",
    ".github/workflows/live-fork-upgrade-ci.yml",
    ".github/workflows/simulate.yml",
    "docs/live-fork-rpc-administration.md",
    "docs/live-fork-simulation-authoring.md",
    "docs/superpowers/plans/2026-08-02-live-fork-multi-rpc-routing.md",
    "docs/superpowers/specs/2026-08-02-live-fork-multi-rpc-routing-design.md",
    "github-native-sim/jobs/live-fork-v27-v1/README.md",
    "github-native-sim/jobs/live-fork-v27-v1/patch-reviewed-v27-harness.py",
    "github-native-sim/jobs/live-fork-v27-v1/run-ci.sh",
    "github-native-sim/jobs/live-fork-v27-v1/run-v27-live-fork.mjs",
    "packages/github-native-sim/src/local-state-journal.mjs",
    "packages/github-native-sim/src/run-job-file.mjs",
    "packages/github-native-sim/src/schema.mjs",
    "packages/github-native-sim/test/local-state-journal.test.mjs",
    "packages/github-native-sim/test/run-job-file.test.mjs",
    "packages/protocol/src/index.mjs",
    "packages/protocol/src/simulation-config.mjs",
    "packages/runner/src/archive-rpc-pool.mjs",
    "packages/runner/src/fork-engine.mjs",
    "packages/runner/src/github-rpc-health-store.mjs",
    "packages/runner/src/hardhat-edr-engine.mjs",
    "packages/runner/src/live-fork-proxy.mjs",
    "packages/runner/src/live-fork-runtime.mjs",
    "packages/runner/src/live-fork-time.mjs",
    "packages/runner/src/rpc-health-ledger.mjs",
    "packages/runner/src/rpc-health-session.mjs",
    "packages/runner/src/run-job.mjs",
    "packages/runner/src/workflow.mjs",
    "packages/runner/test/archive-rpc-pool.test.mjs",
    "packages/runner/test/live-fork-config.test.mjs",
    "packages/runner/test/live-fork-proxy.test.mjs",
    "packages/runner/test/live-fork-runtime-actions.test.mjs",
    "packages/runner/test/rpc-health-ledger.test.mjs",
    "packages/runner/test/rpc-health-session.test.mjs",
    "packages/runner/test/run-job-live-fork.test.mjs",
    "scripts/live-fork-engine-smoke.mjs",
    "scripts/rpc-health-admin.mjs"
  ],
  "sharedFiles": []
});
