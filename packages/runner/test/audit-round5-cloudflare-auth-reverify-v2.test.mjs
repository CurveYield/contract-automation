import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/diagnose-cloudflare-auth-reverify.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/CLOUDFLARE_AUTH_REVERIFY_REQUEST_v2.json';
const EXPECTED_PARENT = '4eeeb50ddfbc4c16d5694a8a5bd96a1b24b9856b';
const REQUEST_ID = 'round5-cloudflare-auth-reverify-20260803T1015Z-v2';

test('replacement Cloudflare token is reverified through an exact-parent GET-only production probe', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /CLOUDFLARE_AUTH_REVERIFY_REQUEST_v2\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /user\/tokens\/verify/);
  assert.match(workflow, /accounts\/\$CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /r2\/buckets\/\$R2_BUCKET_NAME/);
  assert.match(workflow, /issue comment 125/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /--request POST|--request PUT|--request PATCH|--request DELETE/);
  assert.doesNotMatch(workflow, /wrangler/);
  assert.doesNotMatch(workflow, /\.message(?:\b|\[)|token_id|account_name|cat .*response/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-cloudflare-auth-reverify-request-v2');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.deepEqual(request.probes, ['token-status', 'account-scope', 'r2-bucket-access']);
  assert.equal(request.readOnly, true);
  assert.equal(request.outputPolicy.numericErrorCodesOnly, true);
  assert.equal(request.outputPolicy.messagesAllowed, false);
  assert.equal(request.outputPolicy.identifiersAllowed, false);
  assert.equal(request.outputPolicy.responseBodiesAllowed, false);
  assert.equal(request.outputPolicy.secretValuesAllowed, false);
});
