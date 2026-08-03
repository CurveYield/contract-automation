# Orchestrator Context-Exhaustion Checklist v1

Use this before the current orchestrator chat loses enough context to make safe continuation uncertain.

## Mandatory durable writes

1. Create a new timestamped state snapshot in this `HANDOFF/` directory. Never overwrite a historical timestamped snapshot.
2. Update or create an accepted-work ledger identifying work that must not be lost, overlooked, or repeated.
3. Record the exact release branch, current source SHA, deployed SHA, source PR, workflow run, job ID, and every observed job-step conclusion.
4. Record every natural RED and GREEN CI run used for a new gate, including the exact head and demonstrated failure/repair.
5. Record failed or superseded live runs separately and explicitly mark whether rerun is forbidden.
6. Distinguish accepted historical evidence from evidence that is superseded only because the deployed source changed.
7. Record all unresolved gates, remaining issue #125 stages, external account-owner actions, and separate workstreams that must not be touched.
8. Record the active network scope and every deferred network that current authorization forbids testing.
9. Record whether any secret value, RPC URL, authorization header, wallet key, signing method, or public transaction was exposed or used.
10. Update `READ_FIRST_v1.md`, `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md`, `GLOBAL_STATE_v1.json`, and `orchestrator/STATUS_v1.json` to point to the newest timestamped snapshot and accepted-work ledger.
11. Create a timestamped orchestrator event for the transition.
12. Post a sanitized continuity checkpoint to issues #63 and #125 when supported by exact live GitHub evidence.

## Anti-duplication requirements

Before declaring the handoff complete, confirm the replacement is explicitly told:

- not to rerun failed or historical workflow runs;
- not to recreate accepted PRs;
- not to repeat accepted RED/GREEN sequences merely to reconstruct context;
- not to recompute historical digests from the current mutable tree;
- not to repeat credential diagnostics unless credential state changed;
- not to redeploy merely to prove a recorded successful deployment happened;
- to use a fresh exact-parent one-time request for every genuinely new live gate;
- to preserve issue comments, receipts, PR descriptions, and immutable manifests as historical evidence.

## Consistency checks

Before declaring the handoff complete:

- the newest timestamped snapshot exists and parses;
- the accepted-work ledger exists and lists current deployed source, successful deployment run/job, accepted PRs, RED/GREEN evidence, and failed runs that must not be rerun;
- `READ_FIRST_v1.md` identifies the newest snapshot and ledger;
- the replacement prompt names the current release branch/SHA, deployment run/job, and exact first safe next action;
- `GLOBAL_STATE_v1.json` and `orchestrator/STATUS_v1.json` match the newest snapshot;
- every claimed successful live operation identifies exact run and job IDs;
- in-progress, skipped, failed, superseded, and unobserved steps are distinguished from successful steps;
- current-source acceptance is not inferred from evidence generated for an older deployed SHA;
- no worker-owned ACK or STATUS file was edited;
- the control-plane branch was not merged into `main`;
- no secret value or sensitive provider location appears in handoff evidence;
- no scheduled automation is claimed when the account owner declined it.

## Replacement readiness test

A replacement must be able to answer from GitHub alone:

1. What exact source is currently deployed?
2. Which exact deployment run and job succeeded, and which steps passed?
3. Which PRs and RED/GREEN sequences are already accepted and must not be repeated?
4. Which historical smoke evidence is valid but superseded for the current source?
5. Which failed runs must never be rerun?
6. Which networks are active and which are deferred?
7. What remains under issue #125?
8. What is the first safe next action after refreshing live state?
9. Which operations still require explicit account-owner action or authorization?

If any answer depends only on chat memory, the handoff is incomplete.

## Emergency handoff

When the user orders an immediate stop or context is nearly exhausted:

1. stop new development, live dispatch, deployment, and destructive operations;
2. finish only the minimum durable GitHub writes needed for an honest handoff;
3. create a timestamped snapshot and accepted-work ledger or append a new timestamped ledger;
4. update all current pointers;
5. record explicit uncertainty rather than guessing;
6. do not claim a workflow or deployment succeeded unless the final job conclusion and required steps were observed;
7. provide James the replacement prompt and exact handoff paths.

Partial truthful state is safer than a convincing but unsupported reconstruction.
