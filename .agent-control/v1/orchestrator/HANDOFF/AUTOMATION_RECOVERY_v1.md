# Worker Wake and Automation Recovery v1

## Current operating mode

The active Round 4 workflow uses the original five browser worker chats plus durable GitHub mailboxes. Scheduled Tasks are disabled/not required because earlier tasks opened separate task conversations instead of resuming the original agents.

All five workers are active, including Worker 4. Do not apply the historical Worker 4 retirement rule.

## Manual wake procedure

When a worker appears idle:

1. Verify its `CURRENT_v1.json`, assignment path/blob and branch exist.
2. Verify its worker-owned status has not already acknowledged/started the sequence.
3. Verify the activation notice exists on the assigned issue.
4. Ask the user only to wake/open that original worker chat if necessary; do not ask the user to paste the full assignment because GitHub already contains it.
5. The worker must re-fetch its mailbox, acknowledge exactly once and resume from GitHub state.

## Current active sequences

- Worker 0: sequence 6, issue #120.
- Worker 1: sequence 5, issue #121.
- Worker 2: sequence 8, issue #122.
- Worker 3: sequence 8, issue #123.
- Worker 4: sequence 3, issue #124.

## Scheduled Tasks

Do not create Scheduled Tasks by default. If the user later explicitly requests automation, first verify that tasks can resume the original chats rather than opening separate conversations. Never claim background polling unless an actual supported automation is created and its runs are verifiable.

If tasks are ever reintroduced:

- hourly is the maximum supported frequency;
- use one task per active chat only when continuation semantics are proven;
- prevent duplicates;
- inspect actual run evidence, not task existence;
- disable automation immediately if it creates disconnected task conversations.

## Failure handling

- Missing or invalid current pointer: preserve prior valid state and record an orchestrator blocker.
- Missing worker status: the worker owns status creation/repair; the orchestrator must not fabricate it.
- Assignment published but not acknowledged: verify pointer/blob/issue, then manually wake the original chat.
- Worker status stale while issue/branch advances: do not infer completion; require worker-owned completed status and report.
- Worker chat unavailable: do not transfer overlapping paths until a higher-sequence cancellation/supersession safely closes the old assignment.

## Replacement warning

Automation is account-level and not represented by GitHub files. The current durable state assumes manual original-chat wakes. A replacement orchestrator must not recreate old task titles based solely on historical handoff text.
