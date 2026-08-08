import { controllerDetailModelV2 } from './controller-detail-model-v2.mjs';

const CONTROLLER_COMMIT = '48b031f06c7d7ed3573b42e371e123299722b451';
const CONTROLLER_RELEASE = 'audit-controller@48b031f06c7d7ed3573b42e371e123299722b451';
const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.14.0';
const AUTOMATION_COMMIT = 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8';
const AUTOMATION_RELEASE = 'contract-automation@ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8';

function shortSha(value) {
  return typeof value === 'string' && value.length >= 12 ? value.slice(0, 12) : String(value ?? '—');
}
function countBy(values, key) {
  const counts = new Map();
  for (const value of values ?? []) {
    const name = value?.[key] ?? 'UNKNOWN';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}
function countText(counts, order = []) {
  const keys = [...order.filter((key) => counts.has(key)), ...[...counts.keys()].filter((key) => !order.includes(key)).sort()];
  return keys.map((key) => `${counts.get(key)} ${key}`).join(' · ');
}

export function assertTier3BrowserCompatibilityV2(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Controller compatibility response is missing.');
  if (value.adapterVersion !== 'tier3-controller-adapter-v2') throw new TypeError('This browser release is incompatible with the controller adapter.');
  if (value.controller?.repository !== 'CurveYield/audit-controller'
      || value.controller?.compatibilityCommit !== CONTROLLER_COMMIT
      || value.controller?.releaseIdentity !== CONTROLLER_RELEASE
      || value.controller?.processId !== 'deep-assurance-v6'
      || value.controller?.instructionReleaseIdentity !== SKILL_RELEASE) {
    throw new TypeError('Controller release identity is incompatible with this browser release.');
  }
  if (value.automation?.repository !== 'CurveYield/contract-automation'
      || value.automation?.compatibilityCommit !== AUTOMATION_COMMIT
      || value.automation?.releaseIdentity !== AUTOMATION_RELEASE) {
    throw new TypeError('Contract-automation release identity is incompatible with this browser release.');
  }
  const chains = value.networkScope?.chains;
  if (!Array.isArray(chains) || chains.length !== 2 || chains[0] !== 'ethereum' || chains[1] !== 'base' || value.networkScope?.defaultChain !== 'base') {
    throw new TypeError('Controller network scope does not match the accepted Ethereum/Base release.');
  }
  return value;
}

function noActiveView(value) {
  const message = 'Not applicable — no active campaign is authorized.';
  return {
    stateMessage: `No active campaign for ${value.project.projectSlug}: ${value.project.reason}.`,
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
    commandAvailable: value.project?.commandRouting?.available === true,
    commandReason: value.project?.commandRouting?.reason ?? 'CAMPAIGN_CREATE_ONLY',
  };
}

function activeView(value) {
  const projection = value.campaign;
  if (!projection || projection.schemaVersion !== 'controller-operator-state-v2') {
    throw new TypeError('Active controller pointer has no compatible current operator projection.');
  }
  if (projection.compatibility?.controllerCommit !== value.controller.compatibilityCommit
      || projection.compatibility?.controllerRelease !== value.controller.releaseIdentity
      || projection.compatibility?.skillReleaseIdentity !== value.controller.instructionReleaseIdentity
      || projection.compatibility?.automationRelease !== value.automation.releaseIdentity) {
    throw new TypeError('Controller projection release binding is incompatible.');
  }
  const campaign = projection.campaign;
  if (campaign?.campaignId !== value.project?.campaignId || campaign?.processId !== 'deep-assurance-v6') {
    throw new TypeError('Controller projection campaign binding is incompatible.');
  }
  const gates = Array.isArray(projection.gates) ? projection.gates : [];
  const assignments = Array.isArray(projection.assignments) ? projection.assignments : [];
  const proofs = Array.isArray(projection.instructionProofs) ? projection.instructionProofs : [];
  const findings = Array.isArray(projection.findings) ? projection.findings : [];
  const control = projection.controlPlane ?? {};
  const gateCounts = countBy(gates, 'status');
  const assignmentCounts = countBy(assignments, 'status');
  const findingCounts = countBy(findings, 'severity');
  const launchText = campaign.launchAuthorized ? 'launch authorized' : 'launch fenced';
  const phaseSummary = `${gates.length} gates · ${countText(gateCounts, ['PENDING', 'PASS', 'FAIL']) || 'no statuses'} · ${launchText}`;
  const laneCount = projection.topology?.laneRoleIds?.length ?? 0;
  const workerCount = projection.workers?.length ?? 0;
  const laneSummary = `${laneCount} required lanes · ${workerCount} registered ${workerCount === 1 ? 'worker' : 'workers'} · substantive work ${control.substantiveWorkAuthorized ? 'authorized' : 'fenced'}`;
  const instructionProofSummary = `${proofs.length} accepted proof ${proofs.length === 1 ? 'record' : 'records'} · ${campaign.instructionPolicyRequired ? 'fresh instruction proofs required' : 'instruction proof policy not required'}`;
  const assignmentSummary = assignments.length === 0 ? 'No assignments projected yet.' : countText(assignmentCounts, ['BOOTSTRAP_FENCED', 'READY', 'LEASED', 'SUBMITTED', 'ACCEPTED', 'REJECTED']);
  const unresolved = findings.filter((finding) => finding?.status === 'UNRESOLVED').length;
  const findingSummary = findings.length === 0 ? 'No projected findings.' : `${countText(findingCounts, ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])} · ${unresolved} unresolved`;
  const remediationSummary = projection.remediation
    ? `${projection.remediation.status ?? 'UNKNOWN'} · ${projection.remediation.unresolvedHighCriticalCount ?? 'unknown'} unresolved High/Critical`
    : 'No remediation summary projected yet.';
  const boundedEvidence = gates.reduce((total, gate) => total + (gate.evidenceRefCount ?? 0), 0)
    + assignments.reduce((total, assignment) => total + (assignment.submission?.evidenceRefCount ?? 0), 0);
  const evidenceSummary = `${boundedEvidence} bounded evidence references · ${projection.events?.length ?? 0} event-chain records · failover ${control.failoverStatus ?? 'unknown'} · authority ${control.authorityState ?? 'unknown'}`;
  const completion = campaign.completionStatus ?? 'not complete';
  const verdict = campaign.securityVerdict ?? 'not final';
  const reportStatus = projection.report?.status ?? 'not ready';
  const finalizationSummary = `Completion: ${completion} · Security verdict: ${verdict} · Report: ${reportStatus} · Publication: ${projection.publication?.status ?? 'unknown'} · Delivery: ${projection.userDelivery?.status ?? 'unknown'}`;
  const phaseLabel = Number.isSafeInteger(campaign.phaseSequence) ? `Phase ${campaign.phaseSequence}` : 'Current phase';
  const fenced = !campaign.launchAuthorized || control.substantiveWorkAuthorized !== true;
  return {
    stateMessage: `${phaseLabel} campaign ${campaign.status} · ${fenced ? 'bootstrap fenced' : 'work authorized'} · failover ${control.failoverStatus ?? 'unknown'} · updated ${campaign.updatedAt ?? 'unknown'}.`,
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
    commandAvailable: value.project?.commandRouting?.available === true,
    commandReason: value.project?.commandRouting?.reason ?? 'UNAVAILABLE',
  };
}

function renderDetailList(id, rows, formatter) {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(id);
  if (!target) return;
  while (target.firstChild) target.removeChild(target.firstChild);
  if (rows.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No records projected.';
    target.append(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement('li');
    item.textContent = formatter(row);
    target.append(item);
  }
}

export function renderControllerDetailsV2(projection) {
  if (typeof document === 'undefined') return;
  const details = controllerDetailModelV2(projection);
  renderDetailList('controller-gate-detail', details.gates, (row) => `${row.phaseId} · ${row.status} · evidence ${row.evidenceCount}`);
  renderDetailList('controller-assignment-detail', details.assignments, (row) => `${row.roleId} · ${row.status} · worker ${row.assignedWorkerId}`);
  renderDetailList('controller-proof-detail', details.instructionProofs, (row) => `${row.roleId}/${row.phaseId} · ${row.skillReleaseIdentity} · ${row.digest}`);
  renderDetailList('controller-event-detail', details.events, (row) => `${row.type} · ${row.commandId} · ${row.hash}`);
}

export function controllerViewModelV2(value) {
  assertTier3BrowserCompatibilityV2(value);
  if (value.project?.status === 'NO_ACTIVE_CAMPAIGN' && value.campaign === null) {
    renderControllerDetailsV2(null);
    return noActiveView(value);
  }
  if (value.project?.status === 'ACTIVE') {
    const view = activeView(value);
    renderControllerDetailsV2(value.campaign);
    return view;
  }
  throw new TypeError('Controller returned an unsupported project state.');
}
