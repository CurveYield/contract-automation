import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const FIXTURES = Object.freeze({
  1: {
    url: new URL('../fixtures/ethereum-genesis-rpc-response.json', import.meta.url),
    sha256: 'ae6dd66d62573f30f3fd866fab7077a935a18e5b0c8ad1908065f578cf187e20',
    blockHash: '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3'
  }
});

const cache = new Map();

async function loadFixture(chainId, fixture) {
  const text = await fs.readFile(fixture.url, 'utf8');
  const digest = crypto.createHash('sha256').update(text).digest('hex');
  if (digest !== fixture.sha256) {
    throw new Error(`Genesis fixture integrity check failed for chain ${chainId}`);
  }

  const decoded = JSON.parse(text);
  const block = decoded?.result;
  if (block?.number !== '0x0' || block?.hash !== fixture.blockHash || !Array.isArray(block.transactions)) {
    throw new Error(`Genesis fixture content is invalid for chain ${chainId}`);
  }
  return Object.freeze(block);
}

export async function getGenesisBlockFixture(chainId) {
  const fixture = FIXTURES[chainId];
  if (!fixture) return undefined;
  if (!cache.has(chainId)) cache.set(chainId, loadFixture(chainId, fixture));
  return structuredClone(await cache.get(chainId));
}
