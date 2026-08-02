# Replacement Orchestrator — Read First v1

This is the durable entrypoint for a fresh orchestrator chat replacing the 2026-08-02 Round 4 activation agent.

## Identity

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Mailbox root: `.agent-control/v1/`
- Continuity issue: #63
- Round 4 master gate: #119
- Round 5 production acceptance: #125
- Timezone: `America/Los_Angeles`

Do not rely on ChatGPT Project files, uploaded ZIPs, hidden chat context, local worktrees or predecessor memory. GitHub is the source of truth.

## Mandatory startup order

1. Read `.agent-control/v1/PROTOCOL_v2.md` in full. `PROTOCOL_v1.md` is historical migration state and contains obsolete Worker 4/Scheduled Task rules.
2. Read `.agent-control/v1/GLOBAL_STATE_v1.json`.
3. Read this folder's `CURRENT_STATE_SNAPSHOT_v1.json`; refresh every live record before acting.
4. Read `.agent-control/v1/orchestrator/STATUS_v1.json` and the newest orchestrator events.
5. Read every Worker 0–4 `CURRENT_v1.json` and `STATUS_v1.json`.
6. Read issues #119–#125 and all active worker issue comments.
7. Resolve each active branch head and assignment blob independently.
8. Post one startup confirmation to issue #63 with refreshed state and discrepancies.

Scheduled Tasks are not required in the current manual-original-chat workflow. Do not create duplicate tasks or claim background polling. The user may manually wake original worker chats, which then consume GitHub mailboxes.

## Current Round 4 assignments

| Worker | Sequence | Issue | Branch | Starting SHA |
|---|---:|---:|---|---|
| Worker 0 | 6 | #120 | `audit-round4/review-integration-spine-v1` | `5914b03382422ea714346625a601b5dbda3aa0cd` |
| Worker 1 | 5 | #121 | `audit-round4/review-phase78-api-compat-v1` | `4d7513b7eabd2e2217b1e3fed43d999df828a93f` |
| Worker 2 | 8 | #122 | `audit-round4/full-platform-integration-v1` | `5914b03382422ea714346625a601b5dbda3aa0cd` |
| Worker 3 | 8 | #123 | `audit-round4/review-api-auth-security-v1` | `6d877e2d87f1a91380a6c5d1efc47550527d8729` |
| Worker 4 | 3 | #124 | `audit-round4/review-web-direct-e2e-v1` | `fdc55d684be2cd5053c1e617aa09399fdfcf60c2` |

All five branches and mailbox pointers were published. Worker 2 may perform Stage 0 preparation only until #120, #121, #123 and #124 publish Stage A accepted/repaired exact heads.

## Reconciled Round 3 inputs

- Worker 0: final documentation head `4d7513b7eabd2e2217b1e3fed43d999df828a93f`; repaired core `dc77c51eb02d6f07b6ce9d582d8629b9c9932788`; `ACCEPT WITH REPAIR`; report comment `5156777973`. Worker 1 owns the six bounded unfinished service/report/publication compatibility gaps.
- Worker 1: final head `6d877e2d87f1a91380a6c5d1efc47550527d8729`; implementation `f02840ee3fc0c59759c5034dc5c40e0c154bdab5`; `ACCEPT`; report `5154958425`.
- Worker 2: final head `5914b03382422ea714346625a601b5dbda3aa0cd`; `ACCEPT WITH DOCUMENTED REPAIR`; report `5156779012`. Its embedded Phase 7–8 source is stale/superseded and must never be imported.
- Worker 3: final documentation head `1672b31a71674dd78eddc3bf5fc2fbe39d4ae07d`; verified code/workflow candidate `46873f805199e2212af3902c8525c0f3e4501721`; `ACCEPT`; report `5156758072`.
- Worker 4: final head `fdc55d684be2cd5053c1e617aa09399fdfcf60c2`; implementation `7243b26a23985efe866e4b3ea98c5d1189aca4c4`; `ACCEPT`; report `5154997216`.

## First decision rule

Never infer completion from a branch commit. Completion requires:

- worker-owned completed status;
- exact final SHA equal to branch head;
- durable issue report comment ID/URL;
- complete path/blob/public-interface manifest;
- independent review of the exact SHA and changed paths.

A one-time orchestrator reconciliation published the Round 4 pointers and moved stale status records to the new active assignments. Future orchestrators must not write worker statuses; workers own all subsequent transitions.

## Round 4 flow

### Stage A

- Worker 0 reviews Worker 2's Phase 1–6/integration spine.
- Worker 1 reviews/repairs Worker 0's Phase 7–8 service/report compatibility.
- Worker 3 reviews Worker 1's API/auth security.
- Worker 4 reviews Worker 3 GitHub Direct plus UI/public compatibility.
- Worker 2 prepares registries/tests but cannot intake subsystem production paths yet.

Each reviewer must publish exact source/reviewed SHAs, RED evidence, minimal repairs, full path/blob manifest, verdict and deterministic Worker 2 intake instructions.

### Stage B

Worker 2 assembles exact accepted/repaired owned paths in the issue #119 order and publishes one frozen SHA. Workers 0, 1, 3 and 4 independently accept or reject that same SHA. Any new integration commit invalidates stale acceptances.

## Frozen addon

Do not repair or refactor the GitHub-native contract simulation/App/RPC addon during this handoff. It is included only from approved `main` byte-for-byte. The separate addon repair remains paused until the user explicitly resumes it.

## Standing restrictions

No secret values, submitted-project execution, wallet keys/signing/transactions, live production deployment in Round 4, unreviewed broad merges, CurveYield Lite changes, AWS or direct `main` merge before exact-SHA acceptance.

## Files in this handoff package

- `READ_FIRST_v1.md` — this entrypoint.
- `CURRENT_STATE_SNAPSHOT_v1.json` — current Round 4 snapshot.
- `RESTART_RUNBOOK_v1.md` — recovery workflow; live protocol v2 wins on conflict.
- `AUTOMATION_RECOVERY_v1.md` — historical Scheduled Task notes; current mode is manual original-chat wake.
- `CONTEXT_EXHAUSTION_CHECKLIST_v1.md` — replacement checklist.
- `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` — copy-ready prompt.

## Immediate replacement-agent priorities

1. Verify all five workers acknowledged their current sequence and are working.
2. Inspect their issue checkpoints continuously when the user wakes them.
3. Independently review every Stage A final head before allowing Worker 2 intake.
4. Keep Worker 2 at Stage 0 until all four reviewed candidates are durable.
5. Freeze one assembled SHA, collect four exact-SHA acceptances, verify evidence and only then prepare merge/Round 5.
6. Update this handoff package again before context exhaustion.

When handoff text conflicts with live validated mailbox/issue/branch records, live records win. Internal inconsistency blocks integration and overlapping assignments until resolved and recorded on issue #63.
