import fs from 'node:fs/promises';
import solc from 'solc';
import { Interface } from 'ethers';

const url = process.env.RPC_ANVIL_ETHEREUM1;
const proofPath = process.env.PROOF_PATH ?? '/tmp/remote-anvil-proof.json';
if (!url) throw new Error('RPC_ANVIL_ETHEREUM1 is not configured');

let requestId = 0;
async function rpc(method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params })
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${method} returned invalid JSON`);
  }
  if (!response.ok || payload.error) {
    const code = payload.error?.code ?? response.status;
    const message = payload.error?.message ?? response.statusText;
    throw new Error(`${method} failed (${code}): ${message}`);
  }
  return payload.result;
}

async function waitReceipt(hash) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for transaction receipt ${hash}`);
}

function compileProbe() {
  const source = `// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.20;
contract RemoteForkProbe {
  uint256 public value;
  function set(uint256 next) external { value = next; }
}`;
  const input = {
    language: 'Solidity',
    sources: { 'RemoteForkProbe.sol': { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join('\n'));
  return output.contracts['RemoteForkProbe.sol'].RemoteForkProbe;
}

const actor = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const amount = 123456789n;
const result = {
  version: 'remote-anvil-capability-proof/v1',
  status: 'running',
  providerSecret: 'RPC_ANVIL_ETHEREUM1'
};
let snapshot;
let impersonated = false;
let contractAddress;
let failure;

try {
  const chainIdHex = await rpc('eth_chainId');
  const chainId = Number(BigInt(chainIdHex));
  if (chainId !== 1) throw new Error(`Expected Ethereum chain ID 1, received ${chainId}`);

  const clientVersion = await rpc('web3_clientVersion').catch(() => 'unavailable');
  const baselineBlockHex = await rpc('eth_blockNumber');
  const baselineBlock = await rpc('eth_getBlockByNumber', [baselineBlockHex, false]);
  const actorBefore = await rpc('eth_getBalance', [actor, 'latest']);
  const recipientBefore = await rpc('eth_getBalance', [recipient, 'latest']);

  snapshot = await rpc('evm_snapshot');
  await rpc('anvil_setBalance', [actor, '0x8ac7230489e80000']);
  const fundedActorBalance = await rpc('eth_getBalance', [actor, 'latest']);
  if (BigInt(fundedActorBalance) !== 10n ** 19n) throw new Error('anvil_setBalance did not persist remotely');

  const impersonationResult = await rpc('anvil_impersonateAccount', [actor]);
  if (impersonationResult !== true) throw new Error('anvil_impersonateAccount did not return true');
  impersonated = true;

  const artifact = compileProbe();
  const deployHash = await rpc('eth_sendTransaction', [{
    from: actor,
    data: `0x${artifact.evm.bytecode.object}`,
    gas: '0x4c4b40'
  }]);
  const deployReceipt = await waitReceipt(deployHash);
  if (deployReceipt.status !== '0x1' || !deployReceipt.contractAddress) {
    throw new Error('Remote contract deployment failed');
  }
  contractAddress = deployReceipt.contractAddress;

  const code = await rpc('eth_getCode', [contractAddress, 'latest']);
  if (code === '0x') throw new Error('Remote deployment produced no contract code');

  const iface = new Interface(artifact.abi);
  const setHash = await rpc('eth_sendTransaction', [{
    from: actor,
    to: contractAddress,
    data: iface.encodeFunctionData('set', [amount]),
    gas: '0x30d40'
  }]);
  const setReceipt = await waitReceipt(setHash);
  if (setReceipt.status !== '0x1') throw new Error('Remote setter transaction failed');

  const callResult = await rpc('eth_call', [{
    to: contractAddress,
    data: iface.encodeFunctionData('value', [])
  }, 'latest']);
  const [valueReadBack] = iface.decodeFunctionResult('value', callResult);
  const storageReadBack = BigInt(await rpc('eth_getStorageAt', [contractAddress, '0x0', 'latest']));
  if (valueReadBack !== amount || storageReadBack !== amount) {
    throw new Error('Post-transaction state was not readable from the same remote RPC');
  }

  const transferValue = 1_000_000_000_000_000n;
  const recipientBeforeTransfer = BigInt(await rpc('eth_getBalance', [recipient, 'latest']));
  const transferHash = await rpc('eth_sendTransaction', [{
    from: actor,
    to: recipient,
    value: `0x${transferValue.toString(16)}`,
    gas: '0x5208'
  }]);
  const transferReceipt = await waitReceipt(transferHash);
  if (transferReceipt.status !== '0x1') throw new Error('Impersonated native transfer failed');
  const recipientAfterTransfer = BigInt(await rpc('eth_getBalance', [recipient, 'latest']));
  if (recipientAfterTransfer !== recipientBeforeTransfer + transferValue) {
    throw new Error('Remote native-transfer state did not persist');
  }

  const trace = await rpc('debug_traceTransaction', [setHash, {}])
    .then((value) => ({ supported: true, hasResult: Boolean(value) }))
    .catch((error) => ({ supported: false, error: error.message }));

  const timeBefore = Number(BigInt((await rpc('eth_getBlockByNumber', ['latest', false])).timestamp));
  await rpc('evm_increaseTime', [3600]);
  await rpc('evm_mine');
  const latestAfterTime = await rpc('eth_getBlockByNumber', ['latest', false]);
  const timeAfter = Number(BigInt(latestAfterTime.timestamp));
  if (timeAfter < timeBefore + 3600) throw new Error('Remote time advancement failed');

  result.status = 'passed';
  result.chainId = chainId;
  result.clientVersion = clientVersion;
  result.baseline = {
    blockNumber: Number(BigInt(baselineBlockHex)),
    blockHash: baselineBlock.hash,
    timestamp: Number(BigInt(baselineBlock.timestamp))
  };
  result.capabilities = {
    snapshot: true,
    setBalance: true,
    impersonation: true,
    contractDeployment: true,
    contractMutation: true,
    sameRpcCallReadBack: true,
    sameRpcStorageReadBack: true,
    nativeTransfer: true,
    timeAdvance: true,
    debugTraceTransaction: trace
  };
  result.transactions = { deployment: deployHash, setter: setHash, transfer: transferHash };
  result.contract = {
    address: contractAddress,
    codeBytes: (code.length - 2) / 2,
    valueReadBack: valueReadBack.toString(),
    storageReadBack: storageReadBack.toString()
  };
  result.time = { before: timeBefore, after: timeAfter };
  result.preRevert = { actorBefore, recipientBefore };
} catch (error) {
  failure = error;
  result.status = 'failed';
  result.error = { name: error.name, message: error.message.replaceAll(url, '[redacted]') };
} finally {
  if (impersonated) await rpc('anvil_stopImpersonatingAccount', [actor]).catch(() => {});
  if (snapshot) {
    const reverted = await rpc('evm_revert', [snapshot]);
    const actorRestored = await rpc('eth_getBalance', [actor, 'latest']);
    const recipientRestored = await rpc('eth_getBalance', [recipient, 'latest']);
    const codeAfterRevert = contractAddress ? await rpc('eth_getCode', [contractAddress, 'latest']) : '0x';
    result.revertProof = {
      reverted,
      actorRestored,
      recipientRestored,
      deployedCodeRemoved: codeAfterRevert === '0x'
    };
    if (result.preRevert) {
      result.revertProof.actorBalanceMatchesBaseline = actorRestored === result.preRevert.actorBefore;
      result.revertProof.recipientBalanceMatchesBaseline = recipientRestored === result.preRevert.recipientBefore;
    }
  }
  await fs.writeFile(proofPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (failure) throw failure;
if (!result.revertProof?.reverted
  || !result.revertProof?.actorBalanceMatchesBaseline
  || !result.revertProof?.recipientBalanceMatchesBaseline
  || !result.revertProof?.deployedCodeRemoved) {
  throw new Error('Persistent remote fork did not fully revert to its baseline snapshot');
}

console.log(JSON.stringify({
  status: result.status,
  chainId: result.chainId,
  clientVersion: result.clientVersion,
  capabilities: result.capabilities,
  revertProof: result.revertProof
}, null, 2));
