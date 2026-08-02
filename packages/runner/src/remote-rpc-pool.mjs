import crypto from 'node:crypto';

function normalizedChainToken(chainName) {
  if (typeof chainName !== 'string' || chainName.length === 0) {
    throw new Error('A chain name is required to load remote Anvil RPC slots');
  }
  return chainName.toUpperCase().replaceAll(/[^A-Z0-9]/g, '_');
}

function createSlot({ chainName, index, secretName, url }) {
  const slot = {
    id: `anvil-${chainName}-${index}`,
    chainName,
    index,
    secretName,
    toJSON() {
      return {
        id: this.id,
        chainName: this.chainName,
        index: this.index,
        secretName: this.secretName
      };
    }
  };
  Object.defineProperty(slot, 'url', {
    value: url,
    enumerable: false,
    writable: false,
    configurable: false
  });
  return Object.freeze(slot);
}

export function loadRemoteRpcSlots({ chainName, environment = process.env }) {
  const token = normalizedChainToken(chainName);
  const pattern = new RegExp(`^RPC_ANVIL_${token}(\\d+)$`);
  const matches = [];

  for (const [secretName, value] of Object.entries(environment ?? {})) {
    const match = secretName.match(pattern);
    if (!match || typeof value !== 'string' || value.trim().length === 0) continue;
    const index = Number(match[1]);
    if (!Number.isSafeInteger(index) || index < 1) continue;
    matches.push({ index, secretName, url: value.trim() });
  }

  matches.sort((left, right) => left.index - right.index);
  return matches.map((entry) => createSlot({ chainName, ...entry }));
}

export function selectRemoteRpcSlot(slots, { stickyKey }) {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error('No trusted remote Anvil RPC slots are configured');
  }
  if (typeof stickyKey !== 'string' || stickyKey.length === 0) {
    throw new Error('A sticky key is required to select a remote Anvil RPC slot');
  }
  const digest = crypto.createHash('sha256').update(stickyKey).digest();
  const index = digest.readUInt32BE(0) % slots.length;
  return slots[index];
}
