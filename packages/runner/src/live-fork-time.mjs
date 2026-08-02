function requireInteger(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function parseQuantity(value, name) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)) {
    const parsed = Number.parseInt(value.slice(2), 16);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  throw new Error(`Local fork returned invalid ${name}`);
}

export async function latestBlock(provider) {
  const block = await provider.send('eth_getBlockByNumber', ['latest', false]);
  if (!block || typeof block !== 'object') {
    throw new Error('Local fork returned invalid latest block metadata');
  }
  return {
    number: parseQuantity(block.number, 'latest block number'),
    timestamp: parseQuantity(block.timestamp, 'latest block timestamp')
  };
}

export async function latestBlockNumber(provider) {
  return parseQuantity(await provider.send('eth_blockNumber', []), 'block number');
}

export async function setNextTimestamp(provider, timestamp) {
  requireInteger(timestamp, 'timestamp');
  try {
    await provider.send('evm_setNextBlockTimestamp', [timestamp]);
    return 'evm_setNextBlockTimestamp';
  } catch (firstError) {
    try {
      await provider.send('evm_setTime', [timestamp * 1_000]);
      return 'evm_setTime';
    } catch {
      throw firstError;
    }
  }
}

export async function mineBlocks(provider, { blocks = 1, intervalSeconds } = {}) {
  requireInteger(blocks, 'blocks', { min: 1, max: 10_000 });
  if (intervalSeconds === undefined) {
    for (let index = 0; index < blocks; index += 1) await provider.send('evm_mine', []);
    return { blocks };
  }
  requireInteger(intervalSeconds, 'intervalSeconds');
  let { timestamp } = await latestBlock(provider);
  for (let index = 0; index < blocks; index += 1) {
    timestamp += intervalSeconds;
    await setNextTimestamp(provider, timestamp);
    await provider.send('evm_mine', []);
  }
  return { blocks, intervalSeconds };
}

export async function mineUntilTimestamp(provider, { timestamp: target, intervalSeconds = 1 }) {
  requireInteger(target, 'timestamp');
  requireInteger(intervalSeconds, 'intervalSeconds', { min: 1 });
  let { timestamp } = await latestBlock(provider);
  if (target < timestamp) throw new Error(`Target timestamp ${target} is behind local timestamp ${timestamp}`);
  let blocks = 0;
  while (timestamp < target) {
    if (blocks >= 10_000) throw new Error('mineUntilTimestamp exceeds 10000 blocks');
    timestamp = Math.min(target, timestamp + intervalSeconds);
    await setNextTimestamp(provider, timestamp);
    await provider.send('evm_mine', []);
    blocks += 1;
  }
  return { timestamp: target, intervalSeconds, blocks };
}

export async function advanceToBlock(provider, { blockNumber: target, intervalSeconds }) {
  requireInteger(target, 'blockNumber');
  const current = await latestBlockNumber(provider);
  if (target < current) throw new Error(`Target block ${target} is behind local block ${current}; use refork`);
  const blocks = target - current;
  if (blocks > 10_000) throw new Error('advanceToBlock exceeds 10000 blocks');
  if (blocks === 0) return { blockNumber: target, blocks: 0, intervalSeconds };
  const mined = await mineBlocks(provider, { blocks, intervalSeconds });
  return { blockNumber: target, ...mined };
}

export async function setAutomine(provider, enabled) {
  if (typeof enabled !== 'boolean') throw new Error('enabled must be boolean');
  await provider.send('evm_setAutomine', [enabled]);
  return { enabled, method: 'evm_setAutomine' };
}

export async function setIntervalMining(provider, intervalMilliseconds) {
  requireInteger(intervalMilliseconds, 'intervalMilliseconds', { max: 86_400_000 });
  await provider.send('evm_setIntervalMining', [intervalMilliseconds]);
  return { intervalMilliseconds };
}
