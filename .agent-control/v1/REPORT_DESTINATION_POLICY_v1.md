# GitHub Mailbox Report Destination Policy v1

## Purpose

Prevent stale chat context, prior issues, copied prompts, or earlier assignments from redirecting worker reports away from the active immutable mailbox assignment.

## Sole authoritative destination

For every mailbox assignment, the `issue_number` in the worker's currently referenced immutable assignment file is the **only valid GitHub issue destination** for that assignment's startup, progress, blocker, and final reports.

The following are read-only references and are never valid report destinations unless they are also the current assignment's exact `issue_number`:

- prior assignment issues;
- predecessor or superseded issues;
- pull requests;
- continuity issues;
- issue numbers remembered from the worker chat;
- issue numbers contained in stale scheduled-task prompts or earlier copied instructions.

When any remembered or carried-over instruction conflicts with the current immutable assignment, the current assignment wins.

## Required pre-post verification

Immediately before posting any blocker or final report, a worker must:

1. Re-fetch its `CURRENT_v1.json` from `agent-control-plane-v1`.
2. Re-fetch the exact immutable assignment path and verify its blob SHA equals `CURRENT_v1.json.assignmentBlobSha`.
3. Verify the assignment's `sequence`, `message_id`, `worker_id`, repository, branch, starting SHA, and `issue_number`.
4. Post only to that exact `issue_number`.

A worker must not rely on memory, chat history, a previous issue body, or a previously loaded assignment for the destination check.

## Required post-write verification

After posting a blocker or final report, a worker must:

1. Re-fetch the exact current assignment issue.
2. Verify the newly posted comment is present.
3. Record the exact issue-comment URL and numeric comment ID in its status and create-only event.
4. Treat the write as failed if the comment cannot be re-fetched from the exact issue.

A completion status is invalid unless it contains:

- the current assignment issue number;
- the exact issue-comment URL;
- the numeric issue-comment ID;
- the pinned 40-character final SHA;
- the final recommendation.

## Orchestrator acceptance rule

The orchestrator must reject completion as non-consumable when:

- the report was posted to any issue other than the current assignment's `issue_number`;
- the status references a different issue;
- the report comment cannot be re-fetched;
- the comment URL or ID is absent or mismatched;
- the branch or final SHA does not match the current assignment.

The orchestrator may link or quote a misplaced report for evidence, but must not silently treat it as satisfying completion. The worker must repost to the correct current issue or receive an explicit superseding assignment.

## Assignment wording requirement

Every future immutable assignment must include this exact concept in its completion section:

> Post only to issue #N, the `issue_number` in this immutable assignment. Do not post to any prior issue or PR. Re-fetch this assignment immediately before posting, then re-fetch issue #N afterward and record the exact comment URL and numeric comment ID in completed status.

## Supersession

When a higher-sequence assignment supersedes an earlier assignment, the new assignment's issue becomes authoritative immediately after `CURRENT_v1.json` points to it. The earlier issue becomes read-only reference material and must receive no further worker reports unless the new assignment explicitly requires a cross-reference comment.