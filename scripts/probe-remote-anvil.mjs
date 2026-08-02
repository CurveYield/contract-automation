import fs from 'node:fs/promises';
import solc from 'solc';
import { HDNodeWallet, Interface } from 'ethers';

const slot = process.env.ANVIL_FORK_SLOT ?? '1';
const url = process.env.REMOTE_RPC_URL ?? process.env.RPC_ANVIL_ETHEREUM1;
const mnemonic = process.env.ANVIL_FORKS_MNEMONIC?.trim();
const proofPath = process.env.PROOF_PATH ?? `/tmp/remote-anvil-proof-${slot}.json`;
if (!url) throw new Error(`RPC_ANVIL_ETHEREUM${slot} is not configured`);
if (!mnemonic) throw new Error('ANVIL_FORKS_MNEMONIC is not configured');

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const IMPERSONATED_ACTOR = '0x1111111111111111111111111111111111111111';
const IMPERSONATED_RECIPIENT = '0x2222222222222222222222222222222222222222';
const SIGNED_RECIPIENT = '0x3333333333333333333333333333333333333333';
const MUTATION_VALUE = 123456789n;
let requestId = 0;

function sanitize(message) {
  return String(message).replaceAll(url, '[redacted-rpc]').replaceAll(mnemonic, '[redacted-mnemonic]');
}

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

function deriveMnemonicAccounts() {
  return Array.from({ length: 10 }, (_, index) => HDNodeWallet.fromPhrase(
    mnemonic,
    '',
    `m/44'/60'/0'/0/${index}`
  ));
}

const result = {
  version: 'remote-anvil-pool-capability-proof/v2',
  status: 'running',
  slot: Number(slot),
  providerSecret: `RPC_ANVIL_ETHEREUM${slot}`,
  mnemonicSecret: 'ANVIL_FORKS_MNEMONIC'
};
let snapshot;
let impersonated = false;
let contractAddress;
let failure;

