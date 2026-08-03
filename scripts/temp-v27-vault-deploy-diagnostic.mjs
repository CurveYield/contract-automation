import fs from 'node:fs/promises';
import path from 'node:path';

import { ethers } from 'ethers';
import { startForkRpcProxy } from '../packages/github-native-sim/src/fork-rpc-proxy.mjs';
import { getGenesisBlockFixture } from '../packages/github-native-sim/src/chain-fixtures.mjs';
import { getDeterministicGanacheAccounts } from '../packages/github-native-sim/src/ganache-accounts.mjs';
import { startGanacheEngine } from '../packages/runner/src/engine.mjs';

const SDYB = '0x0c057598dcE1891688829581f890DD2a3685a43f';
const BLOCK = 25_660_886;
const rpcUrl = process.env.RPC_ETHEREUM;
const resultRoot = process.argv[2];
const outputFile = process.argv[3] ?? 'v27-vault-deploy-diagnostic.json';

if (!rpcUrl) throw new Error('RPC_ETHEREUM is missing');
if (!resultRoot) throw new Error('Usage: node script <attempt-result-root> [output-file]');

function errorJson(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code,
    shortMessage: error?.shortMessage,
    reason: error?.reason,
    data: error?.data,
    info: error?.info,
    receipt: error?.receipt ? {
      hash: error.receipt.hash,
      blockNumber: error.receipt.blockNumber,
      status: error.receipt.status,
      gasUsed: error.receipt.gasUsed?.toString()
    } : undefined,
    cause: error?.cause ? errorJson(error.cause) : undefined
  };
}

const index = JSON.parse(await fs.readFile(path.join(resultRoot, 'artifacts', 'index.json'), 'utf8'));
const entry = index.find((item) => item.contractName === 'CurveYieldSdYBHybridVaultV27');
if (!entry) throw new Error('Vault artifact not found');
const artifact = JSON.parse(await fs.readFile(path.join(resultRoot, 'artifacts', entry.file), 'utf8'));

const diagnostics = {
  block: BLOCK,
  artifact: {
    sourceName: artifact.sourceName,
    contractName: artifact.contractName,
    creationBytes: (artifact.creationBytecode.length - 2) / 2,
    runtimeBytes: (artifact.runtimeBytecode.length - 2) / 2
  },
  stages: {}
};

let proxy;
let engine;
try {
  const [localAccounts, genesisBlock] = await Promise.all([
    getDeterministicGanacheAccounts(20),
    getGenesisBlockFixture(1)
  ]);
  proxy = await startForkRpcProxy({
    upstreamUrl: rpcUrl,
    block: BLOCK,
    chainId: 1,
    genesisBlock,
    localAccounts
  });
  engine = await startGanacheEngine({
    artifacts: { get() { throw new Error('not used'); } },
    workflow: { steps: [] },
    chainId: 1,
    forkUrl: proxy.url,
    block: proxy.blockNumber
  });

  const provider = engine.provider;
  const signer = await provider.getSigner(0);
  const sender = await signer.getAddress();
  diagnostics.sender = sender;
  diagnostics.senderBalance = (await provider.getBalance(sender)).toString();
  diagnostics.sdYbCodeBytes = Math.max(0, ((await provider.getCode(SDYB))?.length - 2) / 2);

  const token = new ethers.Contract(SDYB, [
    'function decimals() view returns (uint8)',
    'function name() view returns (string)',
    'function symbol() view returns (string)'
  ], signer);
  for (const [name, operation] of [
    ['decimals', () => token.decimals()],
    ['name', () => token.name()],
    ['symbol', () => token.symbol()]
  ]) {
    try {
      const value = await operation();
      diagnostics.stages[name] = { ok: true, value: typeof value === 'bigint' ? value.toString() : value };
    } catch (error) {
      diagnostics.stages[name] = { ok: false, error: errorJson(error) };
    }
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.creationBytecode, signer);
  const deployRequest = await factory.getDeployTransaction(
    SDYB,
    'CurveYield V27 Functional Smoke Vault',
    sender
  );
  diagnostics.creationDataBytes = (deployRequest.data.length - 2) / 2;

  try {
    const estimate = await provider.estimateGas({ ...deployRequest, from: sender });
    diagnostics.stages.estimateGas = { ok: true, gas: estimate.toString() };
  } catch (error) {
    diagnostics.stages.estimateGas = { ok: false, error: errorJson(error) };
  }

  try {
    const returned = await provider.call({ ...deployRequest, from: sender, gasLimit: 25_000_000n });
    diagnostics.stages.ethCall = {
      ok: true,
      returnedBytes: Math.max(0, (returned.length - 2) / 2),
      prefix: returned.slice(0, 130)
    };
  } catch (error) {
    diagnostics.stages.ethCall = { ok: false, error: errorJson(error) };
  }

  try {
    const transaction = await signer.sendTransaction({ ...deployRequest, gasLimit: 25_000_000n });
    diagnostics.stages.send = { ok: true, hash: transaction.hash };
    try {
      const receipt = await transaction.wait();
      diagnostics.stages.receipt = {
        ok: receipt.status === 1,
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        contractAddress: receipt.contractAddress
      };
    } catch (error) {
      diagnostics.stages.receipt = { ok: false, error: errorJson(error) };
    }
  } catch (error) {
    diagnostics.stages.send = { ok: false, error: errorJson(error) };
  }

  diagnostics.forkTransport = proxy.diagnostics;
} catch (error) {
  diagnostics.fatal = errorJson(error);
  diagnostics.forkTransport = proxy?.diagnostics;
} finally {
  await engine?.close().catch(() => {});
  await proxy?.close().catch(() => {});
}

await fs.writeFile(outputFile, `${JSON.stringify(diagnostics, null, 2)}\n`);
console.log(JSON.stringify(diagnostics, null, 2));
