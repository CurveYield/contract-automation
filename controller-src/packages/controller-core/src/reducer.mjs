import { createHash } from 'node:crypto';
import { canonicalJson } from '../../protocol/src/canonical-json.mjs';
import { appendEvent } from '../../protocol/src/event-chain.mjs';
import {
  AssignmentStatus,
  CampaignStatus,
  DEEP_ASSURANCE_GATE_CATALOG,
  DEEP_ASSURANCE_LANE_CATALOG,
  DEEP_ASSURANCE_PROCESS_ID,
  DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID,
  DEEP_ASSURANCE_REQUIRED_CAPABILITIES,
  GateStatus,
  TERMINAL_CAMPAIGN_STATUSES,
} from './constants.mjs';
import {
  CommandConflictError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from './errors.mjs';
import { evaluateOutcome } from './outcome.mjs';
import {
  addSeconds,
  assertCurrentLease,
  assertWorkerCanClaim,
  hashLeaseToken,
  isLeaseExpired,
} from './assignment-policy.mjs';

const gateCatalogById = new Map(DEEP_ASSURANCE_GATE_CATALOG.map((gate) => [gate.gateId, gate]));
const laneCatalogByRoleId = new Map(DEEP_ASSURANCE_LANE_CATALOG.map((lane) => [lane.roleId, lane]));

function assertString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ValidationError(`${name} must be a non-empty string`);
}

function assertStringArray(value, name) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new ValidationError(`${name} must be an array of non-empty strings`);
  }
  if (new Set(value).size !== value.length) throw new ValidationError(`${name} must not contain duplicates`);
}

function assertControllerActor(actor) {
  if (actor.type !== 'controller') throw new ValidationError('command requires controller actor');
}

function assertWorkerActor(actor, workerId) {
  if (actor.type !== 'worker' || actor.id !== workerId) throw new ValidationError('worker actor must match workerId');
}

function commandDigest(command) {
  return createHash('sha256').update(canonicalJson({
    type: command.type,
    actor: command.actor,
    payload: command.payload ?? {},
  })).digest('hex');
}

function cloneState(state) {
  return structuredClone(state);
}

function assertMutable(state) {
  if (TERMINAL_CAMPAIGN_STATUSES.has(state.status)) {
    throw new InvalidTransitionError(`campaign is terminal: ${state.status}`);
  }
}

function finalizeCommand(next, command, context, eventType, eventPayload = command.payload ?? {}) {
  const event = appendEvent(next.events, {
    schemaVersion: 2,
    campaignId: next.campaignId,
    commandId: command.commandId,
    type: eventType,
    actor: command.actor,
    timestamp: context.timestamp,
    payload: eventPayload,
  });
  next.events.push(event);
  next.processedCommands[command.commandId] = commandDigest(command);
  next.updatedAt = context.timestamp;
  return Object.freeze(next);
}

function requireWorker(next, workerId) {
  const worker = next.workers[workerId];
  if (!worker) throw new NotFoundError(`worker not found: ${workerId}`);
  return worker;
}

function requireAssignment(next, assignmentId) {
  const assignment = next.assignments[assignmentId];
  if (!assignment) throw new NotFoundError(`assignment not found: ${assignmentId}`);
  return assignment;
}

function validateSessionManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new ValidationError('sessionManifest is required');
  for (const field of ['productSurface', 'model', 'sessionId', 'promptHash', 'priorMaterialVisibility', 'independenceClassification']) {
    assertString(manifest[field], `sessionManifest.${field}`);
  }
  if (!/^[0-9a-f]{64}$/i.test(manifest.promptHash)) throw new ValidationError('sessionManifest.promptHash must be a SHA-256 hex digest');
}

