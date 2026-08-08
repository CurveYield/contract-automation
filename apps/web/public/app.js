import { createApiClient } from './client.js';
import { assertTier3BrowserCompatibilityV1, controllerViewModelV1 } from './controller-view.js';

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((element) => [element.id, element]));
let latestResult = null;
let latestJobId = null;

const savedApiUrl = localStorage.getItem('preflightsim.apiUrl');
if (savedApiUrl) elements['api-url'].value = savedApiUrl;
const rememberedKey = localStorage.getItem('preflightsim.apiKey');
const sessionKey = sessionStorage.getItem('preflightsim.apiKey');
if (rememberedKey || sessionKey) elements['api-key'].value = rememberedKey || sessionKey;
elements['remember-key'].checked = Boolean(rememberedKey);

function setProgress(message, isError = false) {
  elements.progress.textContent = message;
  elements.progress.style.borderColor = isError ? 'var(--danger)' : 'var(--accent)';
}

function setControllerState(message, isError = false) {
  elements['controller-state'].textContent = message;
  elements['controller-state'].dataset.state = isError ? 'error' : 'ok';
}

function setCommandState(message, isError = false) {
  elements['controller-command-state'].textContent = message;
  elements['controller-command-state'].dataset.state = isError ? 'error' : 'ok';
}

function setText(id, value) {
  elements[id].textContent = value;
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
    'finalization-summary'
  ]) {
    setText(id, message);
  }
}

function credentials() {
  const apiUrl = elements['api-url'].value.trim().replace(/\/$/, '');
  const apiKey = elements['api-key'].value.trim();
  if (!apiUrl || !apiKey) throw new Error('API URL and API key are required.');
  localStorage.setItem('preflightsim.apiUrl', apiUrl);
  if (elements['remember-key'].checked) {
    localStorage.setItem('preflightsim.apiKey', apiKey);
    sessionStorage.removeItem('preflightsim.apiKey');
  } else {
    sessionStorage.setItem('preflightsim.apiKey', apiKey);
    localStorage.removeItem('preflightsim.apiKey');
  }
  return { apiUrl, apiKey };
}

function client() {
  return createApiClient(credentials());
}

function selectedProjectType() {
  return document.querySelector('input[name="projectType"]:checked').value;
}

function updateProjectFields() {
  const type = selectedProjectType();
  elements['github-project'].classList.toggle('hidden', type !== 'github');
  elements['inline-project'].classList.toggle('hidden', type !== 'inline');
  elements['upload-project'].classList.toggle('hidden', type !== 'upload');
}

function showWorkspace(name) {
  const showAudit = name === 'audit';
  elements['audit-workspace'].classList.toggle('hidden', !showAudit);
  elements['execution-workspace'].classList.toggle('hidden', showAudit);
  elements['show-audit-workspace'].classList.toggle('secondary', !showAudit);
  elements['show-execution-workspace'].classList.toggle('secondary', showAudit);
  elements['show-audit-workspace'].setAttribute('aria-pressed', String(showAudit));
  elements['show-execution-workspace'].setAttribute('aria-pressed', String(!showAudit));
}

function shortSha(value) {
  return typeof value === 'string' && value.length >= 12 ? value.slice(0, 12) : value;
}

function renderCompatibility(compatibility) {
  assertTier3BrowserCompatibilityV1(compatibility);
  setText(
    'controller-release',
    `${compatibility.controller.repository} @ ${shortSha(compatibility.controller.compatibilityCommit)}`
  );
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
    resetControllerSummaries('Unavailable until the controller state is loaded safely.');
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

function syncChainOptions(chains) {
  const entries = Object.entries(chains).filter(([name]) => name === 'ethereum' || name === 'base');
  const current = elements.chain.value;
  const preferred = entries.some(([name]) => name === current) ? current : 'base';
  const preferredChain = preferred === 'base' ? 'base' : preferred;
  const options = entries.map(([name]) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name === 'ethereum' ? 'Ethereum' : 'Base';
    option.selected = name === preferredChain;
    return option;
  });
  elements.chain.replaceChildren(...options);
}

document.querySelectorAll('input[name="projectType"]').forEach((radio) => radio.addEventListener('change', updateProjectFields));
elements['show-audit-workspace'].addEventListener('click', () => showWorkspace('audit'));
elements['show-execution-workspace'].addEventListener('click', () => showWorkspace('execution'));
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

async function projectPayload(api) {
  const type = selectedProjectType();
  if (type === 'github') {
    return {
      type,
      repository: elements['github-repository'].value.trim(),
      ref: elements['github-ref'].value.trim() || 'main'
    };
  }
  if (type === 'inline') {
    return {
      type,
      files: { [elements['inline-path'].value.trim()]: elements['inline-source'].value }
    };
  }
  const file = elements['project-file'].files[0];
  if (!file) throw new Error('Choose a ZIP project first.');
  setProgress(`Uploading ${file.name}…`);
  const upload = await api.uploadProject(file);
  return { type: 'upload', objectKey: upload.objectKey };
}

