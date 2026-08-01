import fs from 'node:fs/promises';
import path from 'node:path';

import {
  appendJournal,
  assertRequiredCallRecord,
  diffEntitySnapshots,
  hashCanonical,
  makeSimulationCallId,
  normalizeReceipt
} from '../../../../packages/github-native-sim/src/local-state-journal.mjs';

function textError(cause) {
  return {
    name: cause?.name ?? 'Error',
    message: [cause?.shortMessage, cause?.reason, cause?.message].filter(Boolean).join(' | ') || String(cause),
    code: cause?.code,
    data: cause?.data,
    transactionHash: cause?.transactionHash ?? cause?.receipt?.hash ?? null
  };
}

function fileLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'call';
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`);
}

function decodeLogs(logs, interfaces) {
  const output = [];
  for (const log of logs ?? []) {
    let decoded = null;
    for (const [name, iface] of interfaces) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (!parsed) continue;
        decoded = {
          interface: name,
          event: parsed.name,
          signature: parsed.signature,
          args: parsed.args?.toObject?.() ?? [...(parsed.args ?? [])]
        };
        break;
      } catch {}
    }
    output.push({
      address: log.address,
      topics: [...(log.topics ?? [])],
      data: log.data,
      index: log.index ?? log.logIndex ?? null,
      decoded
    });
  }
  return output;
}

async function localTrace(provider, transactionHash) {
  if (!transactionHash) return { unavailable: true, reason: 'transaction hash unavailable' };
  try {
    return await provider.send('debug_traceTransaction', [transactionHash, {
      tracer: 'callTracer',
      tracerConfig: { withLog: true }
    }]);
  } catch (callTracerError) {
    try {
      const trace = await provider.send('debug_traceTransaction', [transactionHash, {
        disableMemory: true,
        disableStack: false,
        disableStorage: true,
        enableReturnData: true
      }]);
      return { fallback: 'structLogger', callTracerError: textError(callTracerError), trace };
    } catch (structLoggerError) {
      return {
        unavailable: true,
        callTracerError: textError(callTracerError),
        structLoggerError: textError(structLoggerError)
      };
    }
  }
}

export function createGanacheCallRecorder({
  provider,
  observer,
  outputDir,
  baseBlock,
  interfaces = [],
  defaultGasLimit = 100_000_000n
}) {
  let callIndex = 0;
  let journalHash = `0x${'00'.repeat(32)}`;
  const calls = [];
  const snapshots = [];

  async function saveSnapshot(kind, label, index, snapshot) {
    const file = path.join(outputDir, 'snapshots', `${String(index).padStart(4, '0')}-${kind}-${fileLabel(label)}.json`);
    await writeJson(file, snapshot);
    snapshots.push({ kind, label, callIndex: index, file: path.relative(outputDir, file), hash: hashCanonical(snapshot) });
    return file;
  }

  async function persistRecord(record) {
    assertRequiredCallRecord(record);
    calls.push(record);
    const file = path.join(outputDir, 'calls', `${String(record.callIndex).padStart(4, '0')}-${fileLabel(record.label)}.json`);
    await writeJson(file, record);
    return record;
  }

  async function transact({ label, signer, sender, target, calldata, value = 0n, gasLimit = defaultGasLimit, expectedRevert = false }) {
    callIndex += 1;
    const descriptor = { label, sender, target, calldata, value: value.toString() };
    const simulationCallId = makeSimulationCallId(callIndex, descriptor);
    const preJournalHash = journalHash;
    const before = await observer(`${label}:before`);
    await saveSnapshot('before', label, callIndex, before);

    let transaction = null;
    let receipt = null;
    let failure = null;
    try {
      transaction = await signer.sendTransaction({
        to: target || undefined,
        data: calldata,
        value,
        gasLimit
      });
      receipt = await transaction.wait();
      if (expectedRevert) failure = new Error(`${label}: expected revert but transaction succeeded`);
    } catch (cause) {
      failure = cause;
      receipt = cause?.receipt ?? null;
      if (!expectedRevert && transaction?.hash && !receipt) {
        try { receipt = await provider.getTransactionReceipt(transaction.hash); } catch {}
      }
    }

    const transactionHash = transaction?.hash ?? receipt?.hash ?? failure?.transactionHash ?? failure?.receipt?.hash ?? null;
    const trace = await localTrace(provider, transactionHash);
    const after = await observer(`${label}:after`);
    await saveSnapshot('after', label, callIndex, after);
    const stateDiff = diffEntitySnapshots(before, after);
    const stateDiffHash = hashCanonical(stateDiff);
    const postJournalHash = expectedRevert ? preJournalHash : appendJournal(preJournalHash, {
      simulationCallId,
      transactionHash,
      stateDiffHash,
      receiptStatus: receipt?.status ?? null
    });
    if (!expectedRevert) journalHash = postJournalHash;

    const rawLogs = normalizeReceipt(receipt).logs;
    const decodedLogs = decodeLogs(receipt?.logs ?? [], interfaces);
    const record = {
      simulationCallId,
      callIndex,
      label,
      method: 'eth_sendTransaction',
      sender,
      target,
      calldata,
      calldataHash: hashCanonical(calldata),
      value: value.toString(),
      blockContext: {
        baseBlock,
        beforeNumber: before.block?.number ?? null,
        beforeTimestamp: before.block?.timestamp ?? null,
        number: after.block?.number ?? receipt?.blockNumber ?? null,
        timestamp: after.block?.timestamp ?? null,
        blockHash: receipt?.blockHash ?? after.block?.hash ?? null
      },
      gasLimit: gasLimit.toString(),
      receipt: normalizeReceipt(receipt),
      returnData: trace?.output ?? trace?.returnValue ?? trace?.trace?.returnValue ?? failure?.data ?? '0x',
      rawLogs,
      decodedLogs,
      localTrace: trace,
      traceHash: hashCanonical(trace),
      beforeSnapshotHash: hashCanonical(before),
      afterSnapshotHash: hashCanonical(after),
      stateDiff,
      stateDiffHash,
      preJournalHash,
      postJournalHash,
      expectedRevert,
      observedRevert: Boolean(failure && expectedRevert),
      error: failure ? textError(failure) : null
    };
    await persistRecord(record);

    if (expectedRevert) {
      if (!failure) throw new Error(`${label}: expected revert but transaction succeeded`);
      return record;
    }
    if (failure) {
      const error = new Error(`${label}: local transaction failed: ${textError(failure).message}`);
      error.callRecord = record;
      throw error;
    }
    return record;
  }

  async function contractCall({ label, contract, signer, sender, signature, args = [], value = 0n, gasLimit }) {
    const target = String(contract.target);
    const calldata = contract.interface.encodeFunctionData(signature, args);
    return transact({ label, signer, sender, target, calldata, value, gasLimit });
  }

  async function deploy({ label, factory, signer, sender, args = [], value = 0n, gasLimit }) {
    const request = await factory.getDeployTransaction(...args, { value });
    const record = await transact({
      label,
      signer,
      sender,
      target: null,
      calldata: request.data,
      value,
      gasLimit
    });
    const address = record.receipt.contractAddress;
    if (!address) throw new Error(`${label}: deployment receipt did not contain a contract address`);
    return { record, address, contract: factory.attach(address) };
  }

  async function expectRevert({ label, contract, signer, sender, signature, args = [], value = 0n, gasLimit }) {
    const snapshotId = await provider.send('evm_snapshot', []);
    try {
      const calldata = contract.interface.encodeFunctionData(signature, args);
      return await transact({
        label,
        signer,
        sender,
        target: String(contract.target),
        calldata,
        value,
        gasLimit,
        expectedRevert: true
      });
    } finally {
      const reverted = await provider.send('evm_revert', [snapshotId]);
      if (!reverted) throw new Error(`${label}: could not revert expected-revert branch snapshot`);
    }
  }

  async function advanceTime({ label, seconds, blocks = 1 }) {
    callIndex += 1;
    const simulationCallId = makeSimulationCallId(callIndex, { label, seconds, blocks });
    const preJournalHash = journalHash;
    const before = await observer(`${label}:before`);
    await saveSnapshot('before', label, callIndex, before);
    const increaseResult = await provider.send('evm_increaseTime', [seconds]);
    const mineResults = [];
    for (let index = 0; index < blocks; index += 1) mineResults.push(await provider.send('evm_mine', []));
    const after = await observer(`${label}:after`);
    await saveSnapshot('after', label, callIndex, after);
    const stateDiff = diffEntitySnapshots(before, after);
    const stateDiffHash = hashCanonical(stateDiff);
    const postJournalHash = appendJournal(preJournalHash, { simulationCallId, seconds, blocks, stateDiffHash });
    journalHash = postJournalHash;
    return persistRecord({
      simulationCallId,
      callIndex,
      label,
      method: 'evm_increaseTime+evm_mine',
      sender: 'ganache-local-controller',
      target: null,
      calldata: JSON.stringify({ seconds, blocks }),
      calldataHash: hashCanonical({ seconds, blocks }),
      value: '0',
      blockContext: {
        baseBlock,
        beforeNumber: before.block?.number ?? null,
        beforeTimestamp: before.block?.timestamp ?? null,
        number: after.block?.number ?? null,
        timestamp: after.block?.timestamp ?? null,
        blockHash: after.block?.hash ?? null
      },
      gasLimit: '0',
      receipt: normalizeReceipt(null),
      returnData: JSON.stringify({ increaseResult, mineResults }),
      rawLogs: [],
      decodedLogs: [],
      localTrace: { increaseResult, mineResults },
      traceHash: hashCanonical({ increaseResult, mineResults }),
      beforeSnapshotHash: hashCanonical(before),
      afterSnapshotHash: hashCanonical(after),
      stateDiff,
      stateDiffHash,
      preJournalHash,
      postJournalHash
    });
  }

  async function checkpoint(label) {
    const snapshot = await observer(label);
    const index = callIndex;
    await saveSnapshot('checkpoint', label, index, snapshot);
    return snapshot;
  }

  return {
    transact,
    contractCall,
    deploy,
    expectRevert,
    advanceTime,
    checkpoint,
    async snapshot() { return provider.send('evm_snapshot', []); },
    async revert(snapshotId) {
      const reverted = await provider.send('evm_revert', [snapshotId]);
      if (!reverted) throw new Error(`Could not revert Ganache snapshot ${snapshotId}`);
      return reverted;
    },
    get calls() { return [...calls]; },
    get snapshots() { return [...snapshots]; },
    get journalHash() { return journalHash; },
    get callIndex() { return callIndex; }
  };
}
