import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/diagnose-r2.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/R2_DIAGNOSTIC_REQUEST_v1.json';
const EXPECTED_PARENT = 'de350bcfce68ddbdbbb88b826fdd5f7614bce69a';

test('one-time R2 diagnostic is read-only, secret-safe, and exact-parent bound', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing diagnostic workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing diagnostic request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /paths:\s*\n\s*- \.agent-control\/v1\/orchestrator\/R2_DIAGNOSTIC_REQUEST_v1\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, /GET/);
  assert.match(workflow, /r2\/buckets\/\$R2_BUCKET_NAME/);
  assert.match(workflow, /errors \| map\(\.code\)/);
  assert.match(workflow, /issue comment 125/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /--request POST|--request PUT|--request PATCH|--request DELETE/);
  assert.doesNotMatch(workflow, /wrangler/);
  assert.doesNotMatch(workflow, /cat .*response|body-file .*response|\.errors\[\].message/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-r2-capability-diagnostic-request-v1');
  assert.equal(request.requestId, 'round5-r2-diagnostic-20260803T0945Z-v1');
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.targetBucketName, 'curveyield-preflight');
  assert.equal(request.readOnly, true);
  assert.equal(request.outputPolicy.errorCodesOnly, true);
  assert.equal(request.outputPolicy.messagesAllowed, false);
  assert.equal(request.outputPolicy.responseBodyAllowed, false);
  assert.equal(request.outputPolicy.secretValuesAllowed, false);
});
