# Replacement Orchestrator — Read First v1

This is the durable entrypoint for the sole orchestrator completing Round 4 static/inert acceptance and preparing Round 5 production testing.

## Identity and authority

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Mailbox root: `.agent-control/v1/`
- Continuity issue: #63
- Round 4 master issue: #119
- Round 5 production acceptance: #125
- Timezone: `America/Los_Angeles`
- Operating authority: the user directed the replacement orchestrator to finish all remaining work alone until production-testing readiness or a hard external block requiring user assistance.

GitHub is the durable source of truth. Do not rely on chat history, Project files, uploaded archives, hidden memory, or a local checkout.

## Mandatory startup order

1. Read `.agent-control/v1/PROTOCOL_v2.md` in full.
2. Read `.agent-control/v1/GLOBAL_STATE_v1.json`.
3. Read `CURRENT_STATE_SNAPSHOT_2026-08-02T2258-0700_v1.json` in this folder.
4. Read every other file in this handoff folder, especially `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` and `CONTEXT_EXHAUSTION_CHECKLIST_v1.md`.
5. Read `.agent-control/v1/orchestrator/STATUS_v1.json` and the newest orchestrator events.
6. Refresh issues #63 and #119–#125, PR #139, mailbox records, and every exact branch/workflow reference in the newest snapshot.
7. Fetch the live control-plane head, PR #139 base/head, and exact workflow conclusions before acting.

Older timestamped snapshots, `CURRENT_STATE_SNAPSHOT_v1.json`, `START_HERE_v1.md`, and `PROTOCOL_v1.md` are historical. Protocol v2, the newest timestamped snapshot, and refreshed live GitHub state win on conflict.

## Round 4 exact-head static acceptance

- Draft PR: #139 — `Round 4 final static integration candidate`
- Base branch: `orchestrator/round4-ci-base-v1`
- Frozen base SHA: `bbb4cac794865f84b65ee78a2fc78d391421c759`
- Head branch: `orchestrator/round4-final-integration-takeover-v1`
- Accepted head SHA: `3da6b10f240e2abd031195f440c7cd80b72b691b`
- Merge ref: `311311768f3e0465d0583f2be0a0f7d67215fa52`
- Changed paths: `202`
- Merge authorization: none
- PR state: draft

The final-tree attestation is:

- path: `docs/audit/round4/integration/2026-08-03-round4-final-tree-attestation-v1.json`
- attested paths: `198`
- aggregate SHA-256: `22ee6ee759c027189b9e8887e584c976e378a6de917a20acb0e5275e3a1afc16`
- four self-referential acceptance-control paths are excluded from the aggregate and validated directly.

## Exact-head CI

No workflow was manually dispatched or rerun.

- GitHub-Native Simulation CI run `30788571549`: completed successfully on exact head `3da6b10f240e2abd031195f440c7cd80b72b691b`; focused tests passed; all `461/461` repository tests passed; complete repository syntax validation passed; independent GitHub-native JavaScript syntax passed.
- Live Fork Upgrade CI run `30788571507`: completed successfully on the same exact head; focused live-fork tests passed `14/14`; all `461/461` repository tests passed; lint passed; build passed; syntax validation passed for `276` JavaScript modules and changed JavaScript.

Round 4 exact-head static acceptance is established. Green CI does not authorize merge.

## Test-first final repair

- `43fb5bef8444325bfb28ad9e2823cc8a21f26708`: attestation RED; both natural workflows passed 460/461 and failed only because the final-tree attestation was absent.
- `e0913267d355d333abdd4a044f48e2a00b0adf1f`: gate-transition RED; unaffected tests passed and only the missing attestation plus stale final gate failed.
- `3da6b10f240e2abd031195f440c7cd80b72b691b`: added exact-tree evidence and resolved the stale Round 4 live gates.

Do not revert these repairs without new exact evidence.

## Sole integration ownership

Worker 2 sequence 9 integration ownership was revoked through sequence 10 as a no-work control assignment. The Worker 2 sequence-9 branch remained at the approved base. Worker-owned ACK and STATUS records were not edited. PR #139 is the sole frozen Round 4 candidate.

## Round 5 objective

Prepare the repository and durable evidence for production testing without merging, deploying, exposing production secrets, manually dispatching live workflows, signing, or broadcasting transactions. Required preparation includes:

- exact release-SHA binding;
- secret-name and binding manifests without values;
- deployment preflight and rollback contracts;
- observability and recovery evidence;
- trusted V27 live-regression acceptance contract;
- explicit authorization gates for promotion, production secrets, deployment, and live testing.

The trusted V27 live regression remains required in Round 5 and must run only after the later production-test contract and explicit authorization permit it.

## Separate workstreams — frozen

- PR #138 / `orchestrator/pr126-security-reconciliation-v1`, accepted head `c4dd5865f3e5e1d00db96b7d4ccc716ecb41cd82`.
- PR #136 / `fix/remote-mutable-fork-simulation-v1`, last known head `38166cd938c3b2cbbde9359418f40621c538e534`.

Do not modify, merge, dispatch, rerun, or execute either workstream from this task.

## Standing restrictions

No manual workflow dispatch/rerun, unauthorized live simulation, production secret values or secret changes, submitted-project execution, wallet keys/signing/transactions, deployment, broad merges, direct `main` merge, PR #139 merge without explicit authorization, CurveYield Lite changes, AWS work, or edits to worker-owned ACK/STATUS files.

## Maintenance correction

Control-plane commit `cd7da52984dbda1c6aa97aa2984e5c60f118ad62` briefly replaced this file with placeholder content during handoff maintenance. This restored version supersedes that invalid transient state. The candidate branch and worker-owned records were unaffected.

When live records conflict, integrate nothing, preserve the last validated exact state, record the discrepancy durably, and resolve it before proceeding.