function validateEvidenceRefs(state, assignment, evidenceRefs) {
  if (!Array.isArray(evidenceRefs)) throw new ValidationError('evidenceRefs must be an array');
  for (const evidence of evidenceRefs) {
    if (!evidence || typeof evidence !== 'object') throw new ValidationError('evidence reference must be an object');
    assertString(evidence.class, 'evidence.class');
    assertString(evidence.ref, 'evidence.ref');
    assertString(evidence.sourceCommit, 'evidence.sourceCommit');
    if (evidence.sourceCommit !== state.source.commit) throw new ValidationError(`evidence source commit must equal ${state.source.commit}`);
  }
  const classes = new Set(evidenceRefs.map((evidence) => evidence.class));
  for (const requiredClass of assignment.requiredEvidenceClasses) {
    if (!classes.has(requiredClass)) throw new ValidationError(`submission is missing required evidence class ${requiredClass}`);
  }
}

function validatePreflight(preflight) {
  if (!preflight || typeof preflight !== 'object' || Array.isArray(preflight)) {
    throw new ValidationError('preflight is required');
  }
  if (preflight.status !== 'READY') throw new ValidationError('Deep Assurance v6 preflight must be READY before campaign creation');
  const capabilities = preflight.capabilities;
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    throw new ValidationError('preflight.capabilities must be an object');
  }
  const missing = DEEP_ASSURANCE_REQUIRED_CAPABILITIES.filter((capability) => capabilities[capability] !== true);
  if (missing.length > 0) throw new ValidationError(`Deep Assurance v6 preflight is missing required capabilities: ${missing.join(', ')}`);
  return {
    status: 'READY',
    capabilities: Object.fromEntries(DEEP_ASSURANCE_REQUIRED_CAPABILITIES.map((capability) => [capability, true])),
  };
}

export function createCampaign(input) {
  for (const field of ['processId', 'campaignId', 'title', 'commandId', 'timestamp']) assertString(input[field], field);
  if (input.processId !== DEEP_ASSURANCE_PROCESS_ID) {
    throw new ValidationError(`processId must equal ${DEEP_ASSURANCE_PROCESS_ID}`);
  }
  assertString(input.actor?.type, 'actor.type');
  assertString(input.actor?.id, 'actor.id');
  assertString(input.source?.repository, 'source.repository');
  assertString(input.source?.commit, 'source.commit');
  if (!/^[0-9a-f]{40}$/.test(input.source.commit)) throw new ValidationError('source.commit must be a lowercase full 40-character git SHA');
  const preflight = validatePreflight(input.preflight);

  const createCommand = {
    commandId: input.commandId,
    type: 'campaign.create',
    actor: input.actor,
    payload: { processId: input.processId, title: input.title, source: input.source, preflight },
  };
  const event = appendEvent([], {
    schemaVersion: 2,
    campaignId: input.campaignId,
    commandId: input.commandId,
    type: 'campaign.created',
    actor: input.actor,
    timestamp: input.timestamp,
    payload: createCommand.payload,
  });
  return Object.freeze({
    schemaVersion: 2,
    processId: DEEP_ASSURANCE_PROCESS_ID,
    campaignId: input.campaignId,
    title: input.title,
    source: structuredClone(input.source),
    sourceRevision: 1,
    sourceHistory: [{
      revision: 1,
      source: structuredClone(input.source),
      reason: 'initial campaign source',
      recordedAt: input.timestamp,
    }],
    preflight,
    status: CampaignStatus.DRAFT,
    completionStatus: null,
    securityVerdict: null,
    terminalReason: null,
    gates: {},
    workers: {},
    assignments: {},
    topology: {
      gateIds: DEEP_ASSURANCE_GATE_CATALOG.map((gate) => gate.gateId),
      laneRoleIds: DEEP_ASSURANCE_LANE_CATALOG.map((lane) => lane.roleId),
    },
    provisionalOutcome: null,
    publication: { status: 'PENDING', record: null },
    userDelivery: { status: 'PENDING', record: null },
    events: [event],
    processedCommands: { [input.commandId]: commandDigest(createCommand) },
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  });
}

