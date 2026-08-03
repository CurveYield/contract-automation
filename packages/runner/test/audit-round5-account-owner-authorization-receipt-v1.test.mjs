import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const RECEIPT_PATH = 'docs/audit/round5/account-owner-authorization-receipt-v1.json';

function sorted(values) {
  return [...values].sort();
}

test('Round 5 account-owner authorization receipt opens only the bounded Ethereum and Base execution gates', () => {
  assert.ok(existsSync(RECEIPT_PATH), `missing authorization receipt: ${RECEIPT_PATH}`);
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));

  assert.equal(receipt.schemaVersion, 'round5-account-owner-authorization-receipt-v1');
  assert.equal(receipt.releaseBindingId, 'round5-release-source-3da6b10-v1');
  assert.equal(receipt.authorizer, 'account-owner');
  assert.equal(receipt.authorizationStatus, 'AUTHORIZED');
  assert.equal(receipt.authorizedPreparationHeadSha, 'a76ebe0d0cda7fbce570acd404c7c7a9cb42ac8a');
  assert.equal(receipt.promotedRound4MergeSha, '42a54988b7b5135ddb6cba90891ad2706356363c');

  assert.deepEqual(receipt.authorizedGates, [
    'promotion',
    'credential-name-readiness',
    'bounded-trusted-deployment',
    'bounded-live-production-testing'
  ]);
  assert.deepEqual(receipt.activeNetworks, ['base', 'ethereum']);
  assert.deepEqual(sorted(receipt.deferredNetworks), sorted([
    'arbitrum',
    'fraxtal',
    'katana',
    'optimism',
    'polygon'
  ]));

  assert.equal(receipt.credentialConfirmation.namesOnly, true);
  assert.equal(receipt.credentialConfirmation.secretValuesReadOrRecorded, false);
  assert.equal(receipt.credentialConfirmation.requiredActiveSecretNameCount, 11);
  assert.equal(receipt.credentialConfirmation.requiredRepositoryVariableNameCount, 3);
  assert.equal(receipt.credentialConfirmation.accountOwnerConfirmedConfigured, true);

  assert.equal(receipt.limits.deferredNetworkTestingAllowed, false);
  assert.equal(receipt.limits.scopeExpansionAllowed, false);
  assert.equal(receipt.limits.walletSigningAllowed, false);
  assert.equal(receipt.limits.publicTransactionBroadcastAllowed, false);
  assert.equal(receipt.limits.secretDisclosureAllowed, false);
  assert.equal(receipt.limits.destructiveIrreplaceableDataTestingAllowed, false);
  assert.equal(receipt.limits.workflowRerunAuthorization, false);

  assert.equal(receipt.executionState.deploymentExecuted, false);
  assert.equal(receipt.executionState.liveProductionTestingExecuted, false);
  assert.equal(receipt.executionState.trustedV27RegressionExecuted, false);
});
