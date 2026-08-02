# PR #126 Independent Round 4 Reconciliation Review v1

## Verdict

- **Functional verdict:** ACCEPT
- **Security verdict:** REJECT PENDING REPAIR
- **Round 4 intake:** NOT AUTHORIZED

PR #126 was merged into `main` after the original Stage 0 quarantine was recorded.

- Final PR head: `df2e51824d257669dac204de5bf869c80ed6e844`
- Merge/main head: `500de7b8752e926f7478feafb81b92586d6364ea`
- Changed paths: `41`

## Functional evidence

The final head has three successful workflows. The exact V27 artifact ZIP digest independently matches `sha256:ec4e17b10a45af7df6b62ab77b2be82058c21d11b4c914ae928b63fe9502ebbd`.

Its internal final validation records:

- `validatedSuccess: true`
- wrapper exit code `0`
- exact EDR/proxy identity at Ethereum block `25666794`
- `124,460` RPC requests, zero failures, retries or quarantines
- `53` lifecycle calls
- `42` successful state-changing transactions
- `2` expected reverts
- `85/85` assertions
- four primary cycles, two post-migration cycles and four supplemental tests
- zero public-chain transaction broadcasts

The simulation implementation and evidence are functionally strong.

## Security blockers

### PR126-S-01 — secret-bearing pull-request execution

`github-native-sim-ci.yml` and `live-fork-engine-smoke.yml` run on `pull_request`, check out PR-controlled source, install/execute repository code, and provide live RPC secrets. The former also grants `issues: write` and supplies `github.token` to the health ledger.

Live secret-bearing jobs must be split from secretless PR validation and restricted to trusted reviewed SHAs.

### PR126-S-02 — mutable action references

All six changed workflows use mutable `@v4` action tags. Release acceptance requires full-SHA action pins.

### PR126-S-03 — forgeable health ledger and prototype pollution

The public repository stores RPC health state in issue comments. The loader accepts any marker-bearing comment without validating its author. Event slot IDs are not constrained and are inserted into a normal object; `__proto__` can mutate `Object.prototype`. Session, recovery and disable events require separate authenticated authority and strict schemas.

### PR126-S-04 — upstream error disclosure

The archive router carries raw provider/network error messages into the local proxy's JSON-RPC response. Stable classified messages must replace provider text so URLs, API-key-bearing paths and transport internals cannot leak.

## Integration disposition

Worker 2's Stage 0 quarantine is stale: it records an active draft at an old head with 20 paths. The actual merged change contains 41 paths. Worker 2 must not restore the old protected baseline or ingest the merged paths until a test-first repair is accepted and a new exact path/blob registry is published.
