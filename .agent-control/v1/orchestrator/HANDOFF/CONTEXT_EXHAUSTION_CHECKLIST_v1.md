# Orchestrator Context-Exhaustion Checklist v1

Use this before the current orchestrator chat loses enough context to make safe continuation uncertain.

## Mandatory durable writes

1. Refresh and write a new timestamped state snapshot in this `HANDOFF/` directory. Never overwrite an old snapshot; create a versioned or timestamped successor.
2. Record the exact `agent-control-plane-v1` head SHA.
3. Record every worker's current sequence, state, issue, branch, starting SHA, final SHA if reported, recommendation, and report reference.
4. Record which completed workers have been independently reviewed and which remain unreviewed.
5. Record every integration PR and resulting merge commit.
6. Record every unpublished next assignment under consideration, but do not place draft instructions into `CURRENT_v1.json`.
7. List the active Scheduled Tasks and their observed `last_run_time` values.
8. Record Worker 4's retirement status and confirm no future assignment exists.
9. Append an orchestrator event identifying the new handoff snapshot.
10. Post a short continuity comment to issue #63 linking the handoff path and control-plane head.

## Consistency checks

Before declaring the handoff complete:

- every nonzero `CURRENT_v1.json` points to an existing immutable assignment;
- every pointer blob SHA matches the assignment blob;
- no worker has two active assignments;
- no assignment sequence was reused;
- completed statuses contain pinned final SHAs and report references;
- no integration decision relies only on branch movement;
- global state matches append-only events;
- worker-owned status files were not edited by the orchestrator;
- the control-plane branch has not been merged into `main`.

## Replacement readiness test

A replacement must be able to answer from GitHub alone:

1. What is each worker doing?
2. Which exact SHA must be reviewed next?
3. Which phase gate blocks each integration?
4. Which worker may receive the next assignment?
5. Which paths are owned and forbidden?
6. Which Scheduled Tasks exist and have actually run?
7. What operations remain prohibited?

If any answer depends only on chat memory, the handoff is incomplete.

## Emergency handoff

When there is not enough context/time for a full update:

1. write one timestamped emergency snapshot containing raw known state and explicit uncertainty;
2. append an `orchestrator_emergency_handoff` event;
3. do not publish new assignments or integrate work after uncertainty begins;
4. tell James to start a replacement chat with `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md`.

Partial truthful state is safer than a convincing but unsupported reconstruction.
