import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSimulationConfig } from '../src/simulation-config.mjs';

test('accepts remote-rpc as a first-class engine without local fallback', () => {
  const config = validateSimulationConfig({
    engine: {
      mode: 'remote-rpc',
      preference: ['remote-rpc'],
      fallbackOn: [],
      engines: []
    }
  });

  assert.equal(config.engine.mode, 'remote-rpc');
  assert.deepEqual(config.engine.preference, ['remote-rpc']);
});
