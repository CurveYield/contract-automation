import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { CHAINS } from '../../protocol/src/index.mjs';
import { loadArchiveRpcSlots } from '../../runner/src/archive-rpc-pool.mjs';
import {
  buildCompilerInput,
  collectSoliditySources,
  compileProject
} from '../../runner/src/compiler.mjs';
import { startForkEngine } from '../../runner/src/fork-engine.mjs';
import { startLiveForkProxy } from '../../runner/src/live-fork-proxy.mjs';
import { materializeOpenZeppelin } from '../../runner/src/project.mjs';
import { renderHtmlReport } from '../../runner/src/report.mjs';
import { raceWithRpcPolicyTermination } from '../../runner/src/rpc-method-policy.mjs';
import {
  closeRpcHealthSession,
  filterDisabledRpcSlots,
  openRpcHealthSession
} from '../../runner/src/rpc-health-session.mjs';
import { executeWorkflow } from '../../runner/src/workflow.mjs';
import { getGenesisBlockFixture } from './chain-fixtures.mjs';
import { getDeterministicGanacheAccounts } from './ganache-accounts.mjs';
import { resolveJobProjectRoot } from './project.mjs';
import { validateGitHubNativeJob } from './schema.mjs';

function jsonText(value) {
  return `${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`;
}

async function writeTextAtomic(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
  await fs.rename(temporary, file);
}

async function writeJson(file, value) {
  await writeTextAtomic(file, jsonText(value));
}

function normalizedArtifact(artifact) {
  return {
    sourceName: artifact.sourceName,
    contractName: artifact.contractName,
    abi: artifact.abi,
    creationBytecode: artifact.bytecode,
    runtimeBytecode: artifact.deployedBytecode,
    metadata: artifact.metadata,
    storageLayout: artifact.storageLayout,
    methodIdentifiers: artifact.methodIdentifiers
  };
}

function artifactFileName(artifact, index) {
  const source = artifact.sourceName.replace(/[^A-Za-z0-9._-]+/g, '_');
  const contract = artifact.contractName.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `${String(index).padStart(4, '0')}-${source}-${contract}.json`;
}

async function writeArtifacts(outputDir, artifacts) {
  const artifactDirectory = path.join(outputDir, 'artifacts');
  await fs.mkdir(artifactDirectory, { recursive: true });
  const index = [];
  for (let position = 0; position < artifacts.length; position += 1) {
    const artifact = artifacts[position];
    const file = artifactFileName(artifact, position);
    await writeJson(path.join(artifactDirectory, file), artifact);
    index.push({ sourceName: artifact.sourceName, contractName: artifact.contractName, file });
  }
  await writeJson(path.join(artifactDirectory, 'index.json'), index);
}

function isRpcSecretName(key) {
  return key.startsWith('RPC_') || key.startsWith('SIM_ARCHIVE_');
}

function redactText(value, environment) {
  if (typeof value !== 'string') return value;
  let output = value;
  for (const [key, secret] of Object.entries(environment ?? {})) {
    if (!isRpcSecretName(key) || typeof secret !== 'string' || secret.length === 0) continue;
    output = output.replaceAll(secret, `[redacted:${key}]`);
  }
  return output;
}

function serializeError(cause, environment) {
  return {
    name: cause?.name ?? 'Error',
    message: redactText(cause?.message ?? String(cause), environment),
    code: cause?.code,
    rpcCode: cause?.rpcCode,
    method: cause?.method,
    shortMessage: redactText(cause?.shortMessage, environment),
    data: cause?.data
  };
}

async function writeResultBundle(outputDir, result) {
  await writeJson(path.join(outputDir, 'result.json'), result);
  await writeTextAtomic(path.join(outputDir, 'report.html'), renderHtmlReport(result));
}

function needsGanacheAccounts(engine) {
  if (engine.mode === 'ganache') return true;
  if (engine.mode === 'differential') return engine.engines.includes('ganache');
  if (engine.mode === 'auto') return engine.preference[0] === 'ganache';
  return false;
}

function normalizedEngineEvidence(engine, requestedMode, runtimeEvidence) {
  if (!engine) return undefined;
  return {
    requestedMode,
    name: engine.name ?? requestedMode,
    version: engine.version,
    runtime: runtimeEvidence
  };
}

