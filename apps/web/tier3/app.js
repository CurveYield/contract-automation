import { createApiClient } from './client.js';
import { assertTier3BrowserCompatibilityV1, controllerViewModelV1 } from './controller-view.js';

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((element) => [element.id, element]));

function setText(id, value) {
  elements[id].textContent = String(value ?? '—');
}

function setControllerState(message, isError = false) {
  elements['controller-state'].textContent = message;
  elements['controller-state'].dataset.state = isError ? 'error' : 'ok';
}

function setCommandState(message, isError = false) {
  elements['controller-command-state'].textContent = message;
  elements['controller-command-state'].dataset.state = isError ? 'error' : 'ok';
}

function resetControllerSummaries(message) {
  for (const id of [
    'phase-summary',
    'lane-summary',
    'instruction-proof-summary',
    'assignment-summary',
    'finding-summary',
    'remediation-summary',
    'evidence-summary',
    'finalization-summary',
  ]) setText(id, message);
}

function credentials() {
  const apiUrl = elements['api-url'].value.trim().replace(/\/$/, '');
  const apiKey = elements['api-key'].value.trim();
  if (!apiUrl || !apiKey) throw new Error('API URL and API key are required.');
  return { apiUrl, apiKey };
}

function client() {
  return createApiClient(credentials());
}

function shortSha(value) {
  return typeof value === 'string' && value.length >= 12 ? value.slice(0, 12) : String(value ?? '—');
}

function renderCompatibility(compatibility) {
  assertTier3BrowserCompatibilityV1(compatibility);
  setText('controller-release', `${compatibility.controller.repository} @ ${shortSha(compatibility.controller.compatibilityCommit)}`);
  setText('instruction-release', compatibility.controller.instructionReleaseIdentity);
}

function renderControllerView(view) {
  setControllerState(view.stateMessage);
  setText('controller-release', view.controllerRelease);
  setText('instruction-release', view.instructionRelease);
  setText('active-campaign', view.activeCampaign);
  setText('campaign-source', view.campaignSource);
  setText('phase-summary', view.phaseSummary);
  setText('lane-summary', view.laneSummary);
  setText('instruction-proof-summary', view.instructionProofSummary);
  setText('assignment-summary', view.assignmentSummary);
  setText('finding-summary', view.findingSummary);
  setText('remediation-summary', view.remediationSummary);
  setText('evidence-summary', view.evidenceSummary);
  setText('finalization-summary', view.finalizationSummary);
}

async function testConnection() {
  elements['test-connection'].disabled = true;
  elements['service-state'].textContent = 'Testing…';
  try {
    const compatibility = await client().getControllerCompatibility();
    renderCompatibility(compatibility);
    elements['service-state'].textContent = 'Tier 3 controller ready';
    setControllerState('Controller compatibility accepted. Load a project to inspect authoritative state.');
  } catch (error) {
    elements['service-state'].textContent = 'Controller unavailable';
    setControllerState(error.message, true);
  } finally {
    elements['test-connection'].disabled = false;
  }
}

async function loadController() {
  const projectSlug = elements['controller-project-slug'].value.trim();
  if (!projectSlug) {
    setControllerState('Controller project slug is required.', true);
    return;
  }
  elements['load-controller-project'].disabled = true;
  setControllerState('Loading exact controller compatibility…');
  setText('active-campaign', 'Loading…');
  setText('campaign-source', 'Loading…');
  resetControllerSummaries('Loading…');
  try {
    const api = client();
    const compatibility = await api.getControllerCompatibility();
    renderCompatibility(compatibility);
    setControllerState('Compatibility accepted. Loading authoritative project pointer…');
    const result = await api.getControllerProject(projectSlug);
    assertTier3BrowserCompatibilityV1(result);
    if (result.project?.status !== 'NO_ACTIVE_CAMPAIGN' && result.project?.status !== 'ACTIVE') {
      throw new Error('Controller returned an unsupported project state.');
    }
    renderControllerView(controllerViewModelV1(result));
    elements['service-state'].textContent = result.project.status === 'ACTIVE'
      ? 'Tier 3 campaign connected'
      : 'Controller connected';
  } catch (error) {
    setText('active-campaign', 'Unavailable');
    setText('campaign-source', 'Unavailable');
    resetControllerSummaries('Unavailable until controller state is loaded safely.');
    setControllerState(error.message, true);
    elements['service-state'].textContent = 'Controller unavailable';
  } finally {
    elements['load-controller-project'].disabled = false;
  }
}

async function queueControllerCommand(event) {
  event.preventDefault();
  const projectSlug = elements['controller-project-slug'].value.trim();
  if (!projectSlug) {
    setCommandState('Controller project slug is required before queuing a request.', true);
    return;
  }
  const raw = elements['controller-command-json'].value.trim();
  if (!raw) {
    setCommandState('Enter one structured controller command JSON object.', true);
    return;
  }

  elements['queue-controller-command'].disabled = true;
  setCommandState('Validating and routing the controller request…');
  try {
    const command = JSON.parse(raw);
    const result = await client().queueControllerCommand(projectSlug, command);
    const targetLabel = result.target === 'controller-intake' ? 'controller intake' : 'campaign mailbox';
    setCommandState(`Queued ${result.commandType} to ${targetLabel}. Reload controller state to observe authoritative acceptance.`);
  } catch (error) {
    setCommandState(error.message, true);
  } finally {
    elements['queue-controller-command'].disabled = false;
  }
}

elements['test-connection'].addEventListener('click', testConnection);
elements['load-controller-project'].addEventListener('click', loadController);
elements['controller-project-slug'].addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadController();
  }
});
elements['controller-command-form'].addEventListener('submit', queueControllerCommand);
elements['clear-controller-command'].addEventListener('click', () => {
  elements['controller-command-json'].value = '';
  setCommandState('Controller command cleared.');
});
