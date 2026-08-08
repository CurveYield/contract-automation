import { createApiClient } from './client.js';

const byId = (id) => document.getElementById(id);

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

function resetCampaign() {
  for (const id of ['campaign-status', 'completion-status', 'security-verdict']) text(id, '—');
  for (const id of ['controller-phases', 'controller-lanes', 'controller-proofs', 'controller-findings', 'controller-remediation', 'controller-evidence', 'controller-report']) jsonText(id, null);
}

function renderCompatibility(value) {
  text('controller-release', value.controllerRelease);
  text('controller-ref', value.controllerRef);
  text('automation-release', value.automationRelease);
  text('controller-authority', value.authority);
  text('controller-mutation-mode', value.mutationMode);
  text('controller-network-scope', `${value.networkScope.active.join(', ')} · default ${value.networkScope.default}`);
}

function renderCampaign(value) {
  text('campaign-status', value.campaign.status);
  text('completion-status', value.campaign.completionStatus ?? 'INCOMPLETE');
  text('security-verdict', value.campaign.securityVerdict ?? 'NOT FINAL');
  jsonText('controller-phases', value.phases);
  jsonText('controller-lanes', value.lanes);
  jsonText('controller-proofs', value.instructionProofs);
  jsonText('controller-findings', value.findings);
  jsonText('controller-remediation', value.remediation);
  jsonText('controller-evidence', value.evidence);
  jsonText('controller-report', value.report);
}

byId('controller-connect').addEventListener('click', async () => {
  try {
    status('Checking exact controller compatibility…');
    const compatibility = await apiClient().getControllerCompatibility();
    renderCompatibility(compatibility);
    status('Tier 3 controller adapter is compatible and read-only.');
  } catch (error) {
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
    status(`Loading authoritative projection for ${campaignId}…`);
    const campaign = await apiClient().getControllerCampaign(campaignId);
    renderCampaign(campaign);
    status(`Loaded ${campaignId} from the GitHub audit-controller projection.`);
  } catch (error) {
    status(`${error.code ? `${error.code}: ` : ''}${error.message}`, true);
  }
});
