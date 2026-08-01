# Replacement Orchestrator — Start Here v1

This directory is the durable handoff package for the CurveYield contract-automation orchestrator. It is designed to recover orchestration safely when the current chat reaches its context limit or is replaced.

## Authoritative location

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Mailbox root: `.agent-control/v1/`
- Handoff root: `.agent-control/v1/orchestrator/HANDOFF/`

Never use implementation branches for coordination records. Never merge `agent-control-plane-v1` into `main`.

## Mandatory read order

1. `.agent-control/v1/PROTOCOL_v1.md`
2. `.agent-control/v1/GLOBAL_STATE_v1.json`
3. This file
4. `CURRENT_STATE_SNAPSHOT_v1.json`
5. `REPLACEMENT_PROMPT_v1.md`
6. `RECOVERY_CHECKLIST_v1.md`
7. `DECISION_RULES_v1.md`
8. `AUTOMATION_CADENCE_v1.md`
9. `.agent-control/v1/orchestrator/STATUS_v1.json`
10. Every Worker 0–3 `CURRENT_v1.json` and available `STATUS_v1.json`
11. Worker 4 issue #55 and branch state until it is reviewed and retired
12. The governing plans and specifications referenced by the mailbox protocol and active issues

GitHub live state overrides this snapshot when they differ. Always pin immutable SHAs before review or integration.

## Immediate recovery actions

- List active ChatGPT Scheduled Tasks and verify exactly these five are enabled:
  - `CurveYield Orchestrator Poll`
  - `CurveYield Worker 0 Poll`
  - `CurveYield Worker 1 Poll`
  - `CurveYield Worker 2 Poll`
  - `CurveYield Worker 3 Poll`
- Do not create duplicates when the titles already exist.
- Verify worker tasks run hourly at minute `30` America/Los_Angeles.
- Verify the orchestrator task runs hourly at minute `55` America/Los_Angeles.
- Check `last_run_time`; task creation is not proof that a poll has run.
- Verify Worker 1 has created its own status file. It was the only missing bootstrap record when this package was created.
- Review newly completed Worker 0 work from its pinned SHA and issue #51 report if not already processed.
- Continue normal mailbox orchestration for Workers 0–3.
- Let Worker 4 finish issue #55, review its pinned result, then retire it. Never issue Worker 4 another assignment.

## Hard restrictions

Do not install or download dependencies, compile, deploy, execute submitted projects or external audit tools, create GitHub Actions/bots/webhooks/servers/cron infrastructure, add production secrets, use AWS, modify CurveYield Lite, enable execution, or merge to `main`.

## Handoff maintenance

Before another orchestrator replacement:

1. Refresh `CURRENT_STATE_SNAPSHOT_v1.json` with exact live status and SHAs.
2. Append a replacement/handoff event under `.agent-control/v1/orchestrator/EVENTS/`.
3. Update `GLOBAL_STATE_v1.json` only when durable state changed.
4. Never rewrite assignment history, acknowledgements, or prior events.
