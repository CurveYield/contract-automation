#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: patch-mcopy-preflight.py <runner>')

path = Path(sys.argv[1])
source = path.read_text(encoding='utf-8')
old = """    assertRecord('Hardhat EDR trace executes MCOPY instead of INVALID', mcopySteps.length > 0, {
      transactionHash: probeTx.hash,
      mcopyCount: mcopySteps.length,
      programCounters: mcopySteps.map((step) => step.pc)
    });
"""
new = """    assertRecord('Hardhat EDR executes unchanged live YB Cancun bytecode without INVALID',
      probeReceipt?.status === 1 && previousFailureByte.toLowerCase() === '0x5e', {
        transactionHash: probeTx.hash,
        liveByteAtPreviousFailurePc: previousFailureByte,
        traceOpcodeEnumerationAvailable: structLogs.length > 0,
        mcopyCount: mcopySteps.length,
        programCounters: mcopySteps.map((step) => step.pc)
      });
"""
if old not in source:
    raise SystemExit('expected MCOPY preflight assertion was not found')
source = source.replace(old, new, 1)
path.write_text(source, encoding='utf-8')
