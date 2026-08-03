# Replacement Orchestrator — Read First v1

GitHub is the durable source of truth. Do not rely on chat history, Project files, uploaded archives, hidden memory, or a local checkout.

## Identity and authority

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Trusted release branch: `orchestrator/round4-ci-base-v1`
- Continuity issue: #63
- Round 4 master issue: #119
- Round 5 production acceptance: #125
- Timezone: `America/Los_Angeles`
- Operating mode: sole orchestrator
- Active networks: Ethereum and Base only
- Deferred and prohibited networks: Arbitrum, Fraxtal, Katana, Optimism, Polygon
- Dependency downloads: prohibited

Do not activate worker runtimes or edit worker-owned ACK/STATUS files.

## Mandatory startup order

1. Read `.agent-control/v1/PROTOCOL_v2.md` in full.
2. Read `.agent-control/v1/GLOBAL_STATE_v1.json`.
3. Read `CURRENT_STATE_SNAPSHOT_2026-08-03T0900-0700_v3.json` in this folder.
4. Read `ACCEPTED_WORK_LEDGER_2026-08-03T0900-0700_v3.md` in this folder.
5. Preserve and consult the prior v2 and v1 ledgers for historical evidence.
6. Read `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` and `CONTEXT_EXHAUSTION_CHECKLIST_v1.md`.
7. Read `.agent-control/v1/orchestrator/STATUS_v1.json` and the newest orchestrator events.
8. Refresh issue #125, PR #159, release branch `orchestrator/round4-ci-base-v1`, and every current trusted workflow result.
9. Verify all live references before acting.

Older timestamped snapshots and prompts are historical. Protocol v2, the newest timestamped snapshot, additive ledgers, and refreshed live GitHub state win on conflict.

## Current trusted state

- Trusted release branch head: `11036211d5448e0bd32bb4c4fdd85bf638caa53d`
- Current release-head source: PR #159
- PR #159 verified head: `918631333aed3d6f8ffe4b8896168be8e6d64e05`
- PR #159 exact parent: `70719851d8e18faf89e65027858b9f4f728d979d`
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Accepted application source PR: #150
- Last verified API Worker deployment: run `30808377849`, job `91668946456`, success
- Production Pages custom-domain current-source acceptance: **not yet accepted**
- Current-source production smoke acceptance: **not accepted**

Do not describe release head `11036211...` as an accepted deployed application until the exact v9 trusted push run and custom-domain binding are inspected and accepted.

## PR #159 accepted code evidence

PR #159 added a dependency-free Cloudflare Pages API production gate.

Final exact-head verification:

- GitHub-Native run: `30829673867`
- GitHub-Native job: `91740180002`
- Live Fork run: `30829674142`
- Live Fork job: `91740180902`
- every recorded step: success
- changed files: exactly six intended v9 files
- comments: none
- reviews: none
- review threads: none
- exact-head merge guard: satisfied
- merge SHA: `11036211d5448e0bd32bb4c4fdd85bf638caa53d`
- release branch compare against merge SHA: identical

The v9 live workflow is designed to:

- download no dependency and invoke no package manager or Wrangler;
- byte-bind `apps/web/public` to application source `2c6e543...`;
- self-test dependency-free BLAKE3 against official empty, `abc`, 1023-byte, 1024-byte, and 1025-byte vectors;
- require all expected Pages assets already exist and fail closed without upload if any are missing;
- create a direct Pages API deployment without a branch form field;
- require production environment, exact release branch, exact application commit, terminal success, and production-domain alias binding;
- verify the custom domain serves only Ethereum and Base, with Base as sole default and authenticated chain synchronization present;
- perform no repository compilation, Worker deployment, secret mutation, R2 mutation, API job/upload submission, RPC call, wallet action, signing, or transaction broadcast.

## Current live-gate state

The trusted v9 push gate is **pending observation**.

At the durable checkpoint:

- no `Production Pages API deployment v9 result` comment was present on issue #125;
- issue #125 merge checkpoint comment: `5168755699`;
- the connector commit-run lookup is pull-request-event-only and does not prove trusted push execution;
- the live gate is neither accepted nor rejected;
- no assumption may be made that it started, succeeded, failed, or is awaiting environment approval.

Required acceptance evidence:

1. exact workflow run ID;
2. exact job ID;
3. every job-step status and conclusion;
4. deployment source SHA `11036211...`;
5. accepted application source SHA `2c6e543...`;
6. exact production environment/branch/commit/custom-domain binding;
7. sanitized issue #125 result;
8. no prohibited operation.

Do not rerun any historical or failed workflow.

## Latest rejected gate

PR #157 / deployment v7 remains rejected historical evidence:

- merge SHA: `70719851d8e18faf89e65027858b9f4f728d979d`
- run: `30815965400`
- job: `91693663510`
- result: failure
- production custom domain remained stale
- runtime Wrangler dependency download remained prohibited

Never rerun v7.

Other failed runs that must never be rerun:

- `30800918581`
- `30805768611`
- `30813209037`
- `30814064657`
- `30815289252`
- `30815965400`

Production smoke run `30807373463` remains valid historical evidence for source `fbe27b824da8084970915b31f2051679abe39cfc`, but is superseded for current-source acceptance.

## Exact next action

Observe the exact trusted v9 push gate through its sanitized issue #125 result or connector-visible workflow evidence.

- Inspect exact run, job, every step, source SHA, configuration binding, artifacts, and issue comment before acceptance.
- Do not rerun.
- If accepted, create a fresh exact-parent current-source production smoke gate.
- If rejected or absent, preserve the exact trigger/result discrepancy and create a fresh versioned correction only after the cause is established.

## Remaining Round 5 scope

After current-source smoke acceptance, continue issue #125 without repeating accepted work:

- live API identity separation and negative cases;
- bounded R2 upload/publication/readback/cleanup;
- bounded GitHub bridge/Direct tests;
- trusted Ethereum/Base V27 regression;
- web/operator E2E and accessibility;
- observability, redaction, and retention;
- idempotent redeploy and rollback;
- R2 partial-publication recovery;
- GitHub duplicate-publication reconciliation;
- one explicitly authorized non-production application-key rotation;
- final production acceptance record.

## Standing restrictions

No dependency downloads, production secret values, raw RPC URLs, authorization headers, wallet keys, signing, public-chain broadcasting, deferred-network testing, broad unreviewed merges, direct `main` merge, AWS work, CurveYield Lite changes, destructive recovery against irreplaceable data, or worker-owned ACK/STATUS edits.

When live records conflict, integrate nothing, preserve the last validated exact state, record the discrepancy durably, and resolve it before proceeding.
