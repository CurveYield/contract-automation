import { createAuditApiClient } from './client.js';
import { createCapabilityViewModel, safeDisplayText } from './view-model.js';

const connectionForm = document.querySelector('#connection-form');
const workspaceForm = document.querySelector('#workspace-form');
const profilesButton = document.querySelector('#load-profiles');
const status = document.querySelector('#connection-status');
const workspaceResult = document.querySelector('#workspace-result');
const profileResult = document.querySelector('#profile-result');
const phase = document.querySelector('#phase');
const execution = document.querySelector('#execution');
const executionState = document.querySelector('#execution-state');
let client = null;

function setText(node, value) {
  node.textContent = safeDisplayText(value);
}

function requireClient() {
  if (!client) throw new Error('Connect to the Audit API first.');
  return client;
}

connectionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setText(status, 'Checking Audit API capabilities…');
  try {
    const candidate = createAuditApiClient({
      apiUrl: document.querySelector('#api-url').value,
      apiKey: document.querySelector('#api-key').value
    });
    const capabilities = await candidate.getCapabilities();
    const view = createCapabilityViewModel(capabilities);
    client = candidate;
    setText(phase, view.phaseLabel);
    setText(execution, view.executionLabel);
    setText(executionState, view.stateLabel);
    setText(status, 'Connected to the separate Audit API.');
  } catch (error) {
    client = null;
    setText(status, error?.message || 'Audit API connection failed.');
  }
});

workspaceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setText(workspaceResult, 'Loading workspace metadata…');
  try {
    const workspaceId = document.querySelector('#workspace-id').value;
    const [workspace, layers] = await Promise.all([
      requireClient().getWorkspace(workspaceId),
      requireClient().getWorkspaceLayers(workspaceId)
    ]);
    setText(workspaceResult, JSON.stringify({ workspace, layers }, null, 2));
  } catch (error) {
    setText(workspaceResult, error?.message || 'Workspace lookup failed.');
  }
});

profilesButton.addEventListener('click', async () => {
  setText(profileResult, 'Loading immutable profile metadata…');
  try {
    const profiles = await requireClient().listProfiles();
    setText(profileResult, JSON.stringify(profiles, null, 2));
  } catch (error) {
    setText(profileResult, error?.message || 'Profile lookup failed.');
  }
});
