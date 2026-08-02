---
protocol_version: 1
assignment_kind: pending_template
worker_id: worker-4
sequence: 3
message_id: worker-4-round4-web-direct-e2e-review-v1-000003
issue_number: 124
branch: audit-round4/review-web-direct-e2e-v1
starting_sha_source: worker-4 completed Round 3 STATUS_v1.json finalSha
external_sha_source: worker-3 completed Round 3 STATUS_v1.json finalSha
master_issue: 119
production_issue: 125
---

# Worker 4 — Round 4 GitHub Direct/UI compatibility review and assembled E2E acceptance

Read issues #119 and #124 in full. Before editing, validate the instantiated assignment blob, exact Worker 4 starting SHA, Worker 3 external candidate SHA, both final reports/comment IDs, source branch heads and committed handoff manifests.

Stage A: independently review Worker 3’s public GitHub Direct status/report contracts and Workers 0/1 compatibility seams as consumed by the web/operator application. Add observed RED evidence before any repair. Publish three checkpoints and deterministic intake instructions.

Stage B: after Worker 2 publishes the assembled SHA on #119, test that exact SHA for routes/views/view models, lifecycle truth, safe rendering/redaction, client races/cancellation, accessibility, responsive hostile cases, inert E2E flows and protected simulation-addon blobs. A newer assembled SHA invalidates acceptance.

Do not perform live deployment or use production secrets. Record exact Stage A and Stage B report URLs/comment IDs in completed status and append-only completion events.