export function applyCommand(state, command, context) {
  if (!state || typeof state !== 'object') throw new ValidationError('state is required');
  for (const field of ['commandId', 'type']) assertString(command[field], field);
  assertString(command.actor?.type, 'actor.type');
  assertString(command.actor?.id, 'actor.id');
  assertString(context?.timestamp, 'context.timestamp');

  const digest = commandDigest(command);
  const existingDigest = state.processedCommands?.[command.commandId];
  if (existingDigest) {
    if (existingDigest !== digest) throw new CommandConflictError(`commandId ${command.commandId} was replayed with different content`);
    return state;
  }

  assertMutable(state);
  const next = cloneState(state);

  switch (command.type) {
    case 'campaign.activate': {
      assertControllerActor(command.actor);
      if (state.status !== CampaignStatus.DRAFT) throw new InvalidTransitionError(`cannot activate campaign from ${state.status}`);
      next.status = CampaignStatus.ACTIVE;
      return finalizeCommand(next, command, context, 'campaign.activated');
    }

    case 'gate.define': {
      assertControllerActor(command.actor);
      const { gateId, phaseId, title, mandatory } = command.payload ?? {};
      for (const [value, name] of [[gateId, 'gateId'], [phaseId, 'phaseId'], [title, 'title']]) assertString(value, name);
      if (mandatory !== true) throw new ValidationError('Deep Assurance v6 gates must be mandatory');
      const expectedGate = gateCatalogById.get(gateId);
      if (!expectedGate) throw new ValidationError(`gate is outside the Deep Assurance v6 topology: ${gateId}`);
      if (phaseId !== expectedGate.phaseId) {
        throw new ValidationError(`gate ${gateId} must use phaseId ${expectedGate.phaseId}`);
      }
      if (next.gates[gateId]) throw new InvalidTransitionError(`gate already exists: ${gateId}`);
      next.gates[gateId] = { gateId, phaseId, title, mandatory: true, status: GateStatus.PENDING, evidenceRefs: [], recordedAt: null };
      return finalizeCommand(next, command, context, 'gate.defined');
    }

    case 'gate.record': {
      assertControllerActor(command.actor);
      const { gateId, status, evidenceRefs } = command.payload ?? {};
      assertString(gateId, 'gateId');
      if (!Object.values(GateStatus).includes(status)) throw new ValidationError(`unsupported gate status: ${status}`);
      const gate = next.gates[gateId];
      if (!gate) throw new NotFoundError(`gate not found: ${gateId}`);
      if (!Array.isArray(evidenceRefs)) throw new ValidationError('evidenceRefs must be an array');
      if (status !== GateStatus.PENDING && evidenceRefs.length === 0) throw new ValidationError(`${status} requires at least one evidence reference`);
      if (
        gateId === DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID
        && status !== GateStatus.PENDING
        && next.publication.status !== 'PUBLISHED'
      ) {
        throw new InvalidTransitionError(`${DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID} requires publication to be recorded first`);
      }
      gate.status = status;
      gate.evidenceRefs = [...evidenceRefs];
      gate.recordedAt = context.timestamp;
      return finalizeCommand(next, command, context, 'gate.recorded');
    }

    case 'worker.register': {
      const { workerId, roleId, capabilities, sessionManifest } = command.payload ?? {};
      assertWorkerActor(command.actor, workerId);
      assertString(workerId, 'workerId');
      assertString(roleId, 'roleId');
      assertStringArray(capabilities, 'capabilities');
      validateSessionManifest(sessionManifest);
      if (next.workers[workerId]) throw new InvalidTransitionError(`worker already exists: ${workerId}`);
      next.workers[workerId] = {
        workerId,
        roleId,
        capabilities: [...capabilities],
        sessionManifest: structuredClone(sessionManifest),
        registeredAt: context.timestamp,
      };
      return finalizeCommand(next, command, context, 'worker.registered');
    }

    case 'assignment.publish': {
      assertControllerActor(command.actor);
      if (state.status !== CampaignStatus.ACTIVE) throw new InvalidTransitionError('assignments may be published only for ACTIVE campaigns');
      const payload = command.payload ?? {};
      for (const field of ['assignmentId', 'roleId', 'title', 'promptVersion', 'leaseToken']) assertString(payload[field], field);
      if (payload.mandatory !== true) throw new ValidationError('Deep Assurance v6 assignments must be mandatory');
      if (typeof payload.cleanRoom !== 'boolean') throw new ValidationError('cleanRoom must be boolean');
      if (typeof payload.controllerOwned !== 'boolean') throw new ValidationError('controllerOwned must be boolean');
      assertStringArray(payload.requiredCapabilities, 'requiredCapabilities');
      assertStringArray(payload.requiredEvidenceClasses, 'requiredEvidenceClasses');
      assertStringArray(payload.permittedPriorMaterial, 'permittedPriorMaterial');
      if (!payload.reviewPolicy || typeof payload.reviewPolicy.separateReviewer !== 'boolean') throw new ValidationError('reviewPolicy.separateReviewer must be boolean');
      if (next.assignments[payload.assignmentId]) throw new InvalidTransitionError(`assignment already exists: ${payload.assignmentId}`);
      const expectedLane = laneCatalogByRoleId.get(payload.roleId);
      if (!expectedLane) throw new ValidationError(`role is outside the Deep Assurance v6 topology: ${payload.roleId}`);
      if (Object.values(next.assignments).some((assignment) => assignment.roleId === payload.roleId)) {
        throw new InvalidTransitionError(`role already has an assignment: ${payload.roleId}`);
      }
      if (payload.cleanRoom !== expectedLane.cleanRoom || payload.controllerOwned !== expectedLane.controllerOwned) {
        throw new ValidationError(`assignment policy does not match the catalog for ${payload.roleId}`);
      }
      const leaseTokenHash = hashLeaseToken(payload.leaseToken);
      addSeconds(context.timestamp, payload.leaseDurationSeconds);
      next.assignments[payload.assignmentId] = {
        assignmentId: payload.assignmentId,
        roleId: payload.roleId,
        title: payload.title,
        mandatory: true,
        requiredCapabilities: [...payload.requiredCapabilities],
        requiredEvidenceClasses: [...payload.requiredEvidenceClasses],
        promptVersion: payload.promptVersion,
        cleanRoom: payload.cleanRoom,
        controllerOwned: payload.controllerOwned,
        permittedPriorMaterial: [...payload.permittedPriorMaterial],
        leaseTokenHash,
        leaseDurationSeconds: payload.leaseDurationSeconds,
        reviewPolicy: structuredClone(payload.reviewPolicy),
        revision: 1,
        sourceRevision: next.sourceRevision,
        reviewHistory: [],
        invalidationHistory: [],
        status: AssignmentStatus.READY,
        assignedWorkerId: null,
        leaseStartedAt: null,
        leaseExpiresAt: null,
        submission: null,
        review: null,
        publishedAt: context.timestamp,
      };
      const { leaseToken: _redacted, ...safePayload } = payload;
      return finalizeCommand(next, command, context, 'assignment.published', { ...safePayload, leaseTokenHash });
    }

    case 'assignment.claim': {
      const { assignmentId, workerId, leaseToken } = command.payload ?? {};
      assertWorkerActor(command.actor, workerId);
      const assignment = requireAssignment(next, assignmentId);
      if (assignment.controllerOwned) throw new InvalidTransitionError('controller-owned assignments cannot be claimed by workers');
      const worker = requireWorker(next, workerId);
      assertWorkerCanClaim(assignment, worker, leaseToken);
      assignment.status = AssignmentStatus.LEASED;
      assignment.assignedWorkerId = workerId;
      assignment.leaseStartedAt = context.timestamp;
      assignment.leaseExpiresAt = addSeconds(context.timestamp, assignment.leaseDurationSeconds);
      return finalizeCommand(next, command, context, 'assignment.claimed', { assignmentId, workerId, leaseExpiresAt: assignment.leaseExpiresAt });
    }

    case 'assignment.expire': {
      assertControllerActor(command.actor);
      const { assignmentId } = command.payload ?? {};
      const assignment = requireAssignment(next, assignmentId);
      if (assignment.status !== AssignmentStatus.LEASED) throw new InvalidTransitionError(`assignment is ${assignment.status}, not LEASED`);
      if (!isLeaseExpired(assignment, context.timestamp)) throw new InvalidTransitionError('assignment lease has not expired');
      assignment.status = AssignmentStatus.READY;
      assignment.assignedWorkerId = null;
      assignment.leaseStartedAt = null;
      assignment.leaseExpiresAt = null;
      return finalizeCommand(next, command, context, 'assignment.expired');
    }

    case 'assignment.submit': {
      const { assignmentId, workerId, leaseToken, summary, evidenceRefs } = command.payload ?? {};
      assertWorkerActor(command.actor, workerId);
      assertString(summary, 'summary');
      const assignment = requireAssignment(next, assignmentId);
      requireWorker(next, workerId);
      assertCurrentLease(assignment, workerId, leaseToken, context.timestamp);
      validateEvidenceRefs(next, assignment, evidenceRefs);
      assignment.status = AssignmentStatus.SUBMITTED;
      assignment.submission = {
        workerId,
        summary,
        evidenceRefs: structuredClone(evidenceRefs),
        sessionManifest: structuredClone(next.workers[workerId].sessionManifest),
        submittedAt: context.timestamp,
      };
      const { leaseToken: _redacted, ...safePayload } = command.payload;
      return finalizeCommand(next, command, context, 'assignment.submitted', safePayload);
    }

    case 'assignment.controller_submit': {
      assertControllerActor(command.actor);
      const { assignmentId, summary, evidenceRefs } = command.payload ?? {};
      assertString(summary, 'summary');
      const assignment = requireAssignment(next, assignmentId);
      if (!assignment.controllerOwned) throw new InvalidTransitionError('assignment is not controller-owned');
      if (assignment.status !== AssignmentStatus.READY) {
        throw new InvalidTransitionError(`assignment is ${assignment.status}, not READY`);
      }
      validateEvidenceRefs(next, assignment, evidenceRefs);
      assignment.status = AssignmentStatus.SUBMITTED;
      assignment.submission = {
        controllerId: command.actor.id,
        summary,
        evidenceRefs: structuredClone(evidenceRefs),
        sourceRevision: next.sourceRevision,
        submittedAt: context.timestamp,
      };
      return finalizeCommand(next, command, context, 'assignment.controller_submitted');
    }

    case 'review.accept': {
      const { assignmentId, reviewerWorkerId } = command.payload ?? {};
      assertWorkerActor(command.actor, reviewerWorkerId);
      const assignment = requireAssignment(next, assignmentId);
      requireWorker(next, reviewerWorkerId);
      if (assignment.status !== AssignmentStatus.SUBMITTED) throw new InvalidTransitionError(`assignment is ${assignment.status}, not SUBMITTED`);
      if (assignment.reviewPolicy.separateReviewer && assignment.assignedWorkerId === reviewerWorkerId) {
        throw new ValidationError('assignment requires a separate reviewer');
      }
      assignment.status = AssignmentStatus.ACCEPTED;
      assignment.review = { reviewerWorkerId, decision: 'ACCEPT', reason: null, revision: assignment.revision, reviewedAt: context.timestamp };
      assignment.reviewHistory.push(structuredClone(assignment.review));
      return finalizeCommand(next, command, context, 'review.accepted');
    }

    case 'review.reject': {
      const { assignmentId, reviewerWorkerId, reason } = command.payload ?? {};
      assertWorkerActor(command.actor, reviewerWorkerId);
      assertString(reason, 'reason');
      const assignment = requireAssignment(next, assignmentId);
      requireWorker(next, reviewerWorkerId);
      if (assignment.status !== AssignmentStatus.SUBMITTED) throw new InvalidTransitionError(`assignment is ${assignment.status}, not SUBMITTED`);
      if (assignment.reviewPolicy.separateReviewer && assignment.assignedWorkerId === reviewerWorkerId) {
        throw new ValidationError('assignment requires a separate reviewer');
      }
      assignment.status = AssignmentStatus.REJECTED;
      assignment.review = { reviewerWorkerId, decision: 'REJECT', reason, revision: assignment.revision, reviewedAt: context.timestamp };
      assignment.reviewHistory.push(structuredClone(assignment.review));
      return finalizeCommand(next, command, context, 'review.rejected');
    }

    case 'review.return_for_rework': {
      const { assignmentId, reviewerWorkerId, reason } = command.payload ?? {};
      assertWorkerActor(command.actor, reviewerWorkerId);
      assertString(reason, 'reason');
      const assignment = requireAssignment(next, assignmentId);
      requireWorker(next, reviewerWorkerId);
      if (assignment.status !== AssignmentStatus.SUBMITTED) {
        throw new InvalidTransitionError(`assignment is ${assignment.status}, not SUBMITTED`);
      }
      if (assignment.reviewPolicy.separateReviewer && assignment.assignedWorkerId === reviewerWorkerId) {
        throw new ValidationError('assignment requires a separate reviewer');
      }
      const review = {
        reviewerWorkerId,
        decision: 'RETURN_FOR_REWORK',
        reason,
        revision: assignment.revision,
        reviewedAt: context.timestamp,
      };
      assignment.reviewHistory.push(review);
      assignment.revision += 1;
      assignment.status = AssignmentStatus.READY;
      assignment.assignedWorkerId = null;
      assignment.leaseStartedAt = null;
      assignment.leaseExpiresAt = null;
      assignment.submission = null;
      assignment.review = null;
      return finalizeCommand(next, command, context, 'review.returned_for_rework', review);
    }

    case 'assignment.supersede': {
      assertControllerActor(command.actor);
      const { assignmentId, reason, leaseToken } = command.payload ?? {};
      assertString(reason, 'reason');
      assertString(leaseToken, 'leaseToken');
      const assignment = requireAssignment(next, assignmentId);
      if (assignment.status !== AssignmentStatus.REJECTED) {
        throw new InvalidTransitionError(`assignment is ${assignment.status}, not REJECTED`);
      }
      assignment.revision += 1;
      assignment.status = AssignmentStatus.READY;
      assignment.leaseTokenHash = hashLeaseToken(leaseToken);
      assignment.assignedWorkerId = null;
      assignment.leaseStartedAt = null;
      assignment.leaseExpiresAt = null;
      assignment.submission = null;
      assignment.review = null;
      return finalizeCommand(next, command, context, 'assignment.superseded', {
        assignmentId,
        reason,
        revision: assignment.revision,
        leaseTokenHash: assignment.leaseTokenHash,
      });
    }

    case 'campaign.revise_source': {
      assertControllerActor(command.actor);
      const { source, reason } = command.payload ?? {};
      assertString(source?.repository, 'source.repository');
      assertString(source?.commit, 'source.commit');
      assertString(reason, 'reason');
      if (source.repository !== next.source.repository) {
        throw new ValidationError('source repository cannot change within a campaign');
      }
      if (!/^[0-9a-f]{40}$/.test(source.commit)) {
        throw new ValidationError('source.commit must be a lowercase full 40-character git SHA');
      }
      if (source.commit === next.source.commit) throw new InvalidTransitionError('source revision must change the commit');
      next.sourceRevision += 1;
      next.source = structuredClone(source);
      next.sourceHistory.push({
        revision: next.sourceRevision,
        source: structuredClone(source),
        reason,
        recordedAt: context.timestamp,
      });
      for (const gate of Object.values(next.gates)) {
        gate.status = GateStatus.PENDING;
        gate.evidenceRefs = [];
        gate.recordedAt = null;
      }
      for (const assignment of Object.values(next.assignments)) {
        assignment.invalidationHistory.push({
          invalidatedRevision: assignment.revision,
          priorSourceRevision: assignment.sourceRevision,
          reason: 'campaign source revised',
          invalidatedAt: context.timestamp,
        });
        assignment.revision += 1;
        assignment.sourceRevision = next.sourceRevision;
        assignment.status = AssignmentStatus.READY;
        assignment.assignedWorkerId = null;
        assignment.leaseStartedAt = null;
        assignment.leaseExpiresAt = null;
        assignment.submission = null;
        assignment.review = null;
      }
      next.provisionalOutcome = null;
      next.publication = { status: 'PENDING', record: null };
      next.userDelivery = { status: 'PENDING', record: null };
      return finalizeCommand(next, command, context, 'campaign.source_revised', {
        source,
        sourceRevision: next.sourceRevision,
        reason,
      });
    }

    case 'publication.record': {
      assertControllerActor(command.actor);
      if (next.publication.status !== 'PENDING') throw new InvalidTransitionError('publication is already recorded');
      const payload = command.payload ?? {};
      for (const field of [
        'snapshotRef',
        'markdownRef',
        'pdfRef',
        'archiveRef',
        'artifactDigestReceiptRef',
        'publicationManifestRef',
        'publicationManifestFetchbackReceiptRef',
      ]) assertString(payload[field], field);
      const workOutcome = evaluateOutcome(next, { terminal: false, publicationReadiness: true });
      if (!workOutcome.ready) throw new InvalidTransitionError(`publication is premature: ${workOutcome.reason}`);
      next.provisionalOutcome = structuredClone(workOutcome);
      next.publication = {
        status: 'PUBLISHED',
        record: { ...structuredClone(payload), recordedAt: context.timestamp, sourceRevision: next.sourceRevision },
      };
      return finalizeCommand(next, command, context, 'publication.recorded');
    }

    case 'user_delivery.record': {
      assertControllerActor(command.actor);
      if (next.publication.status !== 'PUBLISHED') throw new InvalidTransitionError('publication must be recorded before user delivery');
      const releaseAndReportGate = next.gates[DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID];
      if (!releaseAndReportGate || releaseAndReportGate.status === GateStatus.PENDING) {
        throw new InvalidTransitionError(`${DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID} must be terminal before user delivery`);
      }
      if (next.userDelivery.status !== 'PENDING') throw new InvalidTransitionError('user delivery is already recorded');
      const { summaryRef, artifactLinks, receiptRef } = command.payload ?? {};
      assertString(summaryRef, 'summaryRef');
      assertStringArray(artifactLinks, 'artifactLinks');
      assertString(receiptRef, 'receiptRef');
      if (artifactLinks.length === 0) throw new ValidationError('artifactLinks must contain the delivered artifacts');
      next.userDelivery = {
        status: 'DELIVERED',
        record: { summaryRef, artifactLinks: [...artifactLinks], receiptRef, deliveredAt: context.timestamp },
      };
      return finalizeCommand(next, command, context, 'user_delivery.recorded');
    }

    case 'campaign.evaluate': {
      assertControllerActor(command.actor);
      if (state.status !== CampaignStatus.ACTIVE) throw new InvalidTransitionError(`cannot evaluate campaign from ${state.status}`);
      const terminal = command.payload?.terminal === true;
      const result = evaluateOutcome(next, { terminal });
      if (terminal && !result.ready) throw new InvalidTransitionError(result.reason);
      if (!terminal && result.ready) next.provisionalOutcome = structuredClone(result);
      if (terminal && result.ready) {
        next.status = CampaignStatus.COMPLETE;
        next.completionStatus = result.completionStatus;
        next.securityVerdict = result.securityVerdict;
        next.terminalReason = result.reason;
      }
      return finalizeCommand(next, command, context, 'campaign.evaluated', { terminal, ...result });
    }

    default:
      throw new ValidationError(`unsupported command type: ${command.type}`);
  }
}
