# V27 Shared Live-Fork Acceptance

This contained acceptance job reuses the exact previously successful V27 Hardhat EDR lifecycle and exact V27 Solidity source hashes, but replaces its direct single-RPC transport with the production shared live-fork stack:

- `loadArchiveRpcSlots` for seven optional primary and three optional secondary endpoints;
- persistent disabled-slot filtering and session reporting;
- `startLiveForkProxy` for capability-aware archive routing and exact block pinning;
- `startForkEngine({ mode: "hardhat-edr" })` for the mutable local EDR fork;
- the routed proxy as the lifecycle's read-only upstream provider.

The reviewed lifecycle payload is fetched from immutable commit `73a0e73aa269927a7338e58b59c1cab394d7bad0`. Exact V27 sources are fetched from immutable commit `829954164fc9f3ea23665122b711cef2a0850fbf`. No Solidity source is modified.

The run is accepted only when the full data report is completed, all assertions and supplemental branches pass, migration backing is preserved, the final journal hash is present, and the shared proxy block/hash exactly match Hardhat EDR metadata.