function parseBlock() {
  const value = elements.block.value.trim();
  if (value === 'latest') return 'latest';
  if (!/^\d+$/.test(value)) throw new Error('Fork block must be "latest" or a non-negative integer.');
  return Number(value);
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

elements['test-connection'].addEventListener('click', async () => {
  try {
    elements['service-state'].textContent = 'Testing…';
    const api = client();
    const [chainsResponse, compatibility] = await Promise.all([
      api.getChains(),
      api.getControllerCompatibility()
    ]);
    renderCompatibility(compatibility);
    syncChainOptions(chainsResponse.chains);
    elements['service-state'].textContent = 'API + controller ready';
    setProgress('API connection succeeded.');
    setControllerState('Controller compatibility accepted. Load a project to inspect authoritative Tier 3 state.');
  } catch (error) {
    elements['service-state'].textContent = 'Connection failed';
    setProgress(error.message, true);
    setControllerState(error.message, true);
  }
});

elements['job-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  elements['submit-job'].disabled = true;
  elements['download-json'].disabled = true;
  elements['open-report'].disabled = true;
  latestResult = null;
  try {
    const api = client();
    const mode = elements.mode.value;
    const workflow = mode === 'compile' ? { steps: [] } : JSON.parse(elements.workflow.value);
    const project = await projectPayload(api);
    const request = {
      mode,
      project,
      compilerVersion: elements['compiler-version'].value.trim(),
      ...(mode === 'simulate' ? { chain: elements.chain.value, block: parseBlock() } : {}),
      workflow,
      optimizer: {
        enabled: elements['optimizer-enabled'].checked,
        runs: Number(elements['optimizer-runs'].value)
      },
      viaIR: elements['via-ir'].checked
    };
    const oz = elements['openzeppelin-version'].value.trim();
    const evmVersion = elements['evm-version'].value.trim();
    if (oz) request.openZeppelinVersion = oz;
    if (evmVersion) request.evmVersion = evmVersion;

    setProgress('Submitting job to GitHub Actions…');
    const created = await api.createJob(request);
    latestJobId = created.jobId;
    elements['job-id'].textContent = latestJobId;
    const terminal = await api.pollJob(latestJobId, {
      onUpdate(status) {
        setProgress(`${status.status}: ${status.stage ?? 'working'}`);
        elements['result-json'].textContent = JSON.stringify(status, null, 2);
      }
    });
    latestResult = await api.getResult(latestJobId);
    elements['result-json'].textContent = JSON.stringify(latestResult, null, 2);
    elements['download-json'].disabled = false;
    elements['open-report'].disabled = false;
    setProgress(`Job ${terminal.status}.`, terminal.status === 'failed');
  } catch (error) {
    setProgress(error.message, true);
    elements['result-json'].textContent = JSON.stringify({ error: error.message, code: error.code }, null, 2);
  } finally {
    elements['submit-job'].disabled = false;
  }
});

elements['download-json'].addEventListener('click', () => {
  if (latestResult) download(`${latestJobId}.json`, JSON.stringify(latestResult, null, 2), 'application/json');
});

elements['open-report'].addEventListener('click', async () => {
  if (!latestJobId) return;
  try {
    const html = await client().getReport(latestJobId);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    setProgress(error.message, true);
  }
});

elements['load-vault-example'].addEventListener('click', async () => {
  document.querySelector('input[name="projectType"][value="github"]').checked = true;
  updateProjectFields();
  elements['github-repository'].value = 'CurveYield/contract-automation';
  elements['github-ref'].value = 'main';
  elements.workflow.value = JSON.stringify({
    steps: [
      { action: 'deploy', alias: 'token', contract: 'TestToken', source: 'fixtures/contracts/VaultSystem.sol', args: [] },
      { action: 'deploy', alias: 'staking', contract: 'TestStaking', source: 'fixtures/contracts/VaultSystem.sol', args: ['$token'] },
      { action: 'deploy', alias: 'strategy', contract: 'TestStrategy', source: 'fixtures/contracts/VaultSystem.sol', args: ['$token', '$staking'] },
      { action: 'deploy', alias: 'vault', contract: 'TestVault', source: 'fixtures/contracts/VaultSystem.sol', args: ['$token', '$strategy'] },
      { action: 'call', target: '$strategy', function: 'setVault', args: ['$vault'] },
      { action: 'call', target: '$token', function: 'mint', args: ['$account0', '1000000000000000000000'] },
      { action: 'call', target: '$token', function: 'approve', args: ['$vault', '1000000000000000000000'] },
      { action: 'call', target: '$vault', function: 'deposit', args: ['100000000000000000000'] },
      { action: 'call', target: '$staking', function: 'addRewards', args: ['$strategy', '10000000000000000000'] },
      { action: 'call', target: '$strategy', function: 'harvest', args: [] },
      { action: 'assertCall', target: '$staking', function: 'balanceOf', args: ['$strategy'], equals: '110000000000000000000' },
      { action: 'call', target: '$vault', function: 'withdraw', args: ['50000000000000000000'] }
    ]
  }, null, 2);
  showWorkspace('execution');
  setProgress('Vault example loaded. Deploy the repository first or replace it with your own project.');
});

showWorkspace('audit');
