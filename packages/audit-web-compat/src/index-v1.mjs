import {
  createCampaignViewModel, createCapabilityViewModel, createCatalogToolViewModel,
  createCleanRoomViewModel, createDiagnosticViewModel, createForkViewModel,
  createGitHubDirectStatusViewModel, createJobViewModel, createOperationBudgetViewModel,
  createParserViewModel, createProfileViewModel, createQuotaViewModel,
  createReleaseProvenanceViewModel, createReportViewModel, createResultViewModel,
  createRetentionViewModel, createWorkspaceViewModel, deepFreeze
} from '../../audit-report-view-model/src/index.mjs';
import {
  DIRECT_ERROR_SCHEMA, DIRECT_MODE, DIRECT_RESULT_SCHEMA,
  adaptDirectErrorV1, adaptDirectResultV2
} from './github-direct-v2.mjs';

export const COMPATIBILITY_VERSIONS = Object.freeze({ api: 'audit-api-public/v1', service: 'audit-service-reporting/v1', output: 'audit-web-compat/v1' });
export const ROUND4_COMPATIBILITY_VERSIONS = Object.freeze({
  api: COMPATIBILITY_VERSIONS.api, service: COMPATIBILITY_VERSIONS.service,
  githubDirectMode: 'github-direct-audit-v1',
  githubDirectResult: 'github-direct-service-result-v2',
  githubDirectError: 'github-direct-service-error-v1',
  output: 'audit-web-compat/v2'
});

export class AuditWebCompatibilityError extends TypeError {
  constructor(code, message) { super(message); this.name = 'AuditWebCompatibilityError'; this.code = code; }
}
function descriptors(value) { if (value === null || typeof value !== 'object') return null; try { return Object.getOwnPropertyDescriptors(value); } catch { return null; } }
function own(value, key) { const item = descriptors(value)?.[key]; return item?.enumerable && Object.hasOwn(item, 'value') ? item.value : undefined; }
function keys(value) { const map = descriptors(value); return map ? Object.keys(map).filter((key) => map[key]?.enumerable && Object.hasOwn(map[key], 'value')) : null; }
function fail(code, message) { throw new AuditWebCompatibilityError(code, message); }
function dense(value, limit = 500) {
  try { if (!Array.isArray(value)) return []; } catch { return []; }
  const map = descriptors(value); if (!map) return [];
  return Object.keys(map).filter((key) => /^(?:0|[1-9]\d*)$/.test(key)).map(Number).sort((a, b) => a - b)
    .filter((key) => map[String(key)]?.enumerable && Object.hasOwn(map[String(key)], 'value')).slice(0, limit).map((key) => map[String(key)].value);
}
function fixture(value, version, label) {
  if (!descriptors(value)) fail('UI_COMPAT_INPUT', `${label} fixture must be readable.`);
  if (own(value, 'version') !== version) fail('UI_COMPAT_VERSION', `${label} fixture version is unsupported.`);
  return value;
}
function project(source, key, create) { return dense(own(source, key)).map(create).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)); }
function legacyDirect(input) {
  const found = keys(input); if (!found) return null;
  const required = ['id', 'status'], allowed = new Set([...required, 'repository', 'targetSha', 'checkStatus', 'reportId', 'updatedAt', 'reason']);
  if (required.some((key) => !found.includes(key)) || found.some((key) => !allowed.has(key))) fail('UI_COMPAT_INPUT', 'Legacy GitHub Direct status has invalid fields.');
  return createGitHubDirectStatusViewModel(Object.fromEntries(found.map((key) => [key, own(input, key)])));
}
export function adaptGitHubDirectResultV2(input) { return adaptDirectResultV2(input, AuditWebCompatibilityError); }
export function adaptGitHubDirectErrorV1(input) { return adaptDirectErrorV1(input, AuditWebCompatibilityError); }
export function adaptLegacyGitHubDirectStatusV1(input) { return legacyDirect(input); }
function direct(input) {
  if (!descriptors(input)) return null;
  const schema = own(input, 'schemaVersion');
  if (schema === DIRECT_RESULT_SCHEMA) return adaptGitHubDirectResultV2(input);
  if (schema === DIRECT_ERROR_SCHEMA) return adaptGitHubDirectErrorV1(input);
  if (schema !== undefined) fail('UI_COMPAT_VERSION', 'GitHub Direct schema is unsupported.');
  return legacyDirect(input);
}

