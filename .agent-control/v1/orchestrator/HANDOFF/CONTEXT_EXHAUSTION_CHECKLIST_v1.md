# Orchestrator Context-Exhaustion Checklist v1

Use this before the current orchestrator chat loses enough context to make safe continuation uncertain.

## Mandatory durable writes

1. Create a new timestamped state snapshot in this `HANDOFF/` directory. Never overwrite a historical timestamped snapshot.
2. Record the exact candidate branch, base SHA, head SHA, PR number, draft/merge authorization state and every known discrepancy.
3. Record every naturally triggered CI run ID and the exact last observed step/conclusion. Never describe an in-progress or partially observed run as accepted.
4. Record each failed exact head, the first reproducible failure and the minimal repair commit that followed.
5. Record all unresolved gates, stale PR text, unreviewed paths, missing manifests and separate workstreams that must not be touched.
6. Record mailbox/worker continuity only from live GitHub records. Never edit worker-owned ACK or STATUS files.
7. Record whether any workflow was manually dispatched or rerun. The current Round 4 static-candidate task forbids manual dispatch/rerun.
8. Record all prohibitions: no merge, deployment, live simulation, secret changes, signing, transactions, broad merges, Lite or AWS work.
9. Update `READ_FIRST_v1.md` and `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` to point to the newest timestamped snapshot.
10. Post continuity evidence to issue #63 only when authorized and supported by exact live GitHub state.

## Consistency checks

Before declaring the handoff complete:

- the newest timestamped snapshot exists and parses;
- `READ_FIRST_v1.md` identifies it as the current snapshot;
- the replacement prompt names the current primary PR/branch/head and says to refresh them before acting;
- every claimed test result identifies the exact candidate head and workflow run;
- in-progress, skipped and unobserved steps are explicitly distinguished from successful steps;
- no integration decision relies only on branch movement or a stale PR body;
- no worker has two active assignments;
- worker-owned status files were not edited by the orchestrator;
- separate simulation/security branches remain isolated;
- the control-plane branch has not been merged into `main`;
- no merge authorization is implied by a green CI run.

## Replacement readiness test

A replacement must be able to answer from GitHub alone:

1. What exact PR and SHA is the primary Round 4 candidate?
2. Which exact CI steps have passed, failed, remained in progress or were never observed?
3. Which exact repair commits followed each failed candidate head?
4. Which acceptance gates and independent reviews remain?
5. Which PRs/branches are separate workstreams and forbidden to touch?
6. What operations remain prohibited?
7. What is the first safe next action after refreshing live state?

If any answer depends only on chat memory, the handoff is incomplete.

## Emergency handoff

When the user orders an immediate stop or context is nearly exhausted:

1. stop polling, dispatching, editing and integration work immediately;
2. create one timestamped snapshot containing raw known state and explicit uncertainty;
3. update the read-first file and replacement prompt;
4. do not claim final CI acceptance unless the final conclusions were already observed;
5. provide James the replacement prompt and exact handoff paths.

Partial truthful state is safer than a convincing but unsupported reconstruction.
