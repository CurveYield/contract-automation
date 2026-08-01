function plain(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    if (typeof value.toObject === 'function') {
      try { return plain(value.toObject()); } catch {}
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/^\d+$/.test(key))
        .map(([key, child]) => [key, plain(child)])
    );
  }
  return value;
}

function errorText(cause) {
  return [cause?.shortMessage, cause?.reason, cause?.message].filter(Boolean).join(' | ') || String(cause);
}

async function safeCall(contract, signature, args = []) {
  if (!contract) return { ok: false, error: 'contract unavailable' };
  try {
    const value = await contract.getFunction(signature).staticCall(...args);
    return { ok: true, value: plain(value) };
  } catch (cause) {
    return { ok: false, error: errorText(cause) };
  }
}

async function safeBalance(provider, address) {
  try {
    return { ok: true, value: (await provider.getBalance(address)).toString() };
  } catch (cause) {
    return { ok: false, error: errorText(cause) };
  }
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const BOOST_ABI = [
  'function lp_token() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function withdraw_fee_bps() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function reward_rate(address) view returns (uint256)',
  'function reward_period_finish(address) view returns (uint256)',
  'function claimable_reward(address,address) view returns (uint256)'
];

const YEARN_ABI = [
  'function token() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function pricePerShare() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function performanceFee() view returns (uint256)',
  'function managementFee() view returns (uint256)'
];

const CURVE_ABI = [
  'function coins(uint256) view returns (address)',
  'function get_virtual_price() view returns (uint256)',
  'function price_oracle(uint256) view returns (uint256)',
  'function calc_withdraw_one_coin(uint256,int128) view returns (uint256)'
];

const CONVERTER_POOL_ABI = [
  'function coins(uint256) view returns (address)',
  'function price_oracle() view returns (uint256)'
];

export function createV27Observer({ provider, ethers, addresses, actors, getContracts }) {
  const tokens = Object.fromEntries(
    ['sdYB', 'YB', 'crvUSD', 'curvePoolAndLP'].map((name) => [
      name,
      new ethers.Contract(addresses[name], ERC20_ABI, provider)
    ])
  );
  const boost = new ethers.Contract(addresses.boostHubStaking, BOOST_ABI, provider);
  const yearn = new ethers.Contract(addresses.yearnVault, YEARN_ABI, provider);
  const curve = new ethers.Contract(addresses.curvePoolAndLP, CURVE_ABI, provider);
  const converterPool = new ethers.Contract(addresses.ybCrvUsdPool, CONVERTER_POOL_ABI, provider);

  return async function observe(label) {
    const deployed = getContracts();
    const tracked = [...new Set([
      ...Object.values(actors),
      addresses.boostHubStaking,
      addresses.yearnVault,
      addresses.curvePoolAndLP,
      deployed.converter?.target,
      deployed.vault?.target,
      deployed.strategy1?.target,
      deployed.strategy2?.target
    ].filter(Boolean).map((value) => String(value).toLowerCase()))];

    const block = await provider.getBlock('latest');
    const nativeBalances = {};
    for (const address of tracked) nativeBalances[address] = await safeBalance(provider, address);

    const tokenState = {};
    for (const [name, token] of Object.entries(tokens)) {
      const balances = {};
      for (const address of tracked) balances[address] = await safeCall(token, 'balanceOf(address)', [address]);
      tokenState[name] = {
        address: addresses[name],
        totalSupply: await safeCall(token, 'totalSupply()'),
        decimals: await safeCall(token, 'decimals()'),
        balances
      };
    }

    const vault = deployed.vault ? {
      address: String(deployed.vault.target),
      version: await safeCall(deployed.vault, 'vaultVersion()'),
      owner: await safeCall(deployed.vault, 'owner()'),
      strategy: await safeCall(deployed.vault, 'strategy()'),
      totalSupply: await safeCall(deployed.vault, 'totalSupply()'),
      operatorShares: await safeCall(deployed.vault, 'balanceOf(address)', [actors.operator]),
      balance: await safeCall(deployed.vault, 'balance()'),
      depositBacking: await safeCall(deployed.vault, 'depositBacking()'),
      vaultConfig: await safeCall(deployed.vault, 'vaultConfig()'),
      vaultMetrics: await safeCall(deployed.vault, 'vaultMetrics()'),
      pendingYield: await safeCall(deployed.vault, 'pendingYield()'),
      yieldMetrics: await safeCall(deployed.vault, 'yieldMetrics()'),
      vaultApyBps: await safeCall(deployed.vault, 'vaultApyBps()'),
      retainedTokenState: await safeCall(deployed.vault, 'retainedTokenState()'),
      pendingKeeperChange: await safeCall(deployed.vault, 'pendingKeeperChange()'),
      pendingConverterChange: await safeCall(deployed.vault, 'pendingConverterChange()'),
      pendingAdminFeeReceiverChange: await safeCall(deployed.vault, 'pendingAdminFeeReceiverChange()')
    } : null;

    const strategies = {};
    for (const key of ['strategy1', 'strategy2']) {
      const strategy = deployed[key];
      if (!strategy) continue;
      const strategyAddress = String(strategy.target);
      strategies[key] = {
        address: strategyAddress,
        version: await safeCall(strategy, 'strategyVersion()'),
        owner: await safeCall(strategy, 'owner()'),
        vault: await safeCall(strategy, 'vault()'),
        retired: await safeCall(strategy, 'retired()'),
        strategyConfig: await safeCall(strategy, 'strategyConfig()'),
        balanceOf: await safeCall(strategy, 'balanceOf()'),
        depositBacking: await safeCall(strategy, 'depositBacking()'),
        retainedTokenState: await safeCall(strategy, 'retainedTokenState()'),
        boostHubReceiptBalance: await safeCall(boost, 'balanceOf(address)', [strategyAddress]),
        boostHubClaimableCrvUsd: await safeCall(boost, 'claimable_reward(address,address)', [strategyAddress, addresses.crvUSD]),
        yearnShares: await safeCall(yearn, 'balanceOf(address)', [strategyAddress]),
        looseSdYB: await safeCall(tokens.sdYB, 'balanceOf(address)', [strategyAddress]),
        looseYB: await safeCall(tokens.YB, 'balanceOf(address)', [strategyAddress]),
        looseCrvUSD: await safeCall(tokens.crvUSD, 'balanceOf(address)', [strategyAddress]),
        looseCurveLp: await safeCall(tokens.curvePoolAndLP, 'balanceOf(address)', [strategyAddress])
      };
    }

    return plain({
      label,
      capturedAt: new Date().toISOString(),
      block: {
        number: block?.number ?? null,
        hash: block?.hash ?? null,
        timestamp: block?.timestamp ?? null,
        baseFeePerGas: block?.baseFeePerGas ?? null,
        gasLimit: block?.gasLimit ?? null
      },
      nativeBalances,
      tokens: tokenState,
      integrations: {
        boostHub: {
          address: addresses.boostHubStaking,
          lpToken: await safeCall(boost, 'lp_token()'),
          withdrawFeeBps: await safeCall(boost, 'withdraw_fee_bps()'),
          totalSupply: await safeCall(boost, 'totalSupply()'),
          crvUsdRewardRate: await safeCall(boost, 'reward_rate(address)', [addresses.crvUSD]),
          crvUsdRewardPeriodFinish: await safeCall(boost, 'reward_period_finish(address)', [addresses.crvUSD])
        },
        yearn: {
          address: addresses.yearnVault,
          token: await safeCall(yearn, 'token()'),
          pricePerShare: await safeCall(yearn, 'pricePerShare()'),
          totalAssets: await safeCall(yearn, 'totalAssets()'),
          performanceFee: await safeCall(yearn, 'performanceFee()'),
          managementFee: await safeCall(yearn, 'managementFee()')
        },
        curve: {
          address: addresses.curvePoolAndLP,
          coin0: await safeCall(curve, 'coins(uint256)', [0]),
          coin1: await safeCall(curve, 'coins(uint256)', [1]),
          virtualPrice: await safeCall(curve, 'get_virtual_price()'),
          priceOracle0: await safeCall(curve, 'price_oracle(uint256)', [0])
        },
        converterPool: {
          address: addresses.ybCrvUsdPool,
          coin0: await safeCall(converterPool, 'coins(uint256)', [0]),
          coin1: await safeCall(converterPool, 'coins(uint256)', [1]),
          priceOracle: await safeCall(converterPool, 'price_oracle()')
        }
      },
      vault,
      strategies
    });
  };
}

export { plain, safeCall };
