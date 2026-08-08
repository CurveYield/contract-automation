// Deep Assurance Tier 3 Operator v4
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
  try {
    status('Checking immutable controller protocol compatibility and freshness policy…');
    const compatibility = await apiClient().getControllerCompatibility();
    renderCompatibility(compatibility);
    status('Tier 3 controller protocol is compatible. Campaign reads must pass path-scoped freshness verification.');
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
    status(`Resolving authoritative campaign state for ${campaignId}…`);
    const envelope = await apiClient().getControllerCampaign(campaignId);
    renderCampaignEnvelope(envelope);
    status(`Loaded ${campaignId} at exact campaign commit ${envelope.controllerCampaignCommit}.`);
  } catch (error) {
    status(`${error.code ? `${error.code}: ` : ''}${error.message}`, true);
  }
});
