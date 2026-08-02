import { runCli } from './cli.mjs';
import { createWorkflowService } from './workflow-host.mjs';

const service=createWorkflowService({environment:process.env,fetchImpl:globalThis.fetch});
const exitCode=await runCli({
  argv:process.argv.slice(2),
  service,
  stdout:(text)=>process.stdout.write(text),
  stderr:(text)=>process.stderr.write(text)
});
process.exitCode=exitCode;
