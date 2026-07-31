import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAuditBoundary, LITE_BASELINE_SHA256 } from '../../scripts/check-audit-boundary.mjs';

const expectedLiteBaselines = Object.freeze({
  'apps/api/src/index.mjs': 'b4a9fad0968f619e97fa209030aca01b163945cb180b7253eb279135844db529',
  '.github/workflows/simulate.yml': '5a39983d28d94dc8313ae7a908f5a352004bdbe070ac3259f91d3c03b33f4fb2',
  'packages/runner/src/api-client.mjs': 'e08c336c7672d3bf2633294f1c0030cb37ccb99c242158fee5f84e85c28882eb',
  'packages/protocol/src/index.mjs': '0b91d0726239408975b3c6aaedc6a123880c4abe43c5a0b7dedfe0b495d202ce',
  'infra/r2-lifecycle.json': '3a9826fadce24eda439732367ac88bdb8193f11ff4a63f7a32601aa0fe21ba40',
  'apps/web/src/client.mjs': '57cdc3e77dc37c421fd9f9a79c06401d1d813416b5a68d0767caf05ae1a6a9c7'
});

test('critical Lite baselines are the live-main verified values', () => {
  assert.deepEqual(LITE_BASELINE_SHA256, expectedLiteBaselines);
});

test('the integrated Phase 1 tree preserves every Audit/Lite boundary invariant', async () => {
  const result = await checkAuditBoundary();
  assert.equal(result.ok, true, result.violations.join('\n'));
  assert.equal(result.violations.length, 0, result.violations.join('\n'));
  assert.ok(result.checkedAuditModules >= 5);
  assert.ok(result.checkedLiteFiles >= 6);
  assert.ok(result.checkedAuditWorkflows >= 2);
});