export async function runGitHubNativeJob({ jobFile, outputDir, environment = process.env, services = {} }) {
  if (typeof jobFile !== 'string' || jobFile.length === 0) throw new Error('jobFile is required');
  if (typeof outputDir !== 'string' || outputDir.length === 0) throw new Error('outputDir is required');

  const loadGenesisFixture = services.getGenesisBlockFixture ?? getGenesisBlockFixture;
  const discoverGanacheAccounts = services.getDeterministicGanacheAccounts ?? getDeterministicGanacheAccounts;
  const startProxy = services.startLiveForkProxy ?? startLiveForkProxy;
  const startEngine = services.startForkEngine ?? startForkEngine;
  const absoluteJobFile = path.resolve(jobFile);
  const absoluteOutputDir = path.resolve(outputDir);
  const startedAt = new Date().toISOString();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'github-native-sim-'));
  let engine;
  let forkProxy;
  let job;
  let compilerDiagnostics = [];
  let compiledArtifacts = [];
  let deployments = {};
  let steps = [];
  let resolvedBlock;
  let resolvedBlockHash;
  let resolvedBlockTimestamp;
  let forkTransport;
  let runtimeEvidence;
  let rpcHealthSession;
  let rpcHealthPersist;

  async function persistRpcHealth() {
    if (rpcHealthPersist || !rpcHealthSession) return rpcHealthPersist;
    rpcHealthPersist = await closeRpcHealthSession({
      session: rpcHealthSession,
      environment,
      diagnostics: forkTransport?.rpc,
      runId: environment.GITHUB_RUN_ID ?? job?.id
    });
    return rpcHealthPersist;
  }

  await fs.mkdir(absoluteOutputDir, { recursive: true });

  try {
    const raw = JSON.parse(await fs.readFile(absoluteJobFile, 'utf8'));
    job = validateGitHubNativeJob(raw);
    const projectRoot = resolveJobProjectRoot(absoluteJobFile, job.projectPath);
    const sources = await collectSoliditySources(projectRoot);
    const settings = { optimizer: job.optimizer, viaIR: job.viaIR, evmVersion: job.evmVersion };
    const compilerInput = buildCompilerInput(sources, settings);
    await writeJson(path.join(absoluteOutputDir, 'compiler-input.json'), compilerInput);

    const openZeppelinRoot = await materializeOpenZeppelin(job.openZeppelinVersion, temporaryRoot);
    const compilation = await compileProject({
      sources,
      compilerVersion: job.compilerVersion,
      settings,
      openZeppelinRoot
    });
    compilerDiagnostics = compilation.diagnostics;
    compiledArtifacts = compilation.artifacts.all.map(normalizedArtifact);
    await writeJson(path.join(absoluteOutputDir, 'compiler-output.json'), compilation.output);
    await writeJson(path.join(absoluteOutputDir, 'compiler-diagnostics.json'), compilerDiagnostics);
    await writeArtifacts(absoluteOutputDir, compiledArtifacts);

    if (job.mode === 'simulate') {
      const chain = CHAINS[job.chain];
      rpcHealthSession = await openRpcHealthSession({
        environment,
        chain: job.chain,
        crossSessionFailureThreshold: job.simulation.rpc.health.crossSessionFailureThreshold,
        store: services.rpcHealthStore
      });
      const configuredSlots = loadArchiveRpcSlots({
        chainName: job.chain,
        legacyEnv: chain.rpcEnv,
        environment,
        allowLegacyFallback: job.simulation.rpc.allowLegacyRpcFallback
      });
      const slots = filterDisabledRpcSlots(configuredSlots, rpcHealthSession.disabledSlotIds);
      if (slots.length === 0) throw new Error(`No healthy archive RPC slots are configured for ${job.chain}`);

      const [localAccounts, genesisBlock] = await Promise.all([
        needsGanacheAccounts(job.simulation.engine) ? discoverGanacheAccounts(20) : Promise.resolve([]),
        loadGenesisFixture(chain.chainId)
      ]);
      forkProxy = await startProxy({
        slots,
        blockPolicy: job.simulation.fork.start,
        chainId: chain.chainId,
        genesisBlock,
        localAccounts,
        routing: {
          distribution: job.simulation.rpc.distribution,
          methodRoutes: job.simulation.rpc.methodRoutes,
          allowPrimaryForSecondaryFailure: job.simulation.rpc.allowPrimaryForSecondaryFailure,
          allowSecondaryForPrimaryFailure: job.simulation.rpc.allowSecondaryForPrimaryFailure,
          unknownMethodPool: job.simulation.rpc.unknownMethodPool,
          retryDelaysMs: job.simulation.rpc.retryDelaysMs,
          requestTimeoutMs: job.simulation.rpc.requestTimeoutMs
        },
        healthPolicy: job.simulation.rpc.health,
        consistency: job.simulation.rpc.consistency
      });
      resolvedBlock = forkProxy.blockNumber;
      resolvedBlockHash = forkProxy.blockHash;
      resolvedBlockTimestamp = forkProxy.blockTimestamp;
      forkTransport = forkProxy.diagnostics;
      engine = await raceWithRpcPolicyTermination(
        startEngine({
          mode: job.simulation.engine.mode,
          preference: job.simulation.engine.preference,
          fallbackOn: job.simulation.engine.fallbackOn,
          engines: job.simulation.engine.engines,
          comparison: job.simulation.engine.comparison,
          options: job.simulation.engine.options,
          artifacts: compilation.artifacts,
          workflow: job.workflow,
          chainId: chain.chainId,
          forkUrl: forkProxy.url,
          forkControl: forkProxy,
          block: resolvedBlock,
          configuration: job.simulation
        }),
        forkProxy.termination,
        { async onLateValue(lateEngine) { await Promise.resolve(lateEngine?.close?.()).catch(() => {}); } }
      );
      const execution = await raceWithRpcPolicyTermination(
        executeWorkflow(job.workflow, engine.runtime, { aliases: engine.aliases }),
        forkProxy.termination
      );
      steps = execution.steps;
      deployments = execution.context.deployments;
      runtimeEvidence = typeof engine.getEvidence === 'function' ? await engine.getEvidence() : undefined;
      await persistRpcHealth();
    }

    const result = {
      jobId: job.id,
      status: 'completed',
      transport: 'github-native',
      mode: job.mode,
      chain: job.chain,
      chainId: job.chain ? CHAINS[job.chain].chainId : undefined,
      block: job.block,
      simulation: job.simulation,
      resolvedBlock,
      resolvedBlockHash,
      resolvedBlockTimestamp,
      engine: normalizedEngineEvidence(engine, job.simulation?.engine?.mode, runtimeEvidence),
      forkTransport,
      rpcHealth: rpcHealthSession ? { load: rpcHealthSession.load, persist: rpcHealthPersist } : undefined,
      compilerVersion: job.compilerVersion,
      compilerDiagnostics,
      artifacts: compiledArtifacts,
      deployments,
      steps,
      startedAt,
      finishedAt: new Date().toISOString()
    };
    await writeResultBundle(absoluteOutputDir, result);
    return result;
  } catch (cause) {
    if (cause?.compilerDiagnostics) compilerDiagnostics = cause.compilerDiagnostics;
    if (cause?.workflowSteps) steps = cause.workflowSteps;
    if (cause?.workflowContext?.deployments) deployments = cause.workflowContext.deployments;
    try { await persistRpcHealth(); } catch (healthError) { cause.rpcHealthError = healthError; }
    try {
      const result = {
        jobId: job?.id ?? path.basename(path.dirname(absoluteJobFile)),
        status: 'failed',
        transport: 'github-native',
        mode: job?.mode,
        chain: job?.chain,
        chainId: job?.chain ? CHAINS[job.chain]?.chainId : undefined,
        block: job?.block,
        simulation: job?.simulation,
        resolvedBlock,
        resolvedBlockHash,
        resolvedBlockTimestamp,
        engine: normalizedEngineEvidence(engine, job?.simulation?.engine?.mode, runtimeEvidence),
        forkTransport,
        rpcHealth: rpcHealthSession ? { load: rpcHealthSession.load, persist: rpcHealthPersist } : undefined,
        compilerVersion: job?.compilerVersion,
        compilerDiagnostics,
        artifacts: compiledArtifacts,
        deployments,
        steps,
        error: serializeError(cause, environment),
        startedAt,
        finishedAt: new Date().toISOString()
      };
      await writeJson(path.join(absoluteOutputDir, 'compiler-diagnostics.json'), compilerDiagnostics);
      if (compiledArtifacts.length > 0) await writeArtifacts(absoluteOutputDir, compiledArtifacts);
      await writeResultBundle(absoluteOutputDir, result);
      cause.githubNativeResult = result;
    } catch (writeCause) {
      cause.githubNativeOutputError = serializeError(writeCause, environment);
    }
    throw cause;
  } finally {
    if (engine) await Promise.resolve(engine.close()).catch(() => {});
    if (forkProxy) await Promise.resolve(forkProxy.close()).catch(() => {});
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}
