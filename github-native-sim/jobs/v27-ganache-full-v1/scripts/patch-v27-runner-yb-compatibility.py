from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch-v27-runner-yb-compatibility.py <runner.mjs>")

file = Path(sys.argv[1])
source = file.read_text(encoding="utf-8")
marker = "  const pinnedFundingBalances = {};\n"
if source.count(marker) != 1:
    raise SystemExit(f"expected exactly one funding marker, found {source.count(marker)}")

compatibility = r'''  const ybCompatibilityRuntimeFile = process.env.YB_SHANGHAI_RUNTIME_FILE;
  if (!ybCompatibilityRuntimeFile) {
    throw new Error('YB_SHANGHAI_RUNTIME_FILE is required for the Ganache Cancun compatibility layer');
  }
  const ybOriginalCode = await provider.getCode(config.addresses.YB);
  const ybOriginalPc2591 = `0x${ybOriginalCode.slice(2 + (2591 * 2), 4 + (2591 * 2))}`;
  assertRecord('live YB byte at PC 2591 is Cancun MCOPY', ybOriginalPc2591 === '0x5e', {
    address: config.addresses.YB,
    pc: 2591,
    byte: ybOriginalPc2591
  });
  const ybShanghaiRuntime = (await fs.readFile(ybCompatibilityRuntimeFile, 'utf8')).trim();
  assertRecord(
    'compiled YB Shanghai compatibility runtime is valid bytecode',
    /^0x[0-9a-fA-F]+$/.test(ybShanghaiRuntime) && ybShanghaiRuntime.length > 100,
    { runtimeBytes: Math.max(0, (ybShanghaiRuntime.length - 2) / 2) }
  );
  await provider.send('evm_setAccountCode', [config.addresses.YB, ybShanghaiRuntime]);
  const ybPatchedCode = await provider.getCode(config.addresses.YB);
  assertRecord(
    'YB Shanghai compatibility runtime installed only inside Ganache',
    lower(ybPatchedCode) === lower(ybShanghaiRuntime),
    {
      address: config.addresses.YB,
      originalCodeHash: ethers.keccak256(ybOriginalCode),
      compatibilityCodeHash: ethers.keccak256(ybShanghaiRuntime)
    }
  );
  report.execution.ybGanacheCompatibility = {
    address: config.addresses.YB,
    scope: 'ephemeral Ganache only',
    source: 'verified Blockscout Vyper source compiled unchanged with Vyper 0.4.3 for Shanghai',
    reason: 'Ganache 7.9.2 does not implement Cancun MCOPY opcode 0x5e',
    originalPc2591: ybOriginalPc2591,
    originalCodeHash: ethers.keccak256(ybOriginalCode),
    compatibilityCodeHash: ethers.keccak256(ybShanghaiRuntime),
    originalRuntimeBytes: Math.max(0, (ybOriginalCode.length - 2) / 2),
    compatibilityRuntimeBytes: Math.max(0, (ybShanghaiRuntime.length - 2) / 2)
  };
  report.controlOperations.push({
    method: 'evm_setAccountCode',
    scope: 'ephemeral Ganache only',
    account: config.addresses.YB,
    originalCodeHash: ethers.keccak256(ybOriginalCode),
    replacementCodeHash: ethers.keccak256(ybShanghaiRuntime),
    storagePreserved: true,
    mainnetChanged: false
  });

'''
source = source.replace(marker, compatibility + marker)
file.write_text(source, encoding="utf-8")
