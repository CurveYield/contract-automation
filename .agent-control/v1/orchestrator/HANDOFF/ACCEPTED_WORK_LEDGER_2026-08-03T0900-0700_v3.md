# Accepted Work Ledger — 2026-08-03 09:00 PDT — v3

This ledger is additive. Preserve `ACCEPTED_WORK_LEDGER_2026-08-03T0601-0700_v2.md` and all earlier ledgers unchanged. GitHub live state remains authoritative.

## Current release and application binding

- Trusted release branch: `orchestrator/round4-ci-base-v1`
- Current release head: `11036211d5448e0bd32bb4c4fdd85bf638caa53d`
- Current release-head source: PR #159
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Accepted application source PR: #150
- Last verified API Worker deployment: run `30808377849`, job `91668946456`, success
- Pages current-source acceptance: **pending v9 live evidence**
- Current-source production smoke acceptance: **not accepted**

Do not describe release head `11036211...` as an accepted deployed application until the trusted v9 push run and exact custom-domain binding are inspected and accepted.

## PR #157 and deployment v7 — rejected historical evidence

- PR #157 merge SHA: `70719851d8e18faf89e65027858b9f4f728d979d`
- Live run: `30815965400`
- Job: `91693663510`
- Result: failure
- Full-history checkout removed the earlier missing-object warning but did not update the production custom domain.
- Runtime Wrangler download remained contrary to the no-dependency-download rule.
- Do not rerun.

## PR #159 — dependency-free Pages API production deployment v9

### Exact test-first evidence

Initial RED-only head:

- head: `83260a054070c8f4335799f09f26eab5a7264094`
- GitHub-Native run `30817282780`, job `91698027613`
- Live Fork run `30817280292`, job `91698020310`
- intended failure: missing `.github/workflows/deploy-v9.yml`
- all other 483 visible tests passed

BLAKE3 boundary RED head:

- head: `5daba70fb7d6b899c1825f4d136eadea9c58bfe7`
- GitHub-Native run `30829027737`, job `91737984106`
- Live Fork run `30829027706`, job `91737984709`
- intended failure: official 1023/1024/1025-byte boundary vectors not yet carried by the dependency-free manifest generator
- all other 483 visible tests passed

A later implementation attempt exposed one copied-vector transcription defect. The authoritative BLAKE3 1025-byte first 32-byte digest ends in `b8444`; the copied expectation ended in `b844`. The implementation output matched the authoritative vector. The copied expectation was corrected without changing deployment behavior.

### Final exact-head GREEN

- exact parent: `70719851d8e18faf89e65027858b9f4f728d979d`
- final verified PR head: `918631333aed3d6f8ffe4b8896168be8e6d64e05`
- GitHub-Native run: `30829673867`
- GitHub-Native job: `91740180002`
- Live Fork run: `30829674142`
- Live Fork job: `91740180902`
- every recorded step in both jobs: success
- exact changed files: six intended v9 request/workflow/design/plan/test/manifest files
- PR comments: none
- reviews: none
- inline review threads: none
- mergeability: true at promotion

### Promotion

- exact-head merge guard: satisfied
- merge SHA: `11036211d5448e0bd32bb4c4fdd85bf638caa53d`
- release branch compare against merge SHA: identical
- issue #125 merge checkpoint: comment `5168755699`

### Trusted live gate state

The v9 trusted push gate is not accepted or rejected yet.

At this checkpoint:

- no `Production Pages API deployment v9 result` comment is present on issue #125;
- connector commit-run lookup is documented as pull-request-event-only and cannot prove the push run;
- no assumption is made that the deployment started, succeeded, failed, or reached an environment approval gate.

Required acceptance evidence remains:

1. exact v9 workflow run ID;
2. exact job ID;
3. every job-step status and conclusion;
4. deployment source SHA `11036211...`;
5. accepted application source SHA `2c6e543...`;
6. exact production environment/branch/commit/custom-domain binding;
7. sanitized issue #125 result;
8. no dependency install, asset upload, Worker/R2/job/RPC/signing/broadcast operation.

Do not rerun any historical or failed workflow. If correction is required, use a fresh versioned exact-parent request.

## Failed runs that must never be rerun

- `30800918581`
- `30805768611`
- `30813209037`
- `30814064657`
- `30815289252`
- `30815965400`

## Network scope

Active only:

- Ethereum — chain ID `1` — `RPC_ETHEREUM`
- Base — chain ID `8453` — `RPC_BASE`

Deferred and prohibited:

- Arbitrum
- Fraxtal
- Katana
- Optimism
- Polygon

## Next action

Observe and inspect the exact trusted v9 push gate. If accepted, create a fresh exact-parent current-source smoke gate. If rejected or absent, record the exact trigger/result discrepancy before creating any fresh versioned correction.

## Safety checkpoint

No secret value, raw RPC URL, authorization header, wallet key, signing method, deferred-network request, or public-chain transaction was recorded or used in this checkpoint. No dependency was installed by this orchestration checkpoint. No historical or failed workflow was rerun. No worker-owned ACK or STATUS file was modified.
