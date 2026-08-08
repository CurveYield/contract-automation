import { createApiClient } from './client.js';
import {
  deriveAuditProgressV1,
  normalizeHostedAuditStateV1,
} from './tier3-model-v1.js';

const byId = (id) => document.getElementById(id);
const ui = {
  apiUrl: byId('audit-api-url'),
  apiKey: byId('audit-api-key'),
  project: byId('audit-project'),
  load: byId('load-audit'),
  live: byId('audit-live-region'),
  compatibility: byId('compatibility-state'),
  campaign: byId('campaign-state'),
  preflight: byId('preflight-state'),
  gates: byId('gate-state'),
  assignments: byId('assignment-state'),
  workers: byId('worker-state'),
  proofs: byId('proof-state'),
  findings: byId('finding-state'),
  remediation: byId('remediation-state'),
  report: byId('report-state'),
  publication: byId('publication-state'),
  events: byId('event-state'),
  gateProgress: byId('gate-progress'),
  assignmentProgress: byId('assignment-progress'),
};

function clear(target) {
  while (target.firstChild) target.removeChild(target.firstChild);
}

function display(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function addPair(list, label, value) {
  const row = document.createElement('div');
  row.className = 'state-row';
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = display(value);
  row.append(term, detail);
  list.append(row);
}

function renderPairs(target, pairs) {
  clear(target);
  const list = document.createElement('dl');
  list.className = 'state-list';
  for (const [label, value] of pairs) addPair(list, label, value);
  target.append(list);
}

function empty(target, text) {
  clear(target);
  const message = document.createElement('p');
  message.className = 'empty-state';
  message.textContent = text;
  target.append(message);
}

function statusClass(status) {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'pass' || normalized === 'complete' || normalized === 'accepted' || normalized === 'ready') return 'status-good';
  if (normalized === 'fail' || normalized === 'no_go' || normalized === 'rejected' || normalized.includes('critical') || normalized.includes('high_')) return 'status-bad';
  if (normalized === 'pending' || normalized === 'leased' || normalized === 'submitted' || normalized.includes('medium') || normalized.includes('low') || normalized.includes('informational')) return 'status-warn';
  return 'status-neutral';
}

function card(title, status, pairs = []) {
  const article = document.createElement('article');
  article.className = 'audit-card';
  const heading = document.createElement('div');
  heading.className = 'audit-card-heading';
  const h3 = document.createElement('h3');
  h3.textContent = display(title);
  const badge = document.createElement('span');
  badge.className = `state-chip ${statusClass(status)}`;
  badge.textContent = display(status);
  heading.append(h3, badge);
  article.append(heading);
  const list = document.createElement('dl');
  list.className = 'state-list compact';
  for (const [label, value] of pairs) addPair(list, label, value);
  article.append(list);
  return article;
}

function renderCards(target, entries, factory, fallback) {
  clear(target);
  if (!entries.length) return empty(target, fallback);
  for (const entry of entries) target.append(factory(entry));
}

function renderCompatibility(compatibility, pointer = null) {
  renderPairs(ui.compatibility, [
    ['Controller repository', compatibility.repository],
    ['Controller ref', compatibility.mainRef],
    ['Controller commit', compatibility.controllerCommit],
    ['Skill release', compatibility.skillReleaseIdentity],
    ['Automation release', compatibility.automationRelease],
    ['Projection schema', compatibility.hostedStateSchemaVersion],
    ['Pointer schema', compatibility.activePointerSchemaVersion],
    ['Campaign branch', pointer?.controllerBranch],
  ]);
}

function renderInactive(projectPayload, compatibility) {
  renderCompatibility(compatibility, projectPayload.pointer);
  renderPairs(ui.campaign, [
    ['Status', projectPayload.pointer.status],
    ['Project', projectPayload.pointer.projectSlug],
    ['Reason', projectPayload.pointer.reason],
    ['Launch authorized', projectPayload.pointer.launchAuthorized],
    ['Scrub commit', projectPayload.pointer.scrubCommit],
  ]);
  for (const target of [ui.preflight, ui.gates, ui.assignments, ui.workers, ui.proofs, ui.findings, ui.remediation, ui.report, ui.publication, ui.events]) {
    empty(target, 'No active campaign state is published for this project.');
  }
  ui.gateProgress.textContent = '0 / 0';
  ui.assignmentProgress.textContent = '0 accepted';
}

