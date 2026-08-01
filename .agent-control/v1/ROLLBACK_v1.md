# GitHub Mailbox Orchestration Rollback v1

Rollback restores the previous manual workflow without deleting or rewriting worker state.

1. Disable the orchestrator and Worker 0–3 Scheduled Tasks.
2. Do not delete or edit `agent-control-plane-v1` mailbox records.
3. Read `GLOBAL_STATE_v1.json` and every worker `STATUS_v1.json`.
4. Pin each active or completed worker's issue, branch, starting SHA, final SHA, and recommendation.
5. Resume manual coordination through GitHub issue comments and copy/paste prompts.
6. For any pointer sequence greater than a worker's `lastConsumedSequence`, either:
   - manually deliver that exact immutable assignment; or
   - publish a new higher-sequence cancellation assignment before issuing replacement work.
7. Never reset a sequence, reuse a message ID, edit an immutable assignment, or infer completion from branch movement alone.
8. Preserve Worker-4's final issue #55 report and branch even after retirement.
9. Continue all existing phase ordering, path ownership, security restrictions, and immutable-final-SHA review rules.

Rollback changes only coordination transport. It does not revert implementation commits, merged integration PRs, issue reports, or worker evidence.