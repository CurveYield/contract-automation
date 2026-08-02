import { startGanacheEngine } from './engine.mjs';
import { LiveForkWorkflowRuntime } from './live-fork-runtime.mjs';

const ENGINE_VERSION = Object.freeze({
  ganache: '7.9.2',
  'hardhat-edr': '3.12.0'
});

async function startNamedEngine(name, options) {
  if (name === 'ganache') {
    const ethers = await import('ethers');
    const engine = await startGanacheEngine(options);
    engine.runtime = new LiveForkWorkflowRuntime({
      provider: engine.provider,
      artifacts: options.artifacts,
      ethers,
      engineName: 'ganache'
    });
    return { name, version: ENGINE_VERSION[name], ...engine };
  }
  if (name === 'hardhat-edr') {
    const { startHardhatEdrEngine } = await import('./hardhat-edr-engine.mjs');
    const engine = await startHardhatEdrEngine(options);
    return { name, version: ENGINE_VERSION[name], ...engine };
  }
  throw new Error(`Unsupported fork engine: ${name}`);
}

export async function startForkEngine({
  mode = 'hardhat-edr',
  preference = ['hardhat-edr', 'ganache'],
  fallbackOn = [],
  ...options
}) {
  if (mode === 'ganache' || mode === 'hardhat-edr') {
    return startNamedEngine(mode, options);
  }
  if (mode === 'auto') {
    let lastError;
    for (const name of preference) {
      try {
        return await startNamedEngine(name, options);
      } catch (error) {
        lastError = error;
        const reason = error?.code ?? 'startup_failure';
        if (!fallbackOn.includes(reason) && !fallbackOn.includes('startup_failure')) throw error;
      }
    }
    throw lastError ?? new Error('No configured fork engine could start');
  }
  if (mode === 'differential') {
    throw new Error('Differential engine execution requires the differential orchestration adapter');
  }
  throw new Error(`Unsupported fork engine mode: ${mode}`);
}
