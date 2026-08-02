import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs,runCli,CLI_EXIT_CODES } from '../apps/audit-github-direct-cli/src/cli.mjs';

const at='2026-08-01T23:40:00.000Z';
const common=['--repository-id','123','--installation-id','456','--repository','curveyield/contract-automation','--requester','user-1','--policy','direct-policy-v1','--profile','hardhat-test-v1','--parser','hardhat-test-parser-v1','--result-contract','phase5-tool-result-v1','--report-contract','audit-report-v1','--target-sha','a'.repeat(40),'--requested-at',at,'--idempotency-key','request-1','--at',at];

test('all six CLI commands parse to exact service commands',()=>{
  const variants=[
    ['submit',...common,'--result-id','result-1','--report-id','report-1','--comment','submitted'],
    ['status',...common],
    ['cancel',...common,'--reason','user-cancelled'],
    ['report',...common,'--result-id','result-1','--report-id','report-1','--comment','reported'],
    ['capabilities',...common],
    ['verify-fixture',...common,'--source-sha','a'.repeat(40)]
  ];
  assert.deepEqual(variants.map(args=>parseCliArgs(args).kind),['submit','status','cancel','report','capabilities','verify-fixture']);
});

test('CLI rejects unknown, duplicate, missing, URL, path, command, runner, and token flags',()=>{
  for(const pair of [['--url','https://evil.test'],['--path','../../x'],['--command','npm test'],['--runner','self-hosted'],['--token','ghs_secret']]){
    assert.throws(()=>parseCliArgs(['status',...common,...pair]));
  }
  assert.throws(()=>parseCliArgs(['status',...common,'--at',at]));
  assert.throws(()=>parseCliArgs(['status',...common.slice(0,-2)]));
});

test('CLI emits deterministic one-line JSON and stable exit codes',async()=>{
  const outputs=[],errors=[];
  const successService={execute:async command=>({schemaVersion:'github-direct-service-result-v1',state:'completed',jobId:command.request.jobId,targetCommitSha:command.request.targetCommitSha,cloudflareFallback:false})};
  const ok=await runCli({argv:['status',...common],service:successService,stdout:x=>outputs.push(x),stderr:x=>errors.push(x)});
  assert.equal(ok,CLI_EXIT_CODES.success);
  assert.equal(outputs.length,1);assert.equal(outputs[0].split('\n').length,2);assert.equal(errors.length,0);
  const unavailable=await runCli({argv:['status',...common],service:{execute:async()=>({schemaVersion:'github-direct-service-result-v1',state:'execution_plane_unavailable'})},stdout:x=>outputs.push(x),stderr:x=>errors.push(x)});
  assert.equal(unavailable,CLI_EXIT_CODES.execution_unavailable);
  const invalid=await runCli({argv:['status','--url','https://evil.test'],service:successService,stdout:x=>outputs.push(x),stderr:x=>errors.push(x)});
  assert.equal(invalid,CLI_EXIT_CODES.invalid_input);
  assert.doesNotMatch(errors.at(-1),/evil\.test|https?:/i);
});

test('service error mapping is stable and secret-safe',async()=>{
  const cases=[['authorization_denied',3],['stale_state',4],['publication_conflict',4],['transport_failure',6]];
  for(const [code,want] of cases){
    const err=[];
    const got=await runCli({argv:['status',...common],service:{execute:async()=>({schemaVersion:'github-direct-service-error-v1',code,message:'GitHub Direct service operation failed'})},stderr:x=>err.push(x)});
    assert.equal(got,want);
    assert.doesNotMatch(err[0],/ghs_|bearer|secret|https?:/i);
  }
});
