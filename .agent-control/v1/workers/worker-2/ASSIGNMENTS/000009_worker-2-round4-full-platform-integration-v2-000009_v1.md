# Worker 2 Round 4 Integration Successor v1

Worker: `worker-2`
Sequence: `9`
Message ID: `worker-2-round4-full-platform-integration-v2-000009`
Issue: `#122`
Branch: `audit-round4/full-platform-integration-v2`
Starting SHA: `bbb4cac794865f84b65ee78a2fc78d391421c759`

This assignment supersedes closed sequence 8. Follow these repository records exactly:

- `.agent-control/v1/rounds/round4/ACTIVATION_RUNBOOK_v1.md`
- `.agent-control/v1/rounds/round4/PENDING_REGISTRY_v1.json`
- `.agent-control/v1/orchestrator/HANDOFF/2026-08-02-worker2-gate5-supersession-reconstruction-v1.json`
- issues #119 and #122

Accepted Stage A candidates are the exact candidate, evidence, report and manifest values recorded in Round 4 `STATE_v1.json` for Workers 0, 1, 3 and 4.

First reconstruct only the 27 exact path/blob pairs in the supersession record and verify their remote blobs. Run only the prescribed direct-Node tests and syntax checks. Do not install dependencies or compile.

Then perform exact path/blob intake in Gate 5 order. Apply shared files field by field only. Preserve the sequence-8 branch at `8bddd31232f14597afba63ffba13f3b96069610b`.

The 41 paths changed by PR #126 remain quarantined and are excluded. They block final assembled-candidate freeze until their separate security repair is accepted.

Post startup and checkpoints to issue #122. Publish an assembled candidate to issue #119 only after all gates pass. Do not expose confidential values, deploy, execute submitted projects, broadly merge branches, or merge directly to main.
