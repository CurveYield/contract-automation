# Delegated Mailbox Write Recovery v1

## Purpose

This is a narrow exception to the normal worker-owned `ACKS/`, `STATUS_v1.json`, and `EVENTS/` write boundary. It prevents a validated assignment from deadlocking when the worker can read GitHub but every worker-side GitHub write method fails before reaching GitHub.

It does not allow the orchestrator or local wake agent to perform implementation work, invent completion, report a final SHA, or alter a worker branch.

## Required trigger

Delegated recovery is permitted only when all conditions are true:

1. The worker explicitly reports that it validated the current assignment but every supported write method failed before reaching GitHub.
2. The worker confirms no implementation began because the acknowledgement could not be created.
3. The current pointer sequence is greater than the worker's `lastConsumedSequence`.
4. The orchestrator independently verifies the pointer, immutable assignment blob SHA, message ID, worker ID, issue, branch, and starting SHA.
5. The assigned implementation branch is still exactly at the starting SHA.
6. The exact acknowledgement path does not already exist.
7. The prior worker status has not consumed the sequence.

If any condition fails, do not perform delegated recovery. Route the discrepancy to orchestrator review.

## Permitted recovery writes

After all required checks pass, the orchestrator or explicitly authorized local wake agent may perform exactly these writes in order:

1. Create the exact create-only acknowledgement for the validated sequence. Include `acceptedBy: orchestrator-delegated-recovery` or `acceptedBy: local-wake-agent-delegated-recovery` and the worker-reported failure reason.
2. Update the worker status to `working`, setting the validated sequence, message ID, issue, branch, starting SHA, and `lastConsumedSequence`.
3. Create a timestamped create-only recovery event in the worker's event directory.
4. Create a timestamped orchestrator event recording every verification and recovery write.
5. Re-enable or wake the worker only after those writes succeed.

The previous valid state must remain intact if any write fails. Never retry a create-only acknowledgement without first verifying whether it now exists.

## Prohibited recovery actions

Delegated recovery may not:

- edit an immutable assignment or pointer;
- change the implementation branch;
- perform or simulate implementation work;
- create a completion, rejection, or blocked report on the worker's behalf;
- invent a final SHA, recommendation, test result, or issue report;
- bypass a branch, issue, worker-ID, sequence, or blob mismatch;
- recover an assignment after implementation already began without acknowledgement;
- create a second acknowledgement;
- transfer path ownership;
- enable dependency installation, compilation, deployment, external execution, secrets, AWS, CurveYield Lite changes, execution capability, or a merge to `main`.

## Worker resumption

On wake, the worker must:

1. Verify the delegated acknowledgement and recovery event.
2. Verify its status is `working` for the exact active sequence.
3. Revalidate the immutable assignment and starting branch SHA.
4. Resume the assignment without creating another acknowledgement.
5. Retain ownership of implementation, issue reporting, final status, and completion events.

## Auditability

Every delegated recovery must be linked from an orchestrator event and, when useful, from the assigned GitHub issue. The normal ownership rule remains authoritative outside this narrowly defined exception.
