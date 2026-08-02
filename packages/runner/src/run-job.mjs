import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CHAINS, validateCreateJobRequest } from '../../protocol/src/index.mjs';
import { RunnerApiClient } from './api-client.mjs';
import { loadArchiveRpcSlots } from './archive-rpc-pool.mjs';
import { collectSoliditySources, compileProject } from './compiler.mjs';
import { startForkEngine } from './fork-engine.mjs';
import { startLiveForkProxy } from './live-fork-proxy.mjs';
import { materializeOpenZeppelin, materializeProject } from './project.mjs';
import { loadRemoteRpcSlots, selectRemoteRpcSlot } from './remote-rpc-pool.mjs';
import { renderHtmlReport } from './report.mjs';
import { raceWithRpcPolicyTermination } from './rpc-method-policy.mjs';
import {
  closeRpcHealthSession,
  filterDisabledRpcSlots,
  openRpcHealthSession
} from './rpc-health-session.mjs';
import { executeWorkflow } from './workflow.mjs';

function isSensitiveSecretName(key) {
  return key.startsWith('RPC_')
    || key.startsWith('SIM_ARCHIVE_')
    || key.includes('MNEMONIC')
    || key.includes('PRIVATE_KEY');
}

function redactText(value, environment) {
  if (typeof value !== 'string') return value;
  let output = value;
  for (const [key, secret] of Object.entries(environment ?? {})) {
    if (!isSensitiveSecretName(key) || typeof secret !== 'string' || secret.length === 0) continue;
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
    data: cause?.data,
    cleanupError: cause?.cleanupError
  };
}

function normalizedEngineEvidence(engine, requestedMode, runtimeEvidence) {
  if (!engine && !runtimeEvidence) return undefined;
  return {
    requestedMode,
    name: engine?.name ?? requestedMode,
    version: engine?.version,
    runtime: runtimeEvidence
  };
}

