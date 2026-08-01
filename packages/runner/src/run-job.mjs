import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CHAINS, validateCreateJobRequest } from '../../protocol/src/index.mjs';
import { RunnerApiClient } from './api-client.mjs';
import { collectSoliditySources, compileProject } from './compiler.mjs';
import { startGanacheEngine } from './engine.mjs';
import { startForkRpcGuard } from './fork-rpc-guard.mjs';
import { materializeOpenZeppelin, materializeProject } from './project.mjs';
import { renderHtmlReport } from './report.mjs';
import { raceWithRpcPolicyTermination } from './rpc-method-policy.mjs';
import { executeWorkflow } from './workflow.mjs';

function serializeError(cause) {
  return {
    name: cause?.name ?? 'Error',
    message: cause?.message ?? String(cause),
    code: cause?.code,
    rpcCode: cause?.rpcCode,
    method: cause?.method,
    shortMessage: cause?.shortMessage,
    data: cause?.data
  };
}

export async function runJob({ jobId, apiUrl, runnerApiKey, environment = process.env }) {
  const api = new RunnerApiClient({ baseUrl: apiUrl, apiKey: runnerApiKey });
  const startedAt = new Date().toISOString();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `preflightsim-${jobId}-`));
  let engine;
  let forkGuard;
  let forkTransport;
  let request;
  let compilerDiagnostics = [];
  let steps = [];
  let deployments = {};
  let compiledArtifacts = [];
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
      settings: {
        optimizer: request.optimizer,
        viaIR: request.viaIR,
        evmVersion: request.evmVersion
      },
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
    const rpcUrl = environment[chain.rpcEnv];
    if (!rpcUrl) throw new Error(`Runner secret ${chain.rpcEnv} is not configured`);

    await api.updateStatus(jobId, { status: 'running', stage: 'starting_fork' });
    forkGuard = await startForkRpcGuard({ upstreamUrl: rpcUrl });
    forkTransport = forkGuard.diagnostics;
    engine = await raceWithRpcPolicyTermination(
      startGanacheEngine({
        artifacts: compilation.artifacts,
        workflow: request.workflow,
        chainId: chain.chainId,
        forkUrl: forkGuard.url,
        block: request.block
      }),
      forkGuard.termination,
      {
        async onLateValue(lateEngine) {
          await lateEngine?.close?.().catch(() => {});
        }
      }
    );

    await api.updateStatus(jobId, { status: 'running', stage: 'executing_workflow' });
    const execution = await raceWithRpcPolicyTermination(
      executeWorkflow(request.workflow, engine.runtime, { aliases: engine.aliases }),
      forkGuard.termination
    );
    steps = execution.steps;
    deployments = execution.context.deployments;

    const result = {
      jobId,
      status: 'completed',
      mode: 'simulate',
      chain: request.chain,
      chainId: chain.chainId,
      block: request.block,
      forkTransport,
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
    const result = {
      jobId,
      status: 'failed',
      mode: request?.mode,
      chain: request?.chain,
      block: request?.block,
      forkTransport,
      compilerVersion: request?.compilerVersion,
      compilerDiagnostics,
      artifacts: compiledArtifacts,
      deployments,
      steps,
      error: serializeError(cause),
      startedAt,
      finishedAt: new Date().toISOString()
    };
    try {
      await api.publishResult(jobId, result, renderHtmlReport(result));
    } catch (publishError) {
      console.error('Failed to publish failure report', publishError);
      try {
        await api.updateStatus(jobId, { status: 'failed', stage: 'runner', error: result.error });
      } catch {}
    }
    throw cause;
  } finally {
    if (engine) await engine.close().catch(() => {});
    if (forkGuard) await forkGuard.close().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  }
}
