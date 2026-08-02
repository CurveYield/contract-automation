import crypto from 'node:crypto';

function normalize(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])])
    );
  }
  return value;
}

export function hashCanonical(value) {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex')}`;
}

export function makeSimulationCallId(index, descriptor) {
  if (!Number.isInteger(index) || index < 1) throw new Error('call index must be a positive integer');
  return `${String(index).padStart(4, '0')}-${hashCanonical(descriptor).slice(2, 14)}`;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function diffEntitySnapshots(before, after) {
  const output = {};

  function visit(left, right, path = '') {
    if (isObject(left) && isObject(right)) {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
      for (const key of keys) {
        const nextPath = path ? `${path}.${key}` : key;
        if (!(key in left)) {
          output[nextPath] = { before: null, after: normalize(right[key]) };
        } else if (!(key in right)) {
          output[nextPath] = { before: normalize(left[key]), after: null };
        } else {
          visit(left[key], right[key], nextPath);
        }
      }
      return;
    }

    const normalizedLeft = normalize(left);
    const normalizedRight = normalize(right);
    if (JSON.stringify(normalizedLeft) !== JSON.stringify(normalizedRight)) {
      output[path] = { before: normalizedLeft ?? null, after: normalizedRight ?? null };
    }
  }

  visit(before ?? {}, after ?? {});
  return output;
}

export function appendJournal(previousHash, entry) {
  if (typeof previousHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(previousHash)) {
    throw new Error('previousHash must be a 32-byte hex hash');
  }
  return hashCanonical({ previousHash: previousHash.toLowerCase(), entry });
}

export function normalizeReceipt(receipt) {
  const effectiveGasPrice = receipt?.effectiveGasPrice ?? receipt?.gasPrice;
  return {
    transactionHash: receipt?.hash ?? receipt?.transactionHash ?? null,
    blockHash: receipt?.blockHash ?? null,
    blockNumber: receipt?.blockNumber ?? null,
    status: receipt?.status ?? null,
    gasUsed: receipt?.gasUsed?.toString?.() ?? (receipt?.gasUsed == null ? null : String(receipt.gasUsed)),
    cumulativeGasUsed: receipt?.cumulativeGasUsed?.toString?.()
      ?? (receipt?.cumulativeGasUsed == null ? null : String(receipt.cumulativeGasUsed)),
    effectiveGasPrice: effectiveGasPrice?.toString?.()
      ?? (effectiveGasPrice == null ? null : String(effectiveGasPrice)),
    contractAddress: receipt?.contractAddress ?? null,
    from: receipt?.from ?? null,
    to: receipt?.to ?? null,
    logs: (receipt?.logs ?? []).map((log) => ({
      address: log.address,
      topics: [...(log.topics ?? [])],
      data: log.data,
      index: log.index ?? log.logIndex ?? null
    }))
  };
}

const REQUIRED_CALL_RECORD_FIELDS = Object.freeze([
  'simulationCallId',
  'callIndex',
  'label',
  'method',
  'sender',
  'target',
  'calldata',
  'calldataHash',
  'blockContext',
  'gasLimit',
  'receipt',
  'returnData',
  'rawLogs',
  'decodedLogs',
  'localTrace',
  'traceHash',
  'beforeSnapshotHash',
  'afterSnapshotHash',
  'stateDiff',
  'stateDiffHash',
  'preJournalHash',
  'postJournalHash'
]);

export function assertRequiredCallRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('call record must be an object');
  }
  for (const field of REQUIRED_CALL_RECORD_FIELDS) {
    if (!(field in record)) throw new Error(`call record is missing required field: ${field}`);
  }
  return record;
}

export { normalize as normalizeCanonicalValue };
