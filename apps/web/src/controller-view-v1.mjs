import { controllerDetailModelV1 } from './controller-detail-model.js';

const CONTROLLER_COMMIT = 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd';
const CONTROLLER_RELEASE = 'audit-controller@hosted-tier3-v1';
const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';
const AUTOMATION_RELEASE = 'contract-automation@round5-tier3-v1';

function shortSha(value) {
  return typeof value === 'string' && value.length >= 12 ? value.slice(0, 12) : String(value ?? '—');
}

function countBy(values, key) {
  const counts = new Map();
  for (const value of values ?? []) {
    const name = value?.[key] ?? 'UNKNOWN';
    counts.set(name, (counts.get(name) ?? 0) + 1;
  }
  return counts;
}

function countText(counts, order = []) {
  const keys = [
    ...order.filter((key) => counts.has(key)),
    ...[...counts.keys()].filter((key) => !order.includes(key)).sort(),
  ];
  return keys.map((key) => `${counts.get(key)} ${key}`).join(' · ');
}

function createElement(tagName, text, className) {
  const element = document.createElement(tagName);
  if (typeof text === 'string') element.textContent = text;
  if (className) element.className = className;
  return element;
}

function createDetailTable(title, columns, bodyId) {
  const article = createElement('article', null, 'detail-card');
  article.append(createElement('h3', title));
  const wrap = createElement('div', null, 'table-wrap');
  const table = createElement('table', null, 'operator-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const column of columns) {
    const th = createElement('th', column);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  body.id = bodyId;
  table.append(head, body);
  wrap.append(table);
  article.append(wrap);
  return article;
}

function ensureDetailSection() {
  if (typeof document === 'undefined') return null;
  const existing = document.getElementById('controller-detail-section');
  if (existing) return existing;
  const commandForm = document.getElementById('controller-command-form');
  if (!commandForm?.parentNode) return null;

  const section = createElement('section', null, 'detail-section');
  section.id = 'controller-detail-section';
  section.setAttribute('aria-labelledby', 'controller-detail-title');
  const heading = createElement('div', null, 'section-heading');
  const headingText = document.createElement('div');
  headingText.append(createElement('p', 'Authoritative projection', 'eyebrow'));
  const h2 = createElement('h2', 'Operator Detail');
  h2.id = 'controller-detail-title';
  headingText.append(h2);
  heading.append(headingText, createElement('span', 'Bounded fields only', 'badge'));
  section.append(heading);

  const capabilityCard = createElement('article', null, 'detail-card');
  capabilityCard.append(createElement('h3', 'Capability preflight'));
  const capabilityDetail = createElement('p', 'Load a controller project to view capabilities.', 'detail-copy');
  capabilityDetail.id = 'capability-detail';
  capabilityCard.append(capabilityDetail);
  section.append(capabilityCard);

  section.append(
    createDetailTable('Phases and gates', ['Gate', 'Phase', 'Status', 'Evidence', 'Recorded'], 'gate-detail-body'),
    createDetailTable('Workers and sessions', ['Worker', 'Role', 'Session', 'Surface / model', 'Visibility', 'Capabilities'], 'worker-detail-body'),
    createDetailTable('Assignments and leases', ['Assignment', 'Role', 'Status', 'Worker', 'Lease', 'Submission evidence', 'Review'], 'assignment-detail-body'),
    createDetailTable('Instruction proofs', ['Proof actor', 'Role / phase', 'Session', 'Release', 'Digest', 'Acknowledged'], 'proof-detail-body'),
    createDetailTable('Findings', ['Finding', 'Severity', 'Status', 'Phase', 'Assignment', 'Remediation'], 'finding-detail-body'),
  );

  const terminalGrid = createElement('div', null, 'controller-grid');
  const remediationCard = createElement('article', null, 'detail-card');
  remediationCard.append(createElement('h3', 'Remediation state'));
  const remediationDetail = createElement('p', 'Load a controller project to view remediation state.', 'detail-copy');
  remediationDetail.id = 'remediation-detail';
  remediationCard.append(remediationDetail);
  const reportCard = createElement('article', null, 'detail-card');
  reportCard.append(createElement('h3', 'Report and exact release'));
  const reportDetail = createElement('p', 'Load a controller project to view report state.', 'detail-copy');
  reportDetail.id = 'report-detail';
  reportCard.append(reportDetail);
  terminalGrid.append(remediationCard, reportCard);
  section.append(terminalGrid);

  section.append(
    createDetailTable('Event-chain provenance', ['Sequence', 'Type', 'Command', 'Actor', 'Hash chain', 'Timestamp'], 'event-detail-body'),
  );

  commandForm.parentNode.insertBefore(section, commandForm);
  return section;
}

function renderRows(bodyId, rows, columns) {
  if (typeof document === 'undefined') return;
  const body = document.getElementById(bodyId);
  if (!body) return;
  const rendered = [];
  if (rows.length === 0) {
    const row = document.createElement('tr');
    const cell = createElement('td', 'No projected records.');
    cell.colSpan = columns.length;
    cell.className = 'empty-cell';
    row.append(cell);
    rendered.push(row);
  } else {
    for (const item of rows) {
      const row = document.createElement('tr');
      for (const column of columns) {
        row.append(createElement('td', String(column(item) ?? '—')));
      }
      rendered.push(row);
    }
  }
  body.replaceChildren(...rendered);
}

export function renderControllerDetails(projection) {
  if (typeof document === 'undefined') return;
  ensureDetailSection();
  const details = controllerDetailModelV1(projection);
  const capability = document.getElementById('capability-detail');
  if (capability) {
    capability.textContent = details.capabilities.length === 0
      ? 'No capability records projected.'
      : details.capabilities.map((entry) => `${entry.id}: ${entry.ready ? 'READY' : 'NOT READY'}`).join(' · ');
  }

  renderRows('gate-detail-body', details.gates, [
    (item) => `${item.gateId}${item.mandatory ? ' · mandatory' : ''}`,
    (item) => item.phaseId,
    (item) => item.status,
    (item) => item.evidenceCount,
    (item) => item.recordedAt,
  ]);
  renderRows('worker-detail-body', details.workers, [
    (item) => item.workerId,
    (item) => item.roleId,
    (item) => item.sessionId,
    (item) => `${item.productSurface} / ${item.model}`,
    (item) => `${item.cleanRoomVisibility} · ${item.independence}`,
    (item) => item.capabilities,
  ]);
  renderRows('assignment-detail-body', details.assignments, [
    (item) => `${item.assignmentId} · r${item.revision ?? '—'} / source r${item.sourceRevision ?? '—'}`,
    (item) => `${item.roleId}${item.cleanRoom ? ' · clean-room' : ''}`,
    (item) => item.status,
    (item) => item.assignedWorkerId,
    (item) => item.lease,
    (item) => `${item.submissionEvidenceCount} · ${item.submissionSummary}`,
    (item) => `${item.reviewDecision} · ${item.reviewerWorkerId} · ${item.reviewReason}`,
  ]);
  renderRows('proof-detail-body', details.instructionProofs, [
    (item) => item.actor,
    (item) => `${item.roleId} / ${item.phaseId}`,
    (item) => item.sessionId,
    (item) => item.skillReleaseIdentity,
    (item) => item.digest,
    (item) => item.acknowledgedAt,
  ]);
  renderRows('finding-detail-body', details.findings, [
    (item) => `${item.findingId} · ${item.title}`,
    (item) => item.severity,
    (item) => item.status,
    (item) => item.phaseId,
    (item) => item.assignmentId,
    (item) => item.remediationStatus,
  ]);
  renderRows('event-detail-body', details.events, [
    (item) => item.sequence,
    (item) => item.type,
    (item) => item.commandId,
    (item) => item.actor,
    (item) => `${item.previousHash} → ${item.hash}`,
    (item) => item.timestamp,
  ]);

  const remediation = document.getElementById('remediation-detail');
  if (remediation) {
    remediation.textContent = details.remediation
      ? `Status: ${details.remediation.status} · unresolved High/Critical: ${details.remediation.unresolvedHighCriticalCount ?? 'unknown'} · reviewed: ${details.remediation.reviewedAt}`
      : 'No remediation summary projected.';
  }
  const report = document.getElementById('report-detail');
  if (report) {
    report.textContent = details.report
      ? `Status: ${details.report.status} · completion: ${details.report.completionStatus} · verdict: ${details.report.securityVerdict} · findings: ${details.report.findingCount ?? 'unknown'} · limitations: ${details.report.limitationCount ?? 'unknown'} · evidence: ${details.report.evidenceCount ?? 'unknown'} · exact release: ${details.report.exactReleaseCommit}`
      : 'No final report projected yet.';
  }
}

export function assertTier3BrowserCompatibilityV1(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Controller compatibility response is missing.');
  if (value.adapterVersion !== 'tier3-controller-adapter-v1') {
    throw new TypeError('This browser release is incompatible with the controller adapter.');
  }
  if (value.controller?.repository !== 'CurveYield/audit-controller'
      || value.controller?.compatibilityCommit !== CONTROLLER_COMMIT
      || value.controller?.releaseIdentity !== CONTROLLER_RELEASE
      || value.controller?.processId !== 'deep-assurance-v6'
      || value.controller?.instructionReleaseIdentity !== SKILL_RELEASE) {
    throw new TypeError('Controller release identity is incompatible with this browser release.');
  }
  if (value.automation?.repository !== 'CurveYield/contract-automation'
      || value.automation?.releaseIdentity !== AUTOMATION_RELEASE) {
    throw new TypeError('Contract-automation release identity is incompatible with this browser release.');
  }
  const chains = value.networkScope?.chains;
  if (!Array.isArray(chains)
      || chains.length !== 2
      || chains[0] !== 'ethereum'
      || chains[1] !== 'base'
      || value.networkScope?.defaultChain !== 'base') {
    throw new TypeError('Controller network scope does not match the accepted Ethereum/Base release.');
  }
  return value;
}

function noActiveView(value) {
  const project = value.project;
  const message = 'Not applicable — no active campaign is authorized.';
  return {
    stateMessage: `No active campaign for ${project.projectSlug}: ${project.reason}.`,
    controllerRelease: `${value.controller.repository} @ ${shortSha(value.controller.compatibilityCommit)}`,
    instructionRelease: value.controller.instructionReleaseIdentity,
    activeCampaign: 'No active campaign',
    campaignSource: '—',
    phaseSummary: message,
    laneSummary: message,
    instructionProofSummary: message,
    assignmentSummary: message,
    findingSummary: message,
    remediationSummary: message,
    evidenceSummary: message,
    finalizationSummary: message,
  };
}

function activeView(value) {
  const projection = value.campaign;
  if (!projection || projection.schemaVersion !== 'hosted-operator-state-v1') {
    throw new TypeError('Active controller pointer has no compatible hosted projection.');
  }
  if (projection.compatibility?.controllerCommit !== value.controller.compatibilityCommit
      || projection.compatibility?.controllerRelease !== value.controller.releaseIdentity
      || projection.compatibility?.skillReleaseIdentity !== value.controller.instructionReleaseIdentity
      || projection.compatibility?.automationRelease !== value.automation.releaseIdentity) {
    throw new TypeError('Hosted projection release binding is incompatible.');
  }
  const campaign = projection.campaign;
  if (campaign?.campaignId !== value.project.campaignId || campaign?.processId !== 'deep-assurance-v6') {
    throw new TypeError('Hosted projection campaign binding is incompatible.');
  }

  const gateCounts = countBy(projection.gates, 'status');
  const phaseSummary = projection.gates.length === 0
    ? 'No gates projected yet.'
    : `${projection.gates.length} gates · ${countText(gateCounts, [
      'PENDING', 'PASS', 'INFORMATIONAL_ISSUE_FOUND', 'LOW_ISSUE_FOUND', 'MEDIUM_ISSUE_FOUND',
      'HIGH_ISSUE_FOUND', 'CRITICAL_ISSUE_FOUND', 'FAIL',
    ])}`;

  const laneCount = projection.topology?.laneRoleIds?.length ?? 0;
  const workerCount = projection.workers?.length ?? 0;
  const laneSummary = `${laneCount} required lanes · ${workerCount} registered ${workerCount === 1 ? 'worker' : 'workers'}`;

  const proofCount = projection.instructionProofs?.length ?? 0;
  const instructionProofSummary = `${proofCount} accepted proof ${proofCount === 1 ? 'record' : 'records'} · instruction policy ${campaign.instructionPolicyRequired ? 'required' : 'not required'}`;

  const assignmentCounts = countBy(projection.assignments, 'status');
  const assignmentSummary = projection.assignments.length === 0
    ? 'No assignments projected yet.'
    : countText(assignmentCounts, ['READY', 'LEASED', 'SUBMITTED', 'ACCEPTED', 'REJECTED']);

  const findingCounts = countBy(projection.findings, 'severity');
  const unresolvedFindings = (projection.findings ?? []).filter((finding) => finding?.status === 'UNRESOLVED').length;
  const findingSummary = projection.findings.length === 0
    ? 'No projected findings.'
    : `${countText(findingCounts, ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])} · ${unresolvedFindings} unresolved`;

  const remediationSummary = projection.remediation
    ? `${projection.remediation.status ?? 'UNKNOWN'} · ${projection.remediation.unresolvedHighCriticalCount ?? 'unknown'} unresolved High/Critical`
    : 'No remediation summary projected yet.';

  const gateEvidence = (projection.gates ?? []).reduce((total, gate) => total + (gate.evidenceRefCount ?? 0), 0);
  const assignmentEvidence = (projection.assignments ?? []).reduce(
    (total, assignment) => total + (assignment.submission?.evidenceRefCount ?? 0),
    0,
  );
  const boundedEvidence = gateEvidence + assignmentEvidence;
  const reportEvidence = projection.report?.evidenceCount;
  const evidenceSummary = reportEvidence == null
    ? `${boundedEvidence} bounded evidence references · ${projection.events?.length ?? 0} event-chain records`
    : `${boundedEvidence} bounded evidence references · ${reportEvidence} final-report evidence entries · ${projection.events?.length ?? 0} event-chain records`;

  const completion = campaign.completionStatus ?? 'not complete';
  const verdict = campaign.securityVerdict ?? 'not final';
  const reportStatus = projection.report?.status ?? 'not ready';
  const finalizationSummary = `Completion: ${completion} · Security verdict: ${verdict} · Report: ${reportStatus} · Publication: ${projection.publication?.status ?? 'unknown'} · Delivery: ${projection.userDelivery?.status ?? 'unknown'}`;

  return {
    stateMessage: `Active projection ${campaign.status} · ${value.project.controllerBranch} · updated ${campaign.updatedAt ?? 'unknown'}.`,
    controllerRelease: `${value.controller.repository} @ ${shortSha(value.controller.compatibilityCommit)}`,
    instructionRelease: value.controller.instructionReleaseIdentity,
    activeCampaign: `${campaign.campaignId} · ${campaign.status}`,
    campaignSource: `${campaign.source?.repository ?? 'unknown'} @ ${shortSha(campaign.source?.commit)} · revision ${campaign.source?.revision ?? 'unknown'}`,
    phaseSummary,
    laneSummary,
    instructionProofSummary,
    assignmentSummary,
    findingSummary,
    remediationSummary,
    evidenceSummary,
    finalizationSummary,
  };
}

export function controllerViewModelV1(value) {
  assertTier3BrowserCompatibilityV1(value);
  if (value.project?.status === 'NO_ACTIVE_CAMPAIGN' && value.campaign === null) {
    renderControllerDetails(null);
    return noActiveView(value);
  }
  if (value.project?.status === 'ACTIVE') {
    const view = activeView(value);
    renderControllerDetails(value.campaign);
    return view;
  }
  throw new TypeError('Controller returned an unsupported project state.');
}
