import { renderShell, renderState } from './render.mjs';
import { renderReportsPage, renderReportDetailPage } from './pages-reports-v1.mjs';
import { renderWorkspacesPage, renderWorkspacePage, renderCampaignPage, renderJobPage } from './pages-lifecycle-v1.mjs';
import { renderForkPage, renderCleanRoomPage } from './pages-resources-v1.mjs';
import { renderCatalogPage, renderDiagnosticsPage } from './pages-catalog-diagnostics-v1.mjs';
import {
  renderGitHubDirectStatusPage, renderOperationsPage, renderParserPage,
  renderProfilePage, renderProfilesPage, renderReleaseProvenancePage, renderResultPage
} from './pages-round3-v1.mjs';

export {
  renderReportsPage, renderReportDetailPage, renderWorkspacesPage, renderWorkspacePage,
  renderCampaignPage, renderJobPage, renderForkPage, renderCleanRoomPage,
  renderCatalogPage, renderDiagnosticsPage, renderGitHubDirectStatusPage,
  renderOperationsPage, renderParserPage, renderProfilePage, renderProfilesPage,
  renderReleaseProvenancePage, renderResultPage
};

const PAGE_CONFIG = Object.freeze({
  reports: ['Reports', 'reports', renderReportsPage],
  reportDetail: ['Report detail', 'reports', renderReportDetailPage],
  workspaces: ['Workspaces', 'workspaces', renderWorkspacesPage],
  workspaceDetail: ['Workspace detail', 'workspaces', renderWorkspacePage],
  campaignDetail: ['Campaign detail', 'workspaces', renderCampaignPage],
  jobDetail: ['Job detail', 'workspaces', renderJobPage],
  forkDetail: ['Persistent fork', 'workspaces', renderForkPage],
  cleanRoomDetail: ['Clean-room campaign', 'workspaces', renderCleanRoomPage],
  profiles: ['Profiles', 'profiles', renderProfilesPage],
  profileDetail: ['Profile detail', 'profiles', renderProfilePage],
  parserDetail: ['Parser detail', 'profiles', renderParserPage],
  resultDetail: ['Result detail', 'profiles', renderResultPage],
  catalog: ['Capability catalog', 'catalog', renderCatalogPage],
  githubDirectStatus: ['GitHub Direct Audit status', 'operations', renderGitHubDirectStatusPage],
  operations: ['Operations', 'operations', renderOperationsPage],
  diagnostics: ['Operator diagnostics', 'diagnostics', renderDiagnosticsPage],
  releaseProvenance: ['Release provenance', 'release', renderReleaseProvenancePage]
});

export function renderAuditPage(routeName, payload, options = {}) {
  const config = PAGE_CONFIG[routeName];
  if (!config) return renderShell({ title: 'Page not found', activeRoute: '', state: 'notFound', body: renderState({ kind: 'notFound', message: 'The requested page is not available.' }) });
  const [title, activeRoute, renderer] = config;
  return renderShell({ title, activeRoute, body: renderer(payload, options) });
}
