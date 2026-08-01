import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPublishedPhase5ProfileContract,
  validatePhase5ProfileConfiguration,
  validatePublishedPhase5ProfileContract
} from '../src/index.mjs';

const digest = `sha256:${'a'.repeat(64)}`;
const publishedAt = '2026-08-01T10:00:00.000Z';
const hardhatConfiguration = {
  testFiles: ['test/**/*.test.mjs'],
  grep: 'critical path',
  bail: false,
  parallel: false,
  concurrency: 1
};

function captureCode(callback) {
  try {
    callback();
  } catch (error) {
    return error?.code;
  }
  return null;
}

test('P5-R01 publication input is an exact recursively scanned plain object', () => {
  assert.equal(
    captureCode(() => createPublishedPhase5ProfileContract('hardhat-test-v1', {
      digest,
      publishedAt,
      executionEnabled: true
    })),
    'unknown_field'
  );

  assert.equal(
    captureCode(() => createPublishedPhase5ProfileContract('hardhat-test-v1', {
      digest: { metadata: { apiKey: 'api-example' } },
      publishedAt
    })),
    'forbidden_field'
  );

  class Publication {
    constructor() {
      this.digest = digest;
      this.publishedAt = publishedAt;
    }
  }
  assert.equal(
    captureCode(() => createPublishedPhase5ProfileContract('hardhat-test-v1', new Publication())),
    'invalid_type'
  );

  const customPrototype = Object.create({ inherited: true });
  customPrototype.digest = digest;
  customPrototype.publishedAt = publishedAt;
  assert.equal(
    captureCode(() => createPublishedPhase5ProfileContract('hardhat-test-v1', customPrototype)),
    'invalid_type'
  );

  const nullPrototype = Object.create(null);
  nullPrototype.digest = digest;
  nullPrototype.publishedAt = publishedAt;
  const contract = createPublishedPhase5ProfileContract('hardhat-test-v1', nullPrototype);
  assert.equal(contract.executionEnabled, false);
  assert.equal(contract.executorState, 'unavailable');
  assert.equal(contract.registryArtifact.digest, digest);
});

test('P5-R02 profile external object boundaries reject arbitrary prototypes', () => {
  class Configuration {
    constructor() {
      Object.assign(this, hardhatConfiguration);
    }
  }
  assert.equal(
    captureCode(() => validatePhase5ProfileConfiguration('hardhat-test-v1', new Configuration())),
    'invalid_type'
  );

  const customConfiguration = Object.assign(Object.create({ inherited: true }), hardhatConfiguration);
  assert.equal(
    captureCode(() => validatePhase5ProfileConfiguration('hardhat-test-v1', customConfiguration)),
    'invalid_type'
  );

  const valid = createPublishedPhase5ProfileContract('hardhat-test-v1', { digest, publishedAt });
  const customContract = Object.assign(Object.create({ inherited: true }), structuredClone(valid));
  assert.equal(captureCode(() => validatePublishedPhase5ProfileContract(customContract)), 'invalid_type');

  const nestedPrototypeContract = structuredClone(valid);
  nestedPrototypeContract.tool = Object.assign(Object.create({ inherited: true }), nestedPrototypeContract.tool);
  assert.equal(captureCode(() => validatePublishedPhase5ProfileContract(nestedPrototypeContract)), 'invalid_type');

  const nullConfiguration = Object.assign(Object.create(null), hardhatConfiguration);
  assert.deepEqual(validatePhase5ProfileConfiguration('hardhat-test-v1', nullConfiguration), hardhatConfiguration);
});
