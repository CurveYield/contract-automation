import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE4_PROFILE_CATALOG,
  listPhase4Profiles
} from '../packages/audit-tool-catalog/src/index.mjs';

const FORBIDDEN_OUTPUT_FIELDS = new Set([
  'shell','command','commands','script','scripts','image','containerImage','customImage','binary','url','rpc','rpcUrl',
  'privateKey','wallet','signer','signing','transaction','rawTransaction','signedTransaction','broadcast','packageManagerCommand'
]);

function scan(value, path = '$') {
  if (Array.isArray(value)) { value.forEach((child, index) => scan(child, `${path}[${index}]`)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(FORBIDDEN_OUTPUT_FIELDS.has(key), false, `${path}.${key}`);
    scan(child, `${path}.${key}`);
  }
}

test('catalog output contains no execution, secret, network, transaction, or fabricated digest fields', () => {
  const profiles = listPhase4Profiles(PHASE4_PROFILE_CATALOG);
  scan(profiles);
  for (const profile of profiles) {
    assert.equal(profile.executionEnabled, false);
    assert.equal(profile.executorState, 'unavailable');
    assert.equal(profile.digestRequired, true);
    assert.equal('registryArtifact' in profile, false);
    assert.equal(JSON.stringify(profile).includes('sha256:'), false);
  }
});
