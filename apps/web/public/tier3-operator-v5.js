// Deep Assurance Tier 3 Operator v5
import { createApiClient } from './client.js';

const byId = (id) => document.getElementById(id);
let commandPublicationEnabled = false;

function apiClient() {
  const apiUrl = byId('api-url').value.trim().replace(/\/$/, '');
  const apiKey = byId('api-key').value.trim();
  if (!apiUrl || !apiKey) throw new Error('API URL and API key are required.');
  return createApiClient({ apiUrl, apiKey });
}

function text(id, value) {
  const element = byId(id);
  if (element) element.textContent = value ?? '—';
}

function jsonText(id, value) {
  const element = byId(id);
  if (element) element.textContent = JSON.stringify(value ?? null, null, 2);
}

function status(message, isError = false) {
  const element = byId('controller-status');
  element.textContent = message;
  element.dataset.state = isError ? 'error' : 'ok';
}

function commandStatus(message, isError = false) {
  const element = byId('controller-command-status');
  element.textContent = message;
  element.dataset.state = isError ? 'error' : 'ok';
}

function setCommandPublication(enabled) {
  commandPublicationEnabled = enabled === true;
  const button = byId('controller-submit-command');
  button.disabled = !commandPublicationEnabled;
  button.setAttribute('aria-disabled', String(!commandPublicationEnabled));
}

function resetCampaign() {
  for (const id of ['campaign-status', 'completion-status', 'security-verdict', 'controller-campaign-commit']) text(id, '—');
  for (const id of [
    'controller-phases', 'controller-lanes', 'controller-workers', 'controller-assignments',
    'controller-proofs', 'controller-findings', 'controller-remediation', 'controller-evidence',
    'controller-provenance', 'controller-report'
  ]) jsonText(id, null);
}

function renderCompatibility(value) {
  text('controller-release', value.controllerRelease);
  text('controller-protocol-sha', value.controllerProtocolSha);
  text('controller-state-ref', value.controllerStateRef);
  text('automation-release', value.automationRelease);
  text('controller-authority', value.authority);
  text('controller-freshness-mode', value.freshnessMode);
  text('controller-mutation-mode', value.mutationMode);
  text('controller-network-scope', `${value.networkScope.active.join(', ')} · default ${value.networkScope.default}`);
  setCommandPublication(value.mutationMode === 'session-capability-mailbox-v1');
  commandStatus(
    commandPublicationEnabled
      ? 'Controller mailbox publication is enabled for valid controller-issued session capabilities.'
      : 'Controller mailbox publication is disabled by current server configuration.',
    !commandPublicationEnabled
  );
}

function renderCampaignEnvelope(value) {
  const projection = value.projection;
  text('controller-campaign-commit', value.controllerCampaignCommit);
  text('campaign-status', projection.campaign.status);
  text('completion-status', projection.campaign.completionStatus ?? 'INCOMPLETE');
  text('security-verdict', projection.campaign.securityVerdict ?? 'NOT FINAL');
  jsonText('controller-phases', projection.phases);
  jsonText('controller-lanes', projection.lanes);
  jsonText('controller-workers', projection.workers);
  jsonText('controller-assignments', projection.assignments);
  jsonText('controller-proofs', projection.instructionProofs);
  jsonText('controller-findings', projection.findings);
  jsonText('controller-remediation', projection.remediation);
  jsonText('controller-evidence', projection.evidence);
  jsonText('controller-provenance', projection.provenance);
  jsonText('controller-report', projection.report);
}

byId('controller-connect').addEventListener('click', async () => {
  setCommandPublication(false);
  try {
    status('Checking immutable controller protocol compatibility, freshness policy and command capability mode…');
    const compatibility = await apiClient().getControllerCompatibility();
    renderCompatibility(compatibility);
    status('Tier 3 controller protocol is compatible. Campaign reads use path-scoped freshness verification.');
  } catch (error) {
    commandStatus('Controller command publication remains disabled.', true);
    status(`${error.code ? `${error.code}: ` : ''}${error.message}`, true);
  }
});

byId('load-campaign').addEventListener('click', async () => {
  const campaignId = byId('campaign-id').value.trim();
  resetCampaign();
  if (!campaignId) {
    status('Enter a campaign ID first.', true);
    return;
  }
  try {
    status(`Resolving authoritative campaign state for ${campaignId}…`);
    const envelope = await apiClient().getControllerCampaign(campaignId);
    renderCampaignEnvelope(envelope);
    status(`Loaded ${campaignId} at exact campaign commit ${envelope.controllerCampaignCommit}.`);
  } catch (error) {
    status(`${error.code ? `${error.code}: ` : ''}${error.message}`, true);
  }
});

byId('controller-submit-command').addEventListener('click', async () => {
  const capabilityElement = byId('controller-capability-token');
  if (!commandPublicationEnabled) {
    commandStatus('Controller command publication is disabled until compatibility explicitly enables session-capability-mailbox-v1.', true);
    capabilityElement.value = '';
    return;
  }
  const campaignId = byId('campaign-id').value.trim();
  const authorizationId = byId('controller-authorization-id').value.trim();
  const capabilityToken = capabilityElement.value;
  let command;
  try {
    if (!campaignId || !authorizationId || !capabilityToken) throw new Error('Campaign ID, authorization ID and capability token are required.');
    command = JSON.parse(byId('controller-command-json').value);
    if (!command || typeof command !== 'object' || Array.isArray(command)) throw new Error('Controller command JSON must be an object.');
    commandStatus('Submitting exact structured command envelope to the authorization-bound GitHub mailbox…');
    const result = await apiClient().submitControllerCommand(campaignId, authorizationId, capabilityToken, command);
    commandStatus(`SUBMITTED_TO_CONTROLLER_MAILBOX · command ${result.commandId} · GitHub comment ${result.githubCommentId}. Await controller reconciliation before treating state as changed.`);
  } catch (error) {
    commandStatus(`${error.code ? `${error.code}: ` : ''}${error.message}`, true);
  } finally {
    capabilityElement.value = '';
  }
});
