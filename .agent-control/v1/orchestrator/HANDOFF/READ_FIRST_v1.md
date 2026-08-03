# Replacement Orchestrator — Read First v1

GitHub is the durable source of truth. Do not rely on chat history, Project files, uploaded archives, hidden memory, or a local checkout.

## Identity and authority

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Continuity issue: #63
- Round 4 master issue: #119
- Round 5 production acceptance: #125
- Timezone: `America/Los_Angeles`
- Operating mode: sole orchestrator
- Active networks: Ethereum and Base only
- Deferred and prohibited networks: Arbitrum, Fraxtal, Katana, Optimism, Polygon

Do not activate worker runtimes or edit worker-owned ACK/STATUS files.

## Mandatory startup order

1. Read `.agent-control/v1/PROTOCOL_v2.md` in full.
2. Read `.agent-control/v1/GLOBAL_STATE_v1.json`.
3. Read `CURRENT_STATE_SNAPSHOT_2026-08-03T0442-0700_v1.json` in this folder.
4. Read `ACCEPTED_WORK_LEDGER_2026-08-03T0442-0700_v1.md` in this folder.
5. Read `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` and `CONTEXT_EXHAUSTION_CHECKLIST_v1.md`.
6. Read `.agent-control/v1/orchestrator/STATUS_v1.json` and the newest orchestrator events.
7. Refresh issue #125, PR #150, release branch `orchestrator/round4-ci-base-v1`, deployment run `30808377849`, and job `91668946456`.
8. Verify all live references before acting.

Older timestamped snapshots and earlier replacement prompts are historical. Protocol v2, the newest timestamped snapshot, the accepted-work ledger, and refreshed live GitHub state win on conflict.

## Current trusted state

- Current trusted and deployed source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Release branch: `orchestrator/round4-ci-base-v1`
- Source PR: #150 — merged
- Deployment v4 run: `30808377849`
- Deployment v4 job: `91668946456`
- Deployment v4 result: success

PR #150 repaired a real production UI defect:

- removed all deferred networks from the operator selector;
- made Base the safe default;
- synchronized the selector from authenticated `/api/v1/chains` data;
- redeployed Worker and Pages from the corrected exact source.

Every deployment v4 job step succeeded.

## Preserve completed work

The accepted-work ledger records PRs #139–#150, every important RED/GREEN run, failed diagnostic deployments, successful deployments, and smoke evidence.

Standing anti-duplication rules:

- do not rerun failed or historical workflow runs;
- do not recreate accepted PRs or repeat their RED/GREEN sequences;
- do not recompute historical digests from the current mutable tree;
- do not repeat Cloudflare token diagnostics unless credential state changed;
- do not repeat deployment v3 or v4 merely to prove they happened;
- preserve issue #125 comments and PR descriptions as durable evidence;
- every new live gate must use a fresh exact-parent one-time request.

Production smoke run `30807373463` succeeded for the previous deployed source `fbe27b824da8084970915b31f2051679abe39cfc`. It is valid historical evidence but is superseded for final current-source acceptance because PR #150 changed the deployed UI.

## Exact next action

Create a fresh test-first, exact-parent, read-only production smoke gate bound to:

`2c6e543dfcaa17ca975bbde3c15302269bbf8072`

It must verify the previous Pages/API/CORS/Ethereum/Base checks plus deployed UI evidence that:

- only Ethereum and Base are selectable;
- Base is the default;
- the client synchronizes from `/api/v1/chains`;
- no deferred network is selectable;
- no job, upload, signing, wallet, or transaction-broadcast action occurs.

Do not rerun the superseded smoke workflow.

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

No production secret values, raw RPC URLs, authorization headers, wallet keys, signing, public-chain broadcasting, deferred-network testing, broad unreviewed merges, direct `main` merge, AWS work, CurveYield Lite changes, destructive recovery against irreplaceable data, or worker-owned ACK/STATUS edits.

When live records conflict, integrate nothing, preserve the last validated exact state, record the discrepancy durably, and resolve it before proceeding.
