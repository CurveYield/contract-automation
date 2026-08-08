import { createApiClient } from './client.js';

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

function verifyControllerCompatibility(compatibility) {
  if (compatibility?.adapterVersion !== 'tier3-controller-adapter-v1') {
    throw new Error('This browser release is incompatible with the controller adapter.');
  }
  const chains = compatibility?.networkScope?.chains;
  if (!Array.isArray(chains)
      || chains.length !== 2
      || chains[0] !== 'ethereum'
      || chains[1] !== 'base'
      || compatibility?.networkScope?.defaultChain !== 'base') {
    throw new Error('Controller network scope does not match the accepted Ethereum/Base release.');
  }
  if (compatibility?.controller?.processId !== 'deep-assurance-v6') {
    throw new Error('Controller process identity does not match Deep Assurance v6.');
  }
  if (compatibility?.controller?.instructionReleaseIdentity !== 'ai-auditor-deep-assurance-v6@16.13.0') {
    throw new Error('Controller instruction release is incompatible with this browser release.');
  }
}

function renderCompatibility(compatibility) {
  setText(
    'controller-release',
    `${compatibility.controller.repository} @ ${shortSha(compatibility.controller.compatibilityCommit)}`
  );
  setText('instruction-release', compatibility.controller.instructionReleaseIdentity);
}

function renderNoActiveCampaign(project) {
  setText('active-campaign', 'No active campaign');
  setText('campaign-source', '—');
  resetControllerSummaries('Not applicable — no active campaign is authorized.');
  setControllerState(`No active campaign for ${project.projectSlug}: ${project.reason}.`);
}

function renderActivePointer(project) {
  setText('active-campaign', project.activeCampaignId);
  setText('campaign-source', `${project.source.repository} @ ${shortSha(project.source.commit)}`);
  resetControllerSummaries('Awaiting authoritative campaign projection from the pinned controller release.');
  setControllerState(
    `Active controller pointer verified on ${project.authoritativeControllerBranch} @ ${shortSha(project.authoritativeControllerCommit)}. Full campaign state is not inferred from branch activity.`
  );
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
    verifyControllerCompatibility(compatibility);
    renderCompatibility(compatibility);
    setControllerState('Compatibility accepted. Loading authoritative project pointer…');
    const result = await api.getControllerProject(projectSlug);
    verifyControllerCompatibility(result);
    renderCompatibility(result);
    if (result.project?.status === 'NO_ACTIVE_CAMPAIGN') {
      renderNoActiveCampaign(result.project);
    } else if (result.project?.status === 'ACTIVE') {
      renderActivePointer(result.project);
    } else {
      throw new Error('Controller returned an unsupported project state.');
    }
    elements['service-state'].textContent = 'Controller connected';
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
    verifyControllerCompatibility(compatibility);
    renderCompatibility(compatibility);
    syncChainOptions(chainsResponse.chains);
    elements['service-state'].textContent = 'API + controller ready';
    setProgress('API connection succeeded.');
    setControllerState('Controller compatibility accepted. Load a project to inspect the authoritative pointer.');
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
