import { LiveForkWorkflowRuntime } from './live-fork-runtime.mjs';

const DEFAULT_PROOF_ACCOUNT = '0x000000000000000000000000000000000000dEaD';

function collectLiteralActors(workflow = { steps: [] }) {
  const actors = new Set();
  for (const step of workflow.steps ?? []) {
    for (const key of ['from', 'account']) {
      const value = step?.[key];
      if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) {
        actors.add(value);
      }
    }
  }
  return [...actors];
}

function asHexQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

async function proveRemoteMutation(provider, proofAccount) {
  const proofSnapshot = await provider.send('evm_snapshot', []);
  const beforeHex = await provider.send('eth_getBalance', [proofAccount, 'latest']);
  const before = BigInt(beforeHex);
  const target = before + 1n;
  let readBack = before;
  let reverted = false;
  let restored = before;

  try {
    await provider.send('anvil_setBalance', [proofAccount, asHexQuantity(target)]);
    readBack = BigInt(await provider.send('eth_getBalance', [proofAccount, 'latest']));
  } finally {
    reverted = await provider.send('evm_revert', [proofSnapshot]);
    restored = BigInt(await provider.send('eth_getBalance', [proofAccount, 'latest']));
  }

  const proof = {
    proofAccount,
    before: before.toString(),
    target: target.toString(),
    readBack: readBack.toString(),
    restored: restored.toString(),
    remoteMutationReadBack: readBack === target,
    revertedAfterProof: reverted === true && restored === before
  };
  if (!proof.remoteMutationReadBack || !proof.revertedAfterProof) {
    throw new Error(`Remote mutable RPC capability proof failed: ${JSON.stringify(proof)}`);
  }
  return proof;
}

class RemoteRpcWorkflowRuntime extends LiveForkWorkflowRuntime {
  async setBalance(step, context) {
    const account = typeof step.account === 'string' && step.account.startsWith('$')
      ? context.aliases[step.account.slice(1)] ?? context.values[step.account.slice(1)]
      : step.account;
    if (!account) throw new Error('Remote setBalance requires an account');
    const amount = BigInt(step.amount);
    await this.provider.send('anvil_setBalance', [account, asHexQuantity(amount)]);
    return { account, amount: amount.toString(), method: 'anvil_setBalance' };
  }
}

export async function startRemoteRpcEngine({
  rpcUrl,
  chainId: sourceChainId,
  workflow,
  artifacts,
  proofAccount = DEFAULT_PROOF_ACCOUNT
}) {
  if (typeof rpcUrl !== 'string' || rpcUrl.length === 0) {
    throw new Error('A trusted remote mutable RPC URL is required');
  }

  const ethers = await import('ethers');
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
  let sessionSnapshot;
  let closeEvidence;
  const impersonatedActors = collectLiteralActors(workflow);

  try {
    const actualChainId = BigInt(await provider.send('eth_chainId', []));
    const accounts = await provider.send('eth_accounts', []);
    const blockNumberHex = await provider.send('eth_blockNumber', []);
    const block = await provider.send('eth_getBlockByNumber', [blockNumberHex, false]);
    if (!block?.hash || !block?.timestamp) {
      throw new Error('Remote RPC did not return complete initial block metadata');
    }

    sessionSnapshot = await provider.send('evm_snapshot', []);
    const capabilityProof = await proveRemoteMutation(provider, proofAccount);

    for (const actor of impersonatedActors) {
      const enabled = await provider.send('anvil_impersonateAccount', [actor]);
      if (enabled === false) throw new Error(`Remote RPC could not impersonate ${actor}`);
    }

    const aliases = Object.fromEntries((accounts ?? []).map((account, index) => [`account${index}`, account]));
    if (!aliases.account0 && impersonatedActors[0]) aliases.account0 = impersonatedActors[0];

    const runtime = new RemoteRpcWorkflowRuntime({
      provider,
      artifacts,
      ethers,
      engineName: 'remote-rpc'
    });
    let closed = false;

    const engine = {
      name: 'remote-rpc',
      version: 'anvil-json-rpc',
      provider,
      runtime,
      aliases,
      url: rpcUrl,
      async getEvidence() {
        return {
          assurance: 'remote-mutable-rpc',
          sourceChainId,
          chainId: Number(actualChainId),
          rpcChainId: Number(actualChainId),
          initialBlockNumber: Number(BigInt(blockNumberHex)),
          initialBlockHash: block.hash,
          initialBlockTimestamp: Number(BigInt(block.timestamp)),
          capabilityProof,
          impersonatedActorCount: impersonatedActors.length,
          persistentForkRestoredOnClose: closeEvidence?.restored === true,
          closeEvidence
        };
      },
      async close() {
        if (closed) return closeEvidence;
        closed = true;
        try {
          for (const actor of impersonatedActors) {
            await provider.send('anvil_stopImpersonatingAccount', [actor]).catch(() => {});
          }
          const reverted = sessionSnapshot
            ? await provider.send('evm_revert', [sessionSnapshot])
            : false;
          const restoredBlockNumberHex = await provider.send('eth_blockNumber', []);
          const restoredBlock = await provider.send('eth_getBlockByNumber', [restoredBlockNumberHex, false]);
          const restoredProofBalance = BigInt(await provider.send('eth_getBalance', [proofAccount, 'latest']));
          closeEvidence = {
            reverted: reverted === true,
            blockNumberRestored: restoredBlockNumberHex === blockNumberHex,
            blockHashRestored: restoredBlock?.hash === block.hash,
            proofBalanceRestored: restoredProofBalance.toString() === capabilityProof.before,
            restored: reverted === true
              && restoredBlockNumberHex === blockNumberHex
              && restoredBlock?.hash === block.hash
              && restoredProofBalance.toString() === capabilityProof.before
          };
          if (!closeEvidence.restored) {
            throw new Error(`Persistent remote fork cleanup verification failed: ${JSON.stringify(closeEvidence)}`);
          }
          return closeEvidence;
        } finally {
          await provider.destroy().catch(() => {});
        }
      }
    };

    return engine;
  } catch (error) {
    if (sessionSnapshot) await provider.send('evm_revert', [sessionSnapshot]).catch(() => {});
    await provider.destroy().catch(() => {});
    throw error;
  }
}
