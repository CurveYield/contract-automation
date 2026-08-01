import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { CHAINS } from '../../protocol/src/index.mjs';
import {
  buildCompilerInput,
  collectSoliditySources,
  compileProject
} from '../../runner/src/compiler.mjs';
import { startGanacheEngine } from '../../runner/src/engine.mjs';
import { materializeOpenZeppelin } from '../../runner/src/project.mjs';
import { renderHtmlReport } from '../../runner/src/report.mjs';
import { executeWorkflow } from '../../runner/src/workflow.mjs';
import { startForkRpcProxy } from './fork-rpc-proxy.mjs';
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
    index.push({
      sourceName: artifact.sourceName,
      contractName: artifact.contractName,
      file
    });
  }
  await writeJson(path.join(artifactDirectory, 'index.json'), index);
}

function redactText(value, environment) {
  if (typeof value !== 'string') return value;
  let output = value;
  for (const [key, secret] of Object.entries(environment ?? {})) {
    if (!key.startsWith('RPC_') || typeof secret !== 'string' || secret.length === 0) continue;
    output = output.replaceAll(secret, `[redacted:${key}]`);
  }
  return output;
}

function serializeError(cause, environment) {
  return {
    name: cause?.name ?? 'Error',
    message: redactText(cause?.message ?? String(cause), environment),
    code: cause?.code,
    shortMessage: redactText(cause?.shortMessage, environment),
    data: cause?.data
  };
}

async function writeResultBundle(outputDir, result) {
  await writeJson(path.join(outputDir, 'result.json'), result);
  await writeTextAtomic(path.join(outputDir, 'report.html'), renderHtmlReport(result));
}

export async function runGitHubNativeJob({
  jobFile,
  outputDir,
  environment = process.env,
  services = {}
}) {
  if (typeof jobFile !== 'string' || jobFile.length === 0) throw new Error('jobFile is required');
  if (typeof outputDir !== 'string' || outputDir.length === 0) throw new Error('outputDir is required');

  const startProxy = services.startForkRpcProxy ?? startForkRpcProxy;
  const startEngine = services.startGanacheEngine ?? startGanacheEngine;
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
  let forkTransport;

  await fs.mkdir(absoluteOutputDir, { recursive: true });

  try {
    const raw = JSON.parse(await fs.readFile(absoluteJobFile, 'utf8'));
    job = validateGitHubNativeJob(raw);
    const projectRoot = resolveJobProjectRoot(absoluteJobFile, job.projectPath);
    const sources = await collectSoliditySources(projectRoot);
    const settings = {
      optimizer: job.optimizer,
      viaIR: job.viaIR,
      evmVersion: job.evmVersion
    };

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
      const rpcUrl = environment[chain.rpcEnv];
      if (!rpcUrl) throw new Error(`Runner secret ${chain.rpcEnv} is not configured`);

      forkProxy = await startProxy({ upstreamUrl: rpcUrl, block: job.block });
      resolvedBlock = forkProxy.blockNumber;
      forkTransport = forkProxy.diagnostics;
      engine = await startEngine({
        artifacts: compilation.artifacts,
        workflow: job.workflow,
        chainId: chain.chainId,
        forkUrl: forkProxy.url,
        block: resolvedBlock
      });
      const execution = await executeWorkflow(job.workflow, engine.runtime, { aliases: engine.aliases });
      steps = execution.steps;
      deployments = execution.context.deployments;
    }

    const result = {
      jobId: job.id,
      status: 'completed',
      transport: 'github-native',
      mode: job.mode,
      chain: job.chain,
      chainId: job.chain ? CHAINS[job.chain].chainId : undefined,
      block: job.block,
      resolvedBlock,
      forkTransport,
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

    try {
      await writeJson(path.join(absoluteOutputDir, 'compiler-diagnostics.json'), compilerDiagnostics);
      if (compiledArtifacts.length > 0) await writeArtifacts(absoluteOutputDir, compiledArtifacts);
      const result = {
        jobId: job?.id ?? path.basename(path.dirname(absoluteJobFile)),
        status: 'failed',
        transport: 'github-native',
        mode: job?.mode,
        chain: job?.chain,
        chainId: job?.chain ? CHAINS[job.chain]?.chainId : undefined,
        block: job?.block,
        resolvedBlock,
        forkTransport,
        compilerVersion: job?.compilerVersion,
        compilerDiagnostics,
        artifacts: compiledArtifacts,
        deployments,
        steps,
        error: serializeError(cause, environment),
        startedAt,
        finishedAt: new Date().toISOString()
      };
      await writeResultBundle(absoluteOutputDir, result);
      cause.githubNativeResult = result;
    } catch (writeCause) {
      cause.githubNativeOutputError = serializeError(writeCause, environment);
    }
    throw cause;
  } finally {
    if (engine) await engine.close().catch(() => {});
    if (forkProxy) await forkProxy.close().catch(() => {});
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}
