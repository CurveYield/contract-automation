# Capability Traceability v2

| Capability | Current-stack implementation | External dependency |
|---|---|---|
| Explicit operating-mode selection | `cloudflare-audit-v1` and `github-direct-audit-v1`; no replacement or automatic fallback | None |
| Immutable source/workspaces | Full R2 implementation in Cloudflare mode; GitHub Direct binds an exact repository commit without copying source into its control ledger | None |
| Dependency/lock manifests | Full schemas and sealing | Runtime materialization deferred |
| Generated layers | Full R2 implementation in Cloudflare mode; transport-neutral contracts reusable by GitHub Direct | None |
| Profile registry | Full metadata/SBOM/signature registry; GHCR images | Hostile execution deferred |
| Compile/test/fuzz/invariant | Full contracts, parsers, safe fixtures | Hardened executor |
| Static/coverage/mutation/dependency | Full contracts, parsers, safe fixtures | Hardened executor |
| Symbolic/formal | Full contracts, parsers, obligations/counterexamples | Hardened executor |
| Cloudflare jobs/status/cancel/resume | Full R2 state machine | Active cancellation requires executor |
| GitHub Direct jobs/status/cancel | Versioned repository-native ledger, exact-SHA admission, Checks/comments, workflow state, bounded artifacts | Active cancellation requires executor for real jobs |
| Cloudflare incremental logs/artifacts/evidence | Full R2 implementation | Producer requires executor for real jobs |
| GitHub Direct artifacts/reports | Immutable control manifests plus bounded GitHub Actions artifacts and reporting surfaces | Producer requires executor for real jobs |
| Service attestation | Current-stack WebCrypto service attestation | Isolated production signer deferred |
| Persistent forks | Full API, ACL, checkpoint store, mock adapter | Active durable fork compute |
| Clean-room campaigns | Full R2 ACL/index/merge implementation; transport-neutral contracts available to direct-mode clients | None |
| Cloudflare web/API/reports | Full | None |
| GitHub Direct protocol/ledger/adapter/CLI/workflow | Full control-plane implementation target with trusted fixture operation and submitted execution disabled | None for control plane |
| GitHub App identity | One dedicated App; per-run `GITHUB_TOKEN` first, short-lived installation token when required | None |
| Cross-mode isolation | Separate schemas, entry points, mutable state, credentials, indexes, reports, and no-fallback tests | None |
| Hostile-code isolation | Interface and acceptance suite only | Separate hardened compute project |
| Lite boundary | Full regression enforcement | None |

## GitHub Direct truthfulness

A deployed GitHub Direct capability record must state at minimum:

```json
{
  "mode": "github-direct-audit-v1",
  "cloudflareRequired": false,
  "cloudflareUsed": false,
  "r2Required": false,
  "githubAppRequired": true,
  "githubActionsRequired": true,
  "submittedExecutionEnabled": false,
  "hostileCodeIsolationProvided": false
}
```

The existence of a workflow, runner, tool profile, parser, report, or artifact must never be interpreted as submitted execution availability.

All capabilities identified in the original integration assessment remain represented. The table distinguishes implementation that the current software stack can complete from execution behavior that cannot safely be claimed without the separate hardened compute plane.
