import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const AMENDMENT_PATH = 'docs/audit/round5/production-network-scope-amendment-v1.json';
const RELEASE_BINDING_ID = 'round5-release-source-3da6b10-v1';

const REQUIRED_ACTIVE_SECRETS = Object.freeze([
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'PREFLIGHTSIM_CLIENT_API_KEY',
  'PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY',
  'PREFLIGHTSIM_GITHUB_TOKEN',
  'PREFLIGHTSIM_GPT_API_KEY',
  'PREFLIGHTSIM_R2_ACCESS_KEY_ID',
  'PREFLIGHTSIM_R2_SECRET_ACCESS_KEY',
  'PREFLIGHTSIM_RUNNER_API_KEY',
  'RPC_BASE',
  'RPC_ETHEREUM'
]);

const DEFERRED_RPC_SECRETS = Object.freeze([
  'RPC_ARBITRUM',
  'RPC_FRAXTAL',
  'RPC_KATANA',
  'RPC_OPTIMISM',
  'RPC_POLYGON'
]);

const ACTIVE_NETWORKS = Object.freeze([
  ['base', 8453, 'RPC_BASE'],
  ['ethereum', 1, 'RPC_ETHEREUM']
]);

const DEFERRED_NETWORKS = Object.freeze([
  ['arbitrum', 42161, 'RPC_ARBITRUM'],
  ['fraxtal', 252, 'RPC_FRAXTAL'],
  ['katana', 747474, 'RPC_KATANA'],
  ['optimism', 10, 'RPC_OPTIMISM'],
  ['polygon', 137, 'RPC_POLYGON']
]);

function sorted(values) {
  return [...values].sort();
}

test('Round 5 account-owner amendment limits current production testing to Ethereum and Base', () => {
  assert.ok(existsSync(AMENDMENT_PATH), `missing account-owner scope amendment: ${AMENDMENT_PATH}`);
  const amendment = JSON.parse(readFileSync(AMENDMENT_PATH, 'utf8'));

  assert.equal(amendment.schemaVersion, 'round5-production-network-scope-amendment-v1');
  assert.equal(amendment.releaseBindingId, RELEASE_BINDING_ID);
  assert.equal(amendment.authorizedBy, 'account-owner');
  assert.equal(amendment.authorizationStatus, 'AUTHORIZED');
  assert.equal(amendment.effectiveImmediately, true);

  assert.deepEqual(
    amendment.activeReadOnlyRpcNetworks.map((entry) => [entry.network, entry.chainId, entry.secretName]),
    ACTIVE_NETWORKS
  );
  assert.deepEqual(
    amendment.deferredReadOnlyRpcNetworks.map((entry) => [entry.network, entry.chainId, entry.secretName]),
    DEFERRED_NETWORKS
  );

  assert.deepEqual(sorted(amendment.requiredSecretNamesNow), sorted(REQUIRED_ACTIVE_SECRETS));
  assert.deepEqual(sorted(amendment.deferredSecretNames), sorted(DEFERRED_RPC_SECRETS));
  assert.equal(
    amendment.requiredSecretNamesNow.some((name) => amendment.deferredSecretNames.includes(name)),
    false
  );

  assert.equal(amendment.policy.missingDeferredRpcSecretsFailCurrentReadiness, false);
  assert.equal(amendment.policy.deferredNetworksMayBeTested, false);
  assert.equal(amendment.policy.futureActivationRequiresNewAccountOwnerAuthorization, true);
  assert.equal(amendment.policy.transactionBroadcastAllowed, false);
  assert.equal(amendment.policy.signingAllowed, false);
  assert.equal(amendment.policy.rawRpcUrlsMayBeRecorded, false);

  assert.ok(amendment.supersedesForCurrentRound5Execution.includes('seven-network-rpc-name-readiness-confirmed'));
  assert.ok(amendment.supersedesForCurrentRound5Execution.includes('seven-network-read-only-rpc-name-readiness-report'));
  assert.equal(amendment.currentRpcReadinessRequirement, 'ethereum-and-base-rpc-name-readiness-confirmed');
});
