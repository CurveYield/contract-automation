# Capability Traceability v2

| Capability | Current-stack implementation | External dependency |
|---|---|---|
| Immutable source/workspaces | Full R2 implementation | None |
| Dependency/lock manifests | Full schemas and sealing | Runtime materialization deferred |
| Generated layers | Full R2 implementation | None |
| Profile registry | Full metadata/SBOM/signature registry; GHCR images | Hostile execution deferred |
| Compile/test/fuzz/invariant | Full contracts, parsers, safe fixtures | Hardened executor |
| Static/coverage/mutation/dependency | Full contracts, parsers, safe fixtures | Hardened executor |
| Symbolic/formal | Full contracts, parsers, obligations/counterexamples | Hardened executor |
| Jobs/status/cancel/resume | Full R2 state machine | Active cancellation requires executor |
| Incremental logs/artifacts/evidence | Full R2 implementation | Producer requires executor for real jobs |
| Service attestation | Current-stack WebCrypto service attestation | Isolated production signer deferred |
| Persistent forks | Full API, ACL, checkpoint store, mock adapter | Active durable fork compute |
| Clean-room campaigns | Full R2 ACL/index/merge implementation | None |
| Web/reports/GitHub integration | Full | None |
| Hostile-code isolation | Interface and acceptance suite only | Separate hardened compute project |
| Lite boundary | Full regression enforcement | None |

All capabilities identified in the original integration assessment remain represented. The table distinguishes implementation that the current software stack can complete from execution behavior that cannot safely be claimed without the separate hardened compute plane.
