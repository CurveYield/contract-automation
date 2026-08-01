export async function getDeterministicGanacheAccounts(totalAccounts = 20) {
  if (!Number.isInteger(totalAccounts) || totalAccounts < 1 || totalAccounts > 100) {
    throw new Error('totalAccounts must be an integer from 1 to 100');
  }

  const ganacheModule = await import('ganache');
  const ganache = ganacheModule.default ?? ganacheModule;
  const provider = ganache.provider({
    logging: { quiet: true },
    wallet: { deterministic: true, totalAccounts }
  });

  try {
    const accounts = await provider.request({ method: 'eth_accounts', params: [] });
    return accounts.map((account) => account.toLowerCase());
  } finally {
    if (typeof provider.disconnect === 'function') await provider.disconnect();
  }
}