try {
  const chainIdHex = await rpc('eth_chainId');
  const chainId = BigInt(chainIdHex);
  const clientVersion = await rpc('web3_clientVersion').catch(() => 'unavailable');
  const baselineBlockHex = await rpc('eth_blockNumber');
  const baselineBlock = await rpc('eth_getBlockByNumber', [baselineBlockHex, false]);

  const wethCode = await rpc('eth_getCode', [WETH, 'latest']);
  if (wethCode === '0x') throw new Error('Canonical Ethereum WETH code is missing from the fork');
  const wethInterface = new Interface(['function name() view returns (string)']);
  const wethNameResult = await rpc('eth_call', [{
    to: WETH,
    data: wethInterface.encodeFunctionData('name', [])
  }, 'latest']);
  const [wethName] = wethInterface.decodeFunctionResult('name', wethNameResult);
  if (wethName !== 'Wrapped Ether') {
    throw new Error(`Canonical WETH read returned unexpected name: ${wethName}`);
  }

  const derivedWallets = deriveMnemonicAccounts();
  const remoteAccounts = (await rpc('eth_accounts')).map((address) => address.toLowerCase());
  const remoteAccountSet = new Set(remoteAccounts);
  const missingDerivedAccounts = derivedWallets
    .map((wallet) => wallet.address)
    .filter((address) => !remoteAccountSet.has(address.toLowerCase()));
  if (missingDerivedAccounts.length > 0) {
    throw new Error(`Fork is missing ${missingDerivedAccounts.length} mnemonic-derived loaded accounts`);
  }

  const signer = derivedWallets[0];
  const signerBalanceBefore = await rpc('eth_getBalance', [signer.address, 'latest']);
  if (BigInt(signerBalanceBefore) <= 0n) throw new Error('Mnemonic signer account is not funded');
  const signerNonceBefore = await rpc('eth_getTransactionCount', [signer.address, 'latest']);
  const actorBefore = await rpc('eth_getBalance', [IMPERSONATED_ACTOR, 'latest']);
  const impersonatedRecipientBefore = await rpc('eth_getBalance', [IMPERSONATED_RECIPIENT, 'latest']);
  const signedRecipientBefore = await rpc('eth_getBalance', [SIGNED_RECIPIENT, 'latest']);
  result.preRevert = {
    actorBefore,
    impersonatedRecipientBefore,
    signedRecipientBefore,
    signerBalanceBefore,
    signerNonceBefore
  };

  snapshot = await rpc('evm_snapshot');
  await rpc('anvil_setBalance', [IMPERSONATED_ACTOR, '0x8ac7230489e80000']);
  const fundedActorBalance = await rpc('eth_getBalance', [IMPERSONATED_ACTOR, 'latest']);
  if (BigInt(fundedActorBalance) !== 10n ** 19n) throw new Error('anvil_setBalance did not persist remotely');

  const impersonationResult = await rpc('anvil_impersonateAccount', [IMPERSONATED_ACTOR]);
  if (impersonationResult === false) throw new Error('anvil_impersonateAccount returned false');
  impersonated = true;

  const artifact = compileProbe();
  const deployHash = await rpc('eth_sendTransaction', [{
    from: IMPERSONATED_ACTOR,
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
    from: IMPERSONATED_ACTOR,
    to: contractAddress,
    data: iface.encodeFunctionData('set', [MUTATION_VALUE]),
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
  if (valueReadBack !== MUTATION_VALUE || storageReadBack !== MUTATION_VALUE) {
    throw new Error('Post-transaction state was not readable from the same remote RPC');
  }

  const impersonatedTransferValue = 1_000_000_000_000_000n;
  const recipientBeforeTransfer = BigInt(await rpc('eth_getBalance', [IMPERSONATED_RECIPIENT, 'latest']));
  const transferHash = await rpc('eth_sendTransaction', [{
    from: IMPERSONATED_ACTOR,
    to: IMPERSONATED_RECIPIENT,
    value: `0x${impersonatedTransferValue.toString(16)}`,
    gas: '0x5208'
  }]);
  const transferReceipt = await waitReceipt(transferHash);
  if (transferReceipt.status !== '0x1') throw new Error('Impersonated native transfer failed');
  const recipientAfterTransfer = BigInt(await rpc('eth_getBalance', [IMPERSONATED_RECIPIENT, 'latest']));
  if (recipientAfterTransfer !== recipientBeforeTransfer + impersonatedTransferValue) {
    throw new Error('Remote impersonated-transfer state did not persist');
  }

  const signedTransferValue = 1n;
  const signedRecipientBeforeTransfer = BigInt(await rpc('eth_getBalance', [SIGNED_RECIPIENT, 'latest']));
  const gasPrice = BigInt(await rpc('eth_gasPrice'));
  const signerNonce = BigInt(await rpc('eth_getTransactionCount', [signer.address, 'latest']));
  const rawSignedTransaction = await signer.signTransaction({
    chainId,
    nonce: Number(signerNonce),
    gasLimit: 21_000n,
    gasPrice,
    to: SIGNED_RECIPIENT,
    value: signedTransferValue,
    type: 0
  });
  const signedTransferHash = await rpc('eth_sendRawTransaction', [rawSignedTransaction]);
  const signedTransferReceipt = await waitReceipt(signedTransferHash);
  if (signedTransferReceipt.status !== '0x1') throw new Error('Mnemonic-signed raw transaction failed');
  const signedRecipientAfterTransfer = BigInt(await rpc('eth_getBalance', [SIGNED_RECIPIENT, 'latest']));
  if (signedRecipientAfterTransfer !== signedRecipientBeforeTransfer + signedTransferValue) {
    throw new Error('Mnemonic-signed transaction state did not persist');
  }

  const trace = await rpc('debug_traceTransaction', [setHash, {}])
    .then((value) => ({ supported: true, hasResult: Boolean(value) }))
    .catch((error) => ({ supported: false, error: sanitize(error.message) }));

  const timeBefore = Number(BigInt((await rpc('eth_getBlockByNumber', ['latest', false])).timestamp));
  await rpc('evm_increaseTime', [3600]);
  await rpc('evm_mine');
  const latestAfterTime = await rpc('eth_getBlockByNumber', ['latest', false]);
  const timeAfter = Number(BigInt(latestAfterTime.timestamp));
  if (timeAfter < timeBefore + 3600) throw new Error('Remote time advancement failed');

  result.status = 'passed';
  result.chainId = Number(chainId);
  result.clientVersion = clientVersion;
  result.baseline = {
    blockNumber: Number(BigInt(baselineBlockHex)),
    blockHash: baselineBlock.hash,
    timestamp: Number(BigInt(baselineBlock.timestamp))
  };
  result.forkState = {
    sourceChain: 'ethereum',
    canonicalWethAddress: WETH,
    wethName,
    wethCodeBytes: (wethCode.length - 2) / 2
  };
  result.mnemonicAccounts = {
    expected: 10,
    matchedLoadedAccounts: 10,
    signerAddress: signer.address,
    signerFunded: true
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
    rawSignedTransaction: true,
    timeAdvance: true,
    debugTraceTransaction: trace
  };
  result.transactions = {
    deployment: deployHash,
    setter: setHash,
    impersonatedTransfer: transferHash,
    signedTransfer: signedTransferHash
  };
  result.contract = {
    address: contractAddress,
    codeBytes: (code.length - 2) / 2,
    valueReadBack: valueReadBack.toString(),
    storageReadBack: storageReadBack.toString()
  };
  result.time = { before: timeBefore, after: timeAfter };
} catch (error) {
  failure = error;
  result.status = 'failed';
  result.error = { name: error.name, message: sanitize(error.message) };
} finally {
  if (impersonated) await rpc('anvil_stopImpersonatingAccount', [IMPERSONATED_ACTOR]).catch(() => {});
  if (snapshot) {
    const reverted = await rpc('evm_revert', [snapshot]);
    const actorRestored = await rpc('eth_getBalance', [IMPERSONATED_ACTOR, 'latest']);
    const impersonatedRecipientRestored = await rpc('eth_getBalance', [IMPERSONATED_RECIPIENT, 'latest']);
    const signedRecipientRestored = await rpc('eth_getBalance', [SIGNED_RECIPIENT, 'latest']);
    const signerAddress = deriveMnemonicAccounts()[0].address;
    const signerBalanceRestored = await rpc('eth_getBalance', [signerAddress, 'latest']);
    const signerNonceRestored = await rpc('eth_getTransactionCount', [signerAddress, 'latest']);
    const codeAfterRevert = contractAddress ? await rpc('eth_getCode', [contractAddress, 'latest']) : '0x';
    result.revertProof = {
      reverted,
      actorRestored,
      impersonatedRecipientRestored,
      signedRecipientRestored,
      signerBalanceRestored,
      signerNonceRestored,
      deployedCodeRemoved: codeAfterRevert === '0x'
    };
    if (result.preRevert) {
      result.revertProof.actorBalanceMatchesBaseline = actorRestored === result.preRevert.actorBefore;
      result.revertProof.impersonatedRecipientMatchesBaseline = impersonatedRecipientRestored === result.preRevert.impersonatedRecipientBefore;
      result.revertProof.signedRecipientMatchesBaseline = signedRecipientRestored === result.preRevert.signedRecipientBefore;
      result.revertProof.signerBalanceMatchesBaseline = signerBalanceRestored === result.preRevert.signerBalanceBefore;
      result.revertProof.signerNonceMatchesBaseline = signerNonceRestored === result.preRevert.signerNonceBefore;
    }
  }
  await fs.writeFile(proofPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (failure) throw failure;
if (!result.revertProof?.reverted
  || !result.revertProof?.actorBalanceMatchesBaseline
  || !result.revertProof?.impersonatedRecipientMatchesBaseline
  || !result.revertProof?.signedRecipientMatchesBaseline
  || !result.revertProof?.signerBalanceMatchesBaseline
  || !result.revertProof?.signerNonceMatchesBaseline
  || !result.revertProof?.deployedCodeRemoved) {
  throw new Error('Persistent remote fork did not fully revert to its baseline snapshot');
}

console.log(JSON.stringify({
  status: result.status,
  slot: result.slot,
  chainId: result.chainId,
  clientVersion: result.clientVersion,
  forkState: result.forkState,
  mnemonicAccounts: result.mnemonicAccounts,
  capabilities: result.capabilities,
  revertProof: result.revertProof
}, null, 2));