function renderActive(state, compatibility) {
  const progress = deriveAuditProgressV1(state);
  renderCompatibility(compatibility, state.pointer);
  renderPairs(ui.campaign, [
    ['Campaign', state.campaign.campaignId],
    ['Title', state.campaign.title],
    ['Status', state.campaign.status],
    ['Completion', state.campaign.completionStatus],
    ['Security verdict', state.campaign.securityVerdict],
    ['Terminal reason', state.campaign.terminalReason],
    ['Source repository', state.campaign.source?.repository],
    ['Source commit', state.campaign.source?.commit],
    ['Source revision', state.campaign.source?.revision],
    ['Updated', state.campaign.updatedAt],
  ]);
  renderPairs(ui.preflight, [
    ['Status', state.campaign.preflight?.status],
    ...Object.entries(state.campaign.preflight?.capabilities ?? {}).map(([key, value]) => [key, value]),
  ]);

  renderCards(ui.gates, state.gates ?? [], (gate) => card(gate.title ?? gate.gateId, gate.status, [
    ['Gate', gate.gateId],
    ['Phase', gate.phaseId],
    ['Mandatory', gate.mandatory],
    ['Evidence refs', gate.evidenceRefCount],
    ['Recorded', gate.recordedAt],
  ]), 'No gate state published.');
  ui.gateProgress.textContent = `${progress.gates.concluded} / ${progress.gates.total}`;

  renderCards(ui.assignments, state.assignments ?? [], (assignment) => card(assignment.title ?? assignment.assignmentId, assignment.status, [
    ['Assignment', assignment.assignmentId],
    ['Role', assignment.roleId],
    ['Phase', assignment.instructionPhaseId],
    ['Revision', assignment.revision],
    ['Source revision', assignment.sourceRevision],
    ['Assigned worker', assignment.assignedWorkerId],
    ['Lease expires', assignment.leaseExpiresAt],
    ['Evidence classes', (assignment.requiredEvidenceClasses ?? []).join(', ')],
    ['Submission evidence', assignment.submission?.evidenceRefCount],
    ['Review', assignment.review?.decision],
  ]), 'No assignments published.');
  ui.assignmentProgress.textContent = `${progress.assignments.accepted} accepted`;

  renderCards(ui.workers, state.workers ?? [], (worker) => card(worker.roleId ?? worker.workerId, 'REGISTERED', [
    ['Worker', worker.workerId],
    ['Session', worker.session?.sessionId],
    ['Surface', worker.session?.productSurface],
    ['Model', worker.session?.model],
    ['Prior material', worker.session?.priorMaterialVisibility],
    ['Independence', worker.session?.independenceClassification],
    ['Capabilities', (worker.capabilities ?? []).join(', ')],
  ]), 'No workers registered.');

  renderCards(ui.proofs, state.instructionProofs ?? [], (proof) => card(`${proof.roleId} / ${proof.phaseId}`, 'ACCEPTED', [
    ['Actor', `${display(proof.actorType)}:${display(proof.actorId)}`],
    ['Session', proof.sessionId],
    ['Skill release', proof.skillReleaseIdentity],
    ['Instruction digest', proof.aggregateInstructionSetDigest],
    ['Acknowledged', proof.acknowledgedAt],
  ]), state.campaign.instructionPolicyRequired ? 'No accepted instruction-read proofs are published.' : 'Instruction-read proof policy is not required.');

  renderCards(ui.findings, state.findings ?? [], (finding) => card(finding.title ?? finding.findingId, finding.severity, [
    ['Finding', finding.findingId],
    ['Status', finding.status],
    ['Phase', finding.phaseId],
    ['Assignment', finding.assignmentId],
    ['Remediation', finding.remediationStatus],
  ]), 'No finding summaries published.');

  if (state.remediation) {
    renderPairs(ui.remediation, [
      ['Status', state.remediation.status],
      ['Unresolved High / Critical', state.remediation.unresolvedHighCriticalCount],
      ['Reviewed', state.remediation.reviewedAt],
    ]);
  } else empty(ui.remediation, 'No remediation summary published.');

  if (state.report) {
    renderPairs(ui.report, [
      ['Status', state.report.status],
      ['Completion', state.report.completionStatus],
      ['Security verdict', state.report.securityVerdict],
      ['Findings', state.report.findingCount],
      ['Limitations', state.report.limitationCount],
      ['Evidence index', state.report.evidenceCount],
      ['Exact release', state.report.exactReleaseCommit],
    ]);
  } else empty(ui.report, 'No report summary published.');

  renderPairs(ui.publication, [
    ['Publication', state.publication?.status],
    ['User delivery', state.userDelivery?.status],
  ]);

  renderCards(ui.events, state.events ?? [], (event) => card(event.type ?? `Event ${display(event.sequence)}`, 'RECORDED', [
    ['Sequence', event.sequence],
    ['Command', event.commandId],
    ['Actor', event.actor ? `${display(event.actor.type)}:${display(event.actor.id)}` : null],
    ['Timestamp', event.timestamp],
    ['Hash', event.hash],
    ['Previous hash', event.previousHash],
  ]), 'No event metadata published.');
}

async function loadAudit() {
  const apiUrl = ui.apiUrl.value.trim();
  const apiKey = ui.apiKey.value;
  const projectSlug = ui.project.value.trim();
  if (!apiUrl || !apiKey || !projectSlug) {
    ui.live.textContent = 'API URL, client API key, and project slug are required.';
    return;
  }
  ui.load.disabled = true;
  ui.live.textContent = 'Loading authoritative controller state…';
  try {
    const api = createApiClient({ apiUrl, apiKey });
    const compatibility = await api.getAuditCompatibility();
    const projectPayload = await api.getAuditProject(projectSlug);
    if (projectPayload.status === 'NO_ACTIVE_CAMPAIGN') {
      renderInactive(projectPayload, compatibility);
      ui.live.textContent = 'No active campaign.';
      return;
    }
    const state = normalizeHostedAuditStateV1(projectPayload, compatibility);
    renderActive(state, compatibility);
    ui.live.textContent = `Loaded ${display(state.campaign.campaignId)} · ${display(state.campaign.status)}`;
  } catch (cause) {
    ui.live.textContent = cause?.message ? `Load failed: ${cause.message}` : 'Load failed.';
  } finally {
    ui.load.disabled = false;
  }
}

ui.load.addEventListener('click', loadAudit);
ui.project.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loadAudit();
});
