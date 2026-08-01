import test from 'node:test';
import assert from 'node:assert/strict';

import { getGenesisBlockFixture } from '../src/chain-fixtures.mjs';

test('loads the canonical Ethereum genesis block fixture', async () => {
  const fixture = await getGenesisBlockFixture(1);
  assert.equal(fixture.number, '0x0');
  assert.equal(fixture.hash, '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3');
  assert.equal(fixture.stateRoot, '0xd7f8974fb5ac78d9ac099b9ad5018bedc2ce0a72dad1827a1709da30580f0544');
  assert.deepEqual(fixture.transactions, []);
});

test('returns no fixture for chains that have not been captured', async () => {
  assert.equal(await getGenesisBlockFixture(8453), undefined);
});
