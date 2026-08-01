import { createAuditApiClient } from './client.js';
import { createCapabilityViewModel, safeDisplayText } from './view-model.js';

const form = document.querySelector('#connection-form');
const status = document.querySelector('#connection-status');
const phase = document.querySelector('#phase');
const execution = document.querySelector('#execution');
const executionState = document.querySelector('#execution-state');

function setText(node, value) {
  node.textContent = safeDisplayText(value);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setText(status, 'Checking Audit API capabilities…');
  try {
    const client = createAuditApiClient({
      apiUrl: document.querySelector('#api-url').value,
      apiKey: document.querySelector('#api-key').value
    });
    const capabilities = await client.getCapabilities();
    const view = createCapabilityViewModel(capabilities);
    setText(phase, view.phaseLabel);
    setText(execution, view.executionLabel);
    setText(executionState, view.stateLabel);
    setText(status, 'Connected to the separate Audit API.');
  } catch (error) {
    setText(status, error?.message || 'Audit API connection failed.');
  }
});
