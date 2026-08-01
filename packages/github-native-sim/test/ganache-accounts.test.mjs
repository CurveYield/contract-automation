import test from 'node:test';
import assert from 'node:assert/strict';

import { getDeterministicGanacheAccounts } from '../src/ganache-accounts.mjs';

test('discovers the accounts created by the unchanged deterministic Ganache engine', async () => {
  const accounts = await getDeterministicGanacheAccounts(20);
  assert.equal(accounts.length, 20);
  assert.equal(accounts[0], '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1');
  assert.equal(new Set(accounts).size, 20);
});
