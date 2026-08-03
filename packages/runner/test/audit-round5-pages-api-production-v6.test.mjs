import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/deploy-v11.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v11.json';
const EXPECTED_PARENT = '23a6ec8d8cc89d3aaa5d6a19d843bc37544358b5';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const RELEASE_BRANCH = 'orchestrator/round4-ci-base-v1';
const REQUEST_ID = 'round5-pages-api-production-20260803T1625Z-v11';
const SUPERSEDED_RUN = 30831520420;
const SUPERSEDED_JOB = 91746369253;

test('deployment v11 separates terminal stage acceptance from custom-domain content binding', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v11\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /github\.event\.before/);
  assert.match(workflow, /V11_TEMP_DIR="\$RUNNER_TEMP\/pages-v11"/);
  assert.match(workflow, /echo "V11_TEMP_DIR=\$V11_TEMP_DIR" >> "\$GITHUB_ENV"/);

  assert.match(workflow, /git diff --quiet "\$APPLICATION_SOURCE_SHA" -- apps\/web\/public/);
  assert.match(workflow, /pages_asset_manifest_v1\.py/);
  assert.match(workflow, /\/pages\/assets\/check-missing/);
  assert.match(workflow, /test "\$missing_asset_count" = "0"/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments/);
  assert.match(workflow, /\.result\.environment == "production"/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.branch == \$release_branch/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.commit_hash == \$application_source/);
  assert.match(workflow, /\.result\.latest_stage\.name == "deploy"/);
  assert.match(workflow, /\.result\.latest_stage\.status == "success"/);
  assert.doesNotMatch(workflow, /\.result\.aliases/);

  const shortIdIndex = workflow.indexOf('PAGES_DEPLOYMENT_SHORT_ID=${deployment_id:0:8}');
  const pollIndex = workflow.indexOf('deployment_ready=false');
  assert.ok(shortIdIndex >= 0, 'deployment short ID must be recorded');
  assert.ok(pollIndex > shortIdIndex, 'deployment short ID must be recorded before stage polling');

  assert.match(workflow, /Verify production custom domain serves stage-accepted production deployment/);
  assert.match(workflow, /https:\/\/\$PAGES_DOMAIN\/\?acceptance=/);
  assert.match(workflow, /https:\/\/\$PAGES_DOMAIN\/app\.js\?acceptance=/);
  assert.match(workflow, /unexpected chain option scope/);
  assert.match(workflow, /Base is not the sole default/);
  assert.match(workflow, /deferred network exposed/);
  assert.match(workflow, /chain synchronization contract missing/);
  assert.match(workflow, /Production Pages API deployment v11 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);

  assert.doesNotMatch(workflow, /\bnpm\b|\bnpx\b|\bpnpm\b|\byarn\b|\bcorepack\b|\bpip(?:3)?\b|\bapt(?:-get)?\b|\bbrew\b/);
  assert.doesNotMatch(workflow, /\bwrangler\b/i);
  assert.doesNotMatch(workflow, /\/pages\/assets\/upload|\/pages\/assets\/upsert-hashes/);
  assert.doesNotMatch(workflow, /(?:--form|-F)\s+["']?branch=/);
  assert.doesNotMatch(workflow, /workflow_dispatch:|RPC_|PRIVATE_KEY|MNEMONIC|eth_sendRawTransaction/);
  assert.doesNotMatch(workflow, /\$\{\{\s*runner\./);

  assert.equal(request.schemaVersion, 'round5-pages-api-production-request-v11');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.applicationSourceSha, APPLICATION_SOURCE);
  assert.equal(request.releaseBranch, RELEASE_BRANCH);
  assert.equal(request.supersededRun, SUPERSEDED_RUN);
  assert.equal(request.supersededJob, SUPERSEDED_JOB);
  assert.equal(request.supersededRunReason, 'optional-deployment-alias-coupled-to-stage-acceptance');
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.deferredNetworks, ['arbitrum', 'fraxtal', 'katana', 'optimism', 'polygon']);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.directPagesApiRequired, true);
  assert.equal(request.assetUploadAllowed, false);
  assert.equal(request.missingAssetFailsClosed, true);
  assert.equal(request.deploymentAliasArrayRequired, false);
  assert.equal(request.terminalDeployStageRequired, true);
  assert.equal(request.customDomainContentBindingRequired, true);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.workerDeploymentAllowed, false);
  assert.equal(request.secretMutationAllowed, false);
  assert.equal(request.r2MutationAllowed, false);
  assert.equal(request.jobOrUploadSubmissionAllowed, false);
  assert.equal(request.rpcCallsAllowed, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
});
