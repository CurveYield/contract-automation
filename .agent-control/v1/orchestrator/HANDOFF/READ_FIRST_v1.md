# Replacement Orchestrator — Read First v1

This is the durable entrypoint for a fresh orchestrator replacing the Round 4 final-integration takeover agent stopped by the user on 2026-08-02 at 21:08 America/Los_Angeles.

## Identity

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Mailbox root: `.agent-control/v1/`
- Continuity issue: #63
- Round 4 master gate: #119
- Round 5 production acceptance: #125
- Timezone: `America/Los_Angeles`

Do not rely on prior chat history, ChatGPT Project files, uploaded ZIPs, hidden memory or a local checkout. GitHub is the source of truth.

## Mandatory startup order

1. Read `.agent-control/v1/PROTOCOL_v2.md` in full.
2. Read `.agent-control/v1/GLOBAL_STATE_v1.json`.
3. Read `CURRENT_STATE_SNAPSHOT_2026-08-02T2108-0700_v1.json` in this folder.
4. Read every other file in this handoff folder, especially `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` and `CONTEXT_EXHAUSTION_CHECKLIST_v1.md`.
5. Read `.agent-control/v1/orchestrator/STATUS_v1.json` and newest orchestrator events.
6. Refresh issues #63 and #119–#125, PR #139, mailbox records and every exact branch/workflow reference in the newest snapshot.
7. Fetch the live control-plane head, PR #139 base/head and naturally triggered workflow conclusions before acting.

Older timestamped snapshots and `CURRENT_STATE_SNAPSHOT_v1.json` are historical. `PROTOCOL_v1.md` is historical migration evidence. Live validated GitHub state and protocol v2 win on conflict.

## User stop directive

The user ordered all work stopped at 21:08. The predecessor stopped candidate edits and CI polling and did not dispatch, rerun or trigger workflows. Only handoff writes were made after the stop directive.

Do not interpret the last observed in-progress CI state as final acceptance.

## Primary Round 4 candidate

- Draft PR: #139 — `Round 4 final static integration candidate`
- Base branch: `orchestrator/round4-ci-base-v1`
- Frozen base SHA: `bbb4cac794865f84b65ee78a2fc78d391421c759`
- Head branch: `orchestrator/round4-final-integration-takeover-v1`
- Last observed head SHA: `136d166fa87c50ab95b3083fa4317df85850d8ac`
- Last observed mergeability: mergeable
- Merge authorization: none

PR #139's body still names an older candidate head. Refresh the live head first and treat that stale text as an explicit discrepancy.

## Latest exact-head repairs

- `244fcb72e06940a1d5fd754a697e7747b7a8f9ec`: 459/460 tests. Phase 5 top-level deletion mutation expected `missing_field`; the exact key-set validator returns `invalid_keys`.
- `fff4dee6437ea5deefda5b99232aa1f4aa0c2938`: changed the expected code to `invalid_keys`; then 459/460 because the canonical result has 14 top-level fields but the test asserted 15.
- `136d166fa87c50ab95b3083fa4317df85850d8ac`: corrected the Phase 5 field count to 14.

## CI state at the stop

No manual workflow dispatch or rerun occurred.

- GitHub-Native Simulation CI run `30781904598`: focused tests passed; all 460 repository tests passed; complete repository syntax validation was running. Final syntax checks and workflow conclusion were not observed.
- Live Fork Upgrade CI run `30781904575`: in progress at dependency installation. Focused tests, full tests, lint/build, syntax and final conclusion were not observed.

Refresh these naturally triggered runs. Do not manually dispatch, rerun or trigger any workflow.

## Separate workstreams — frozen for this task

- PR #138 / `orchestrator/pr126-security-reconciliation-v1`, last known head `c4dd5865f3e5e1d00db96b7d4ccc716ecb41cd82`.
- PR #136 / `fix/remote-mutable-fork-simulation-v1`, last known head `38166cd938c3b2cbbde9359418f40621c538e534`.

Do not modify, merge, dispatch, rerun or execute either workstream from the Round 4 static-candidate task. Do not run live simulations.

## Immediate replacement priorities

1. Fetch the exact live control-plane head.
2. Refresh PR #139 and verify whether its head remains `136d166fa87c50ab95b3083fa4317df85850d8ac`.
3. Refresh runs `30781904598` and `30781904575` without dispatching or rerunning anything.
4. If a run failed, inspect the first failing step and apply only a minimal root-cause repair to the PR #139 head branch.
5. If both required workflows are fully green on one exact head, independently verify changed paths, protected blobs, manifests and issue #119 evidence. Green CI alone does not authorize merge.
6. Correct PR #139's stale head text only after confirming the live head.
7. Update durable handoff/evidence before context exhaustion.
8. Do not merge PR #139 or `main` without explicit authorization and completed exact-SHA acceptance.

## Standing restrictions

No manual workflow dispatch/rerun, live simulation execution, production secret values or secret changes, submitted-project execution, wallet keys/signing/transactions, deployment, broad merges, direct `main` merge, CurveYield Lite changes, AWS work or edits to worker-owned ACK/STATUS files.

## Files in this handoff package

- `READ_FIRST_v1.md` — this entrypoint.
- `CURRENT_STATE_SNAPSHOT_2026-08-02T2108-0700_v1.json` — newest stopped-state snapshot.
- older timestamped snapshots — historical predecessor snapshots.
- `CURRENT_STATE_SNAPSHOT_v1.json` — historical initial worker-phase snapshot.
- `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` — copy-ready replacement prompt.
- `CONTEXT_EXHAUSTION_CHECKLIST_v1.md` — durable handoff checklist.
- `RESTART_RUNBOOK_v1.md` — recovery workflow; protocol v2 and the newest snapshot win on conflict.
- `AUTOMATION_RECOVERY_v1.md` — historical Scheduled Task notes only.

When handoff text conflicts with refreshed live records, integrate nothing until the discrepancy is resolved and recorded durably.