export function adaptApiFixture(input) {
  const source = fixture(input, COMPATIBILITY_VERSIONS.api, 'API');
  const githubDirectInput = own(source, 'githubDirect');
  const githubDirect = descriptors(githubDirectInput)
    ? (own(githubDirectInput, 'schemaVersion') === DIRECT_RESULT_SCHEMA ? adaptGitHubDirectResultV2(githubDirectInput) : direct(githubDirectInput))
    : null;
  return deepFreeze({
    version: COMPATIBILITY_VERSIONS.api,
    capabilities: project(source, 'capabilities', createCapabilityViewModel), tools: project(source, 'tools', createCatalogToolViewModel),
    profiles: project(source, 'profiles', createProfileViewModel), parsers: project(source, 'parsers', createParserViewModel),
    results: project(source, 'results', createResultViewModel), githubDirect, executionAvailable: false
  });
}
export function adaptServiceFixture(input) {
  const source = fixture(input, COMPATIBILITY_VERSIONS.service, 'Service');
  return deepFreeze({
    version: COMPATIBILITY_VERSIONS.service,
    reports: project(source, 'reports', createReportViewModel), workspaces: project(source, 'workspaces', createWorkspaceViewModel),
    campaigns: project(source, 'campaigns', createCampaignViewModel), jobs: project(source, 'jobs', createJobViewModel),
    forks: project(source, 'forks', createForkViewModel), cleanRooms: project(source, 'cleanRooms', createCleanRoomViewModel),
    quotas: project(source, 'quotas', createQuotaViewModel), retention: project(source, 'retention', createRetentionViewModel),
    operationBudgets: project(source, 'operationBudgets', createOperationBudgetViewModel),
    diagnostics: dense(own(source, 'diagnostics')).map(createDiagnosticViewModel).sort((a, b) => a.code.localeCompare(b.code)),
    release: descriptors(own(source, 'release')) ? createReleaseProvenanceViewModel(own(source, 'release')) : null,
    executionAvailable: false
  });
}
function compose(apiModel, serviceModel, version) {
  return deepFreeze({
    version, sourceVersions: Object.freeze({ api: apiModel.version, service: serviceModel.version, ...(apiModel.githubDirect?.sourceSchema ? { githubDirect: apiModel.githubDirect.sourceSchema } : {}) }),
    capabilities: apiModel.capabilities, tools: apiModel.tools, profiles: apiModel.profiles, parsers: apiModel.parsers,
    results: apiModel.results, githubDirect: apiModel.githubDirect, reports: serviceModel.reports, workspaces: serviceModel.workspaces,
    campaigns: serviceModel.campaigns, jobs: serviceModel.jobs, forks: serviceModel.forks, cleanRooms: serviceModel.cleanRooms,
    quotas: serviceModel.quotas, retention: serviceModel.retention, operationBudgets: serviceModel.operationBudgets,
    diagnostics: serviceModel.diagnostics, release: serviceModel.release, executionAvailable: false
  });
}
export function composeWebCompatibility({ api, service } = {}) { return compose(adaptApiFixture(api), adaptServiceFixture(service), COMPATIBILITY_VERSIONS.output); }
export function composeRound4WebCompatibility({ api, service } = {}) { return compose(adaptApiFixture(api), adaptServiceFixture(service), ROUND4_COMPATIBILITY_VERSIONS.output); }
export { DIRECT_MODE, DIRECT_RESULT_SCHEMA, DIRECT_ERROR_SCHEMA };
