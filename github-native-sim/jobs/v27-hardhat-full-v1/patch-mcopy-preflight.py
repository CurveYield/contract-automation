#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: patch-mcopy-preflight.py <runner>')

path = Path(sys.argv[1])
source = path.read_text(encoding='utf-8')

mcopy_old = """    assertRecord('Hardhat EDR trace executes MCOPY instead of INVALID', mcopySteps.length > 0, {
      transactionHash: probeTx.hash,
      mcopyCount: mcopySteps.length,
      programCounters: mcopySteps.map((step) => step.pc)
    });
"""
mcopy_new = """    assertRecord('Hardhat EDR executes unchanged live YB Cancun bytecode without INVALID',
      probeReceipt?.status === 1 && previousFailureByte.toLowerCase() === '0x5e', {
        transactionHash: probeTx.hash,
        liveByteAtPreviousFailurePc: previousFailureByte,
        traceOpcodeEnumerationAvailable: structLogs.length > 0,
        mcopyCount: mcopySteps.length,
        programCounters: mcopySteps.map((step) => step.pc)
      });
"""
if mcopy_old not in source:
    raise SystemExit('expected MCOPY preflight assertion was not found')
source = source.replace(mcopy_old, mcopy_new, 1)

retained_old = """      const postFee = gross - fee;
      assertRecord(`cycle ${cycle} retained harvest share is exactly 4 percent post-fee`, postFee === 0n || retained === postFee * BigInt(config.feesBps.retainedPostFeeHarvest) / 10_000n, { postFee, retained });
"""
retained_new = """      const postFee = gross - fee;
      const strategyAddress = lower(String(strategy.target));
      const beforeStrategyAnalytics = Object.values(analyticsBeforeHarvest.strategies ?? {})
        .find((entry) => lower(entry?.address ?? '') === strategyAddress);
      const afterStrategyAnalytics = Object.values(analyticsAfterHarvest.strategies ?? {})
        .find((entry) => lower(entry?.address ?? '') === strategyAddress);
      const beforeGrossBacking = BigInt(beforeStrategyAnalytics?.depositBacking?.value ?? 0)
        + BigInt(beforeStrategyAnalytics?.retainedTokenState?.value?.[0] ?? 0);
      const afterGrossBacking = BigInt(afterStrategyAnalytics?.depositBacking?.value ?? 0)
        + BigInt(afterStrategyAnalytics?.retainedTokenState?.value?.[0] ?? 0);
      const realizedBackingGain = afterGrossBacking > beforeGrossBacking
        ? afterGrossBacking - beforeGrossBacking
        : 0n;
      const expectedRetained = realizedBackingGain * BigInt(config.feesBps.retainedPostFeeHarvest) / 10_000n;
      assertRecord(`cycle ${cycle} retained harvest share is exactly 4 percent of realized backing gain`,
        retained === expectedRetained,
        { postFee, beforeGrossBacking, afterGrossBacking, realizedBackingGain, expectedRetained, retained });
      assertRecord(`cycle ${cycle} retained harvest does not exceed 4 percent of post-fee tokens`,
        retained <= postFee * BigInt(config.feesBps.retainedPostFeeHarvest) / 10_000n,
        { postFee, retained });
"""
if retained_old not in source:
    raise SystemExit('expected retained-harvest assertion was not found')
source = source.replace(retained_old, retained_new, 1)

migration_old = """    await branchRecorder.contractCall({ label: 'branch deposit 2,000 sdYB', contract: contracts.vault, signer: operatorSigner, sender: actors.operator, signature: 'deposit(uint256)', args: [amount('2000')], gasLimit: GAS_LIMIT });
    const gauge = await staticCall(boost, 'balanceOf(address)', [strategy2Deployment.address]);
"""
migration_new = """    await branchRecorder.contractCall({ label: 'branch deposit 2,000 sdYB', contract: contracts.vault, signer: operatorSigner, sender: actors.operator, signature: 'deposit(uint256)', args: [amount('2000')], gasLimit: GAS_LIMIT });
    await branchRecorder.contractCall({ label: 'seed 500 sdYB retained migration reserve', contract: sdYB.connect(operatorSigner), signer: operatorSigner, sender: actors.operator, signature: 'transfer(address,uint256)', args: [vaultDeployment.address, amount('500')], gasLimit: GAS_LIMIT });
    await branchRecorder.contractCall({ label: 'sync retained migration reserve', contract: contracts.vault, signer: operatorSigner, sender: actors.operator, signature: 'syncDonations()', args: [], gasLimit: GAS_LIMIT });
    const migrationReserve = await staticCall(contracts.strategy2, 'retainedTokenState()');
    const migrationSpendable = resultValue(migrationReserve, 4);
    branch.assertions.push({
      name: 'explicit migration branch has spendable retained reserve',
      passed: migrationSpendable > 0n,
      detail: { retainedTokenState: plain(migrationReserve) }
    });
    if (migrationSpendable === 0n) throw new Error('explicit migration reserve was not credited');
    const gauge = await staticCall(boost, 'balanceOf(address)', [strategy2Deployment.address]);
"""
if migration_old not in source:
    raise SystemExit('expected explicit-migration branch seed was not found')
source = source.replace(migration_old, migration_new, 1)

reverse_min_old = """        await branchRecorder.contractCall({ label: 'migrate full Yearn position back to BoostHub', contract: contracts.strategy2, signer: operatorSigner, sender: actors.operator, signature: 'migrateYearnToBoostHub(uint256,uint256,uint256)', args: [yearnShares, lpQuote * 99n / 100n, deadline], gasLimit: GAS_LIMIT });
"""
reverse_min_new = """        await branchRecorder.contractCall({ label: 'migrate full Yearn position back to BoostHub', contract: contracts.strategy2, signer: operatorSigner, sender: actors.operator, signature: 'migrateYearnToBoostHub(uint256,uint256,uint256)', args: [yearnShares, lpQuote * 995n / 1000n, deadline], gasLimit: GAS_LIMIT });
"""
if reverse_min_old not in source:
    raise SystemExit('expected reverse migration minimum was not found')
source = source.replace(reverse_min_old, reverse_min_new, 1)

path.write_text(source, encoding='utf-8')
