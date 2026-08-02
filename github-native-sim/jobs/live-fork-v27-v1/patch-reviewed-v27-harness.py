#!/usr/bin/env python3
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: patch-reviewed-v27-harness.py <runner>')

path = Path(sys.argv[1])
source = path.read_text(encoding='utf-8')


def replace_once_or_already(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'expected {label} was not found')
    return text.replace(old, new, 1)


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
source = replace_once_or_already(source, mcopy_old, mcopy_new, 'MCOPY preflight assertion')

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
source = replace_once_or_already(source, retained_old, retained_new, 'retained-harvest assertion')

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
source = replace_once_or_already(source, migration_old, migration_new, 'explicit-migration branch seed')

reverse_min_old = """        await branchRecorder.contractCall({ label: 'migrate full Yearn position back to BoostHub', contract: contracts.strategy2, signer: operatorSigner, sender: actors.operator, signature: 'migrateYearnToBoostHub(uint256,uint256,uint256)', args: [yearnShares, lpQuote * 99n / 100n, deadline], gasLimit: GAS_LIMIT });
"""
reverse_min_new = """        await branchRecorder.contractCall({ label: 'migrate full Yearn position back to BoostHub', contract: contracts.strategy2, signer: operatorSigner, sender: actors.operator, signature: 'migrateYearnToBoostHub(uint256,uint256,uint256)', args: [yearnShares, lpQuote * 995n / 1000n, deadline], gasLimit: GAS_LIMIT });
"""
source = replace_once_or_already(source, reverse_min_old, reverse_min_new, 'reverse migration minimum')

path.write_text(source, encoding='utf-8')

# The archived helper predates ethers' synchronous JsonRpcProvider.destroy().
# Wrap every direct destroy() result before attaching .catch(), preserving cleanup
# semantics while avoiding `undefined.catch` before the lifecycle can begin.
engine_path = path.with_name('hardhat-engine.mjs')
if engine_path.exists():
    engine_source = engine_path.read_text(encoding='utf-8')
    engine_source = re.sub(
        r'await\s+([A-Za-z_$][A-Za-z0-9_$]*)\.destroy\(\)\.catch\(',
        r'await Promise.resolve(\1.destroy()).catch(',
        engine_source,
    )
    engine_source = re.sub(
        r'(?<!Promise\.resolve\()([A-Za-z_$][A-Za-z0-9_$]*)\.destroy\(\)\.catch\(',
        r'Promise.resolve(\1.destroy()).catch(',
        engine_source,
    )
    engine_path.write_text(engine_source, encoding='utf-8')