export async function runJob({ jobId, apiUrl, runnerApiKey, environment = process.env, services = {} }) {
  const api = services.apiClient ?? new RunnerApiClient({ baseUrl: apiUrl, apiKey: runnerApiKey });
  const startProxy = services.startLiveForkProxy ?? startLiveForkProxy;
  const startEngine = services.startForkEngine ?? startForkEngine;
  const startedAt = new Date().toISOString();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `preflightsim-${jobId}-`));
  let engine;
  let engineIdentity;
  let forkProxy;
  let forkTransport;
  let request;
  let compilerDiagnostics = [];
  let steps = [];
  let deployments = {};
  let compiledArtifacts = [];
  let resolvedBlock;
  let resolvedBlockHash;
  let resolvedBlockTimestamp;
  let runtimeEvidence;
  let rpcHealthSession;
  let rpcHealthPersist;

  async function persistRpcHealth() {
    if (rpcHealthPersist || !rpcHealthSession) return rpcHealthPersist;
    rpcHealthPersist = await closeRpcHealthSession({
      session: rpcHealthSession,
      environment,
      diagnostics: forkTransport?.rpc,
      runId: jobId
    });
    return rpcHealthPersist;
  }

  async function closeActiveEngine() {
    if (!engine) return;
    const activeEngine = engine;
    engineIdentity = {
      name: activeEngine.name,
      version: activeEngine.version
    };
    let closeError;
    try {
      await activeEngine.close();
    } catch (error) {
      closeError = error;
    }
    try {
      if (typeof activeEngine.getEvidence === 'function') {
        runtimeEvidence = await activeEngine.getEvidence();
      }
    } catch {}
    engine = undefined;
    if (closeError) throw closeError;
  }

  try {
    await api.updateStatus(jobId, { status: 'running', stage: 'fetching_project' });
    const rawJob = await api.getJob(jobId);
    const { jobId: storedJobId, createdAt: _createdAt, ...requestData } = rawJob;
    if (storedJobId !== jobId) throw new Error('Stored job ID does not match requested job');
    request = { ...validateCreateJobRequest(requestData), jobId };
    const projectRoot = await materializeProject(request, root, api);

    await api.updateStatus(jobId, { status: 'running', stage: 'resolving_dependencies' });
    const openZeppelinRoot = await materializeOpenZeppelin(request.openZeppelinVersion, root);
    const sources = await collectSoliditySources(projectRoot);
    await api.updateStatus(jobId, { status: 'running', stage: 'compiling' });
    const compilation = await compileProject({
      sources,
      compilerVersion: request.compilerVersion,
      settings: { optimizer: request.optimizer, viaIR: request.viaIR, evmVersion: request.evmVersion },
      openZeppelinRoot
    });
    compilerDiagnostics = compilation.diagnostics;
    compiledArtifacts = compilation.artifacts.all.map((artifact) => ({
      sourceName: artifact.sourceName,
      contractName: artifact.contractName,
      abi: artifact.abi,
      creationBytecode: artifact.bytecode,
      runtimeBytecode: artifact.deployedBytecode,
      metadata: artifact.metadata,
      storageLayout: artifact.storageLayout,
      methodIdentifiers: artifact.methodIdentifiers
    }));

    if (request.mode === 'compile') {
      const result = {
        jobId,
        status: 'completed',
        mode: 'compile',
        compilerVersion: request.compilerVersion,
        compilerDiagnostics,
        artifacts: compiledArtifacts,
        deployments: {},
        steps: [],
        startedAt,
        finishedAt: new Date().toISOString()
      };
      await api.publishResult(jobId, result, renderHtmlReport(result));
      return result;
    }

    const chain = CHAINS[request.chain];
    const remoteMode = request.simulation.engine.mode === 'remote-rpc';

    if (remoteMode) {
      const remoteSlots = loadRemoteRpcSlots({ chainName: request.chain, environment });
      const selectedSlot = selectRemoteRpcSlot(remoteSlots, { stickyKey: jobId });
      await api.updateStatus(jobId, {
        status: 'running',
        stage: 'starting_remote_fork',
        slotId: selectedSlot.id
      });

      engine = await startEngine({
        mode: 'remote-rpc',
        preference: ['remote-rpc'],
        fallbackOn: [],
        engines: request.simulation.engine.engines,
        comparison: request.simulation.engine.comparison,
        options: request.simulation.engine.options,
        artifacts: compilation.artifacts,
        workflow: request.workflow,
        chainId: chain.chainId,
        rpcUrl: selectedSlot.url,
        configuration: request.simulation
      });
      engineIdentity = { name: engine.name, version: engine.version };
      runtimeEvidence = typeof engine.getEvidence === 'function' ? await engine.getEvidence() : undefined;
      resolvedBlock = runtimeEvidence?.initialBlockNumber;
      resolvedBlockHash = runtimeEvidence?.initialBlockHash;
      resolvedBlockTimestamp = runtimeEvidence?.initialBlockTimestamp;
      forkTransport = {
        assurance: 'remote-mutable-rpc',
        slotId: selectedSlot.id,
        secretName: selectedSlot.secretName,
        sourceChainId: chain.chainId,
        rpcChainId: runtimeEvidence?.rpcChainId ?? runtimeEvidence?.chainId,
        stickyForWholeRun: true,
        localExecution: false
      };

      await api.updateStatus(jobId, { status: 'running', stage: 'executing_workflow' });
      const execution = await executeWorkflow(request.workflow, engine.runtime, { aliases: engine.aliases });
      steps = execution.steps;
      deployments = execution.context.deployments;
      await closeActiveEngine();
      forkTransport.cleanupVerified = runtimeEvidence?.persistentForkRestoredOnClose === true;
      if (!forkTransport.cleanupVerified) {
        throw new Error('Remote fork cleanup was not verified before result publication');
      }
    } else {
      rpcHealthSession = await openRpcHealthSession({
        environment,
        chain: request.chain,
        crossSessionFailureThreshold: request.simulation.rpc.health.crossSessionFailureThreshold,
        store: services.rpcHealthStore
      });
      const configuredSlots = loadArchiveRpcSlots({
        chainName: request.chain,
        legacyEnv: chain.rpcEnv,
        environment,
        allowLegacyFallback: request.simulation.rpc.allowLegacyRpcFallback
      });
      const slots = filterDisabledRpcSlots(configuredSlots, rpcHealthSession.disabledSlotIds);
      if (slots.length === 0) {
        throw new Error(`No healthy archive RPC slots are configured for ${request.chain}`);
      }

      await api.updateStatus(jobId, { status: 'running', stage: 'starting_fork' });
      forkProxy = await startProxy({
        slots,
        chainId: chain.chainId,
        blockPolicy: request.simulation.fork.start,
        routing: {
          distribution: request.simulation.rpc.distribution,
          methodRoutes: request.simulation.rpc.methodRoutes,
          allowPrimaryForSecondaryFailure: request.simulation.rpc.allowPrimaryForSecondaryFailure,
          allowSecondaryForPrimaryFailure: request.simulation.rpc.allowSecondaryForPrimaryFailure,
          unknownMethodPool: request.simulation.rpc.unknownMethodPool,
          retryDelaysMs: request.simulation.rpc.retryDelaysMs,
          requestTimeoutMs: request.simulation.rpc.requestTimeoutMs
        },
        healthPolicy: request.simulation.rpc.health,
        consistency: request.simulation.rpc.consistency
      });
      resolvedBlock = forkProxy.blockNumber;
      resolvedBlockHash = forkProxy.blockHash;
      resolvedBlockTimestamp = forkProxy.blockTimestamp;
      forkTransport = forkProxy.diagnostics;
      engine = await raceWithRpcPolicyTermination(
        startEngine({
          mode: request.simulation.engine.mode,
          preference: request.simulation.engine.preference,
          fallbackOn: request.simulation.engine.fallbackOn,
          engines: request.simulation.engine.engines,
          comparison: request.simulation.engine.comparison,
          options: request.simulation.engine.options,
          artifacts: compilation.artifacts,
          workflow: request.workflow,
          chainId: chain.chainId,
          forkUrl: forkProxy.url,
          forkControl: forkProxy,
          block: resolvedBlock,
          configuration: request.simulation
        }),
        forkProxy.termination,
        { async onLateValue(lateEngine) { await Promise.resolve(lateEngine?.close?.()).catch(() => {}); } }
      );
      engineIdentity = { name: engine.name, version: engine.version };

      await api.updateStatus(jobId, { status: 'running', stage: 'executing_workflow' });
      const execution = await raceWithRpcPolicyTermination(
        executeWorkflow(request.workflow, engine.runtime, { aliases: engine.aliases }),
        forkProxy.termination
      );
      steps = execution.steps;
      deployments = execution.context.deployments;
      runtimeEvidence = typeof engine.getEvidence === 'function' ? await engine.getEvidence() : undefined;
      await persistRpcHealth();
    }

    const result = {
      jobId,
      status: 'completed',
      mode: 'simulate',
      chain: request.chain,
      chainId: chain.chainId,
      block: request.block,
      simulation: request.simulation,
      resolvedBlock,
      resolvedBlockHash,
      resolvedBlockTimestamp,
      engine: normalizedEngineEvidence(engineIdentity, request.simulation.engine.mode, runtimeEvidence),
      forkTransport,
      rpcHealth: rpcHealthSession ? { load: rpcHealthSession.load, persist: rpcHealthPersist } : undefined,
      compilerVersion: request.compilerVersion,
      compilerDiagnostics,
      artifacts: compiledArtifacts,
      deployments,
      steps,
      startedAt,
      finishedAt: new Date().toISOString()
    };
    await api.publishResult(jobId, result, renderHtmlReport(result));
    return result;
  } catch (cause) {
    if (cause.compilerDiagnostics) compilerDiagnostics = cause.compilerDiagnostics;
    if (cause.workflowSteps) steps = cause.workflowSteps;
    if (cause.workflowContext?.deployments) deployments = cause.workflowContext.deployments;
    if (engine && request?.simulation?.engine?.mode === 'remote-rpc') {
      try {
        await closeActiveEngine();
        if (forkTransport) forkTransport.cleanupVerified = runtimeEvidence?.persistentForkRestoredOnClose === true;
      } catch (cleanupError) {
        cause.cleanupError = serializeError(cleanupError, environment);
      }
    }
    try { await persistRpcHealth(); } catch (healthError) { cause.rpcHealthError = healthError; }
    const result = {
      jobId,
      status: 'failed',
      mode: request?.mode,
      chain: request?.chain,
      block: request?.block,
      simulation: request?.simulation,
      resolvedBlock,
      resolvedBlockHash,
      resolvedBlockTimestamp,
      engine: normalizedEngineEvidence(engineIdentity, request?.simulation?.engine?.mode, runtimeEvidence),
      forkTransport,
      rpcHealth: rpcHealthSession ? { load: rpcHealthSession.load, persist: rpcHealthPersist } : undefined,
      compilerVersion: request?.compilerVersion,
      compilerDiagnostics,
      artifacts: compiledArtifacts,
      deployments,
      steps,
      error: serializeError(cause, environment),
      startedAt,
      finishedAt: new Date().toISOString()
    };
    try {
      await api.publishResult(jobId, result, renderHtmlReport(result));
    } catch (publishError) {
      console.error('Failed to publish failure report', publishError);
      try { await api.updateStatus(jobId, { status: 'failed', stage: 'runner', error: result.error }); } catch {}
    }
    throw cause;
  } finally {
    if (engine) await Promise.resolve(engine.close()).catch(() => {});
    if (forkProxy) await Promise.resolve(forkProxy.close()).catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  }
}
