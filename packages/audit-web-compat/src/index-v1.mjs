import {
  createCampaignViewModel,
  createCapabilityViewModel,
  createCatalogToolViewModel,
  createCleanRoomViewModel,
  createDiagnosticViewModel,
  createForkViewModel,
  createGitHubDirectStatusViewModel,
  createJobViewModel,
  createOperationBudgetViewModel,
  createParserViewModel,
  createProfileViewModel,
  createQuotaViewModel,
  createReleaseProvenanceViewModel,
  createReportViewModel,
  createResultViewModel,
  createRetentionViewModel,
  createWorkspaceViewModel,
  deepFreeze
} from '../../audit-report-view-model/src/index.mjs';

export const COMPATIBILITY_VERSIONS = Object.freeze({
  api: 'audit-api-public/v1',
  service: 'audit-service-reporting/v1',
  output: 'audit-web-compat/v1'
});

export class AuditWebCompatibilityError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = 'AuditWebCompatibilityError';
    this.code = code;
  }
}

function descriptors(value) {
  if (value === null || typeof value !== 'object') return null;
  try { return Object.getOwnPropertyDescriptors(value); } catch { return null; }
}

function ownValue(value, key) {
  const map = descriptors(value);
  const descriptor = map?.[key];
  return descriptor?.enumerable && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function denseArray(value, limit = 500) {
  try { if (!Array.isArray(value)) return []; } catch { return []; }
  const map = descriptors(value);
  if (!map) return [];
  const output = [];
  const keys = Object.keys(map).filter((key) => /^(?:0|[1-9]\d*)$/.test(key)).map(Number).sort((a, b) => a - b);
  for (const key of keys) {
    const descriptor = map[String(key)];
    if (descriptor?.enumerable && Object.hasOwn(descriptor, 'value')) output.push(descriptor.value);
    if (output.length >= limit) break;
  }
  return output;
}

function requireFixture(value, expectedVersion, label) {
  if (!descriptors(value)) throw new AuditWebCompatibilityError('UI_COMPAT_INPUT', `${label} compatibility fixture must be a readable record.`);
  if (ownValue(value, 'version') !== expectedVersion) throw new AuditWebCompatibilityError('UI_COMPAT_VERSION', `${label} compatibility version is not supported.`);
  return value;
}

function projectList(source, key, create) {
  return denseArray(ownValue(source, key)).map(create).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id));
}

export function adaptApiFixture(input) {
  const source = requireFixture(input, COMPATIBILITY_VERSIONS.api, 'API');
  const githubDirectInput = ownValue(source, 'githubDirect');
  return deepFreeze({
    version: COMPATIBILITY_VERSIONS.api,
    capabilities: projectList(source, 'capabilities', createCapabilityViewModel),
    tools: projectList(source, 'tools', createCatalogToolViewModel),
    profiles: projectList(source, 'profiles', createProfileViewModel),
    parsers: projectList(source, 'parsers', createParserViewModel),
    results: projectList(source, 'results', createResultViewModel),
    githubDirect: descriptors(githubDirectInput) ? createGitHubDirectStatusViewModel(githubDirectInput) : null,
    executionAvailable: false
  });
}

export function adaptServiceFixture(input) {
  const source = requireFixture(input, COMPATIBILITY_VERSIONS.service, 'Service');
  const releaseInput = ownValue(source, 'release');
  return deepFreeze({
    version: COMPATIBILITY_VERSIONS.service,
    reports: projectList(source, 'reports', createReportViewModel),
    workspaces: projectList(source, 'workspaces', createWorkspaceViewModel),
    campaigns: projectList(source, 'campaigns', createCampaignViewModel),
    jobs: projectList(source, 'jobs', createJobViewModel),
    forks: projectList(source, 'forks', createForkViewModel),
    cleanRooms: projectList(source, 'cleanRooms', createCleanRoomViewModel),
    quotas: projectList(source, 'quotas', createQuotaViewModel),
    retention: projectList(source, 'retention', createRetentionViewModel),
    operationBudgets: projectList(source, 'operationBudgets', createOperationBudgetViewModel),
    diagnostics: denseArray(ownValue(source, 'diagnostics')).map(createDiagnosticViewModel).sort((a, b) => a.code.localeCompare(b.code)),
    release: descriptors(releaseInput) ? createReleaseProvenanceViewModel(releaseInput) : null,
    executionAvailable: false
  });
}

export function composeWebCompatibility({ api, service } = {}) {
  if (arguments.length === 0 || (api === undefined && service === undefined)) {
    throw new AuditWebCompatibilityError('UI_COMPAT_INPUT', 'API and service compatibility fixtures are required.');
  }
  const apiModel = adaptApiFixture(api);
  const serviceModel = adaptServiceFixture(service);
  return deepFreeze({
    version: COMPATIBILITY_VERSIONS.output,
    sourceVersions: Object.freeze({ api: apiModel.version, service: serviceModel.version }),
    capabilities: apiModel.capabilities,
    tools: apiModel.tools,
    profiles: apiModel.profiles,
    parsers: apiModel.parsers,
    results: apiModel.results,
    githubDirect: apiModel.githubDirect,
    reports: serviceModel.reports,
    workspaces: serviceModel.workspaces,
    campaigns: serviceModel.campaigns,
    jobs: serviceModel.jobs,
    forks: serviceModel.forks,
    cleanRooms: serviceModel.cleanRooms,
    quotas: serviceModel.quotas,
    retention: serviceModel.retention,
    operationBudgets: serviceModel.operationBudgets,
    diagnostics: serviceModel.diagnostics,
    release: serviceModel.release,
    executionAvailable: false
  });
}
