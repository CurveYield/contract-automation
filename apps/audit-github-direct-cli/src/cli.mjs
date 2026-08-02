import { createDirectRequest,integer,fullName,identifier,versionSlug,commitSha,timestamp,boundedString,exactKeys,fail } from '../../../packages/audit-github-direct-protocol/src/index.mjs';
import { createServiceCommand,createServiceResult,SERVICE_COMMANDS,validateServiceResult,validateServiceError } from '../../../packages/audit-github-direct-service/src/index.mjs';
export const CLI_EXIT_CODES=Object.freeze({success:0,invalid_input:2,authorization_denied:3,conflict:4,execution_unavailable:5,service_failure:6});
const COMMON=Object.freeze(['repository-id','installation-id','repository','requester','policy','profile','parser','result-contract','report-contract','target-sha','requested-at','idempotency-key','at']);
const COMMAND_FLAGS=Object.freeze({submit:['result-id','report-id','comment'],status:[],cancel:['reason'],report:['result-id','report-id','comment'],capabilities:[],'verify-fixture':['source-sha']});
function parseFlags(tokens,allowed){const out={};for(let i=0;i<tokens.length;i+=2){const flag=tokens[i];if(typeof flag!=='string'||!flag.startsWith('--')||i+1>=tokens.length)fail('invalid_cli_flag','$');const key=flag.slice(2);if(!allowed.includes(key))fail('unknown_cli_flag',`$.${key}`);if(Object.hasOwn(out,key))fail('duplicate_cli_flag',`$.${key}`);out[key]=tokens[i+1];}for(const key of allowed)if(!Object.hasOwn(out,key))fail('missing_cli_flag',`$.${key}`);return out;}
function parsePositiveInteger(value,path){if(typeof value!=='string'||!/^[0-9]+$/.test(value))fail('invalid_integer',path);return integer(Number(value),path,1);}
export function parseCliArgs(argv){if(!Array.isArray(argv)||argv.length<1)fail('invalid_cli_args','$');const kind=argv[0];if(!SERVICE_COMMANDS.includes(kind))fail('invalid_cli_command','$.command');const allowed=[...COMMON,...COMMAND_FLAGS[kind]],flags=parseFlags(argv.slice(1),allowed),request=createDirectRequest({repositoryId:parsePositiveInteger(flags['repository-id'],'$.repository-id'),installationId:parsePositiveInteger(flags['installation-id'],'$.installation-id'),repositoryFullName:fullName(flags.repository,'$.repository'),requesterId:identifier(flags.requester,'$.requester'),policyVersion:versionSlug(flags.policy,'$.policy'),profileId:versionSlug(flags.profile,'$.profile'),parserVersion:versionSlug(flags.parser,'$.parser'),resultContractVersion:versionSlug(flags['result-contract'],'$.result-contract'),reportContractVersion:versionSlug(flags['report-contract'],'$.report-contract'),targetCommitSha:commitSha(flags['target-sha'],'$.target-sha'),requestedAt:timestamp(flags['requested-at'],'$.requested-at'),idempotencyKey:identifier(flags['idempotency-key'],'$.idempotency-key')}),input={kind,request,at:timestamp(flags.at,'$.at')};if(kind==='submit'||kind==='report'){input.resultId=identifier(flags['result-id'],'$.result-id');input.reportId=identifier(flags['report-id'],'$.report-id');input.commentBody=boundedString(flags.comment,'$.comment',16_000);}else if(kind==='cancel')input.reasonCode=identifier(flags.reason,'$.reason');else if(kind==='verify-fixture')input.sourceCommitSha=commitSha(flags['source-sha'],'$.source-sha');return createServiceCommand(input);}
function stableJson(value){return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);}
export async function runCli(input){
  const {argv,service,stdout=()=>{},stderr=()=>{}}=input??{};
  if(!service||typeof service.execute!=='function')throw new TypeError('service.execute is required');
  let command;
  try{command=parseCliArgs(argv);}catch(error){const payload={schemaVersion:'github-direct-cli-error-v1',code:error?.code??'invalid_input',message:'Invalid GitHub Direct CLI input'};stderr(`${stableJson(payload)}\n`);return CLI_EXIT_CODES.invalid_input;}
  const raw=await service.execute(command);
  let result;
  try{
    if(raw?.schemaVersion==='github-direct-service-error-v1')result=validateServiceError(raw);
    else if(raw?.schemaVersion==='github-direct-service-result-v1'){
      const legacy=exactKeys(raw,['schemaVersion','modeId','commandKind','jobId','targetCommitSha','state','data','completedAt','cloudflareFallback'],'$.legacyResult');
      if(legacy.modeId!=='github-direct-audit-v1'||legacy.commandKind!==command.kind||legacy.jobId!==command.request.jobId||legacy.targetCommitSha!==command.request.targetCommitSha||legacy.cloudflareFallback!==false)fail('service_identity_mismatch','$.legacyResult');
      result=createServiceResult({command,state:legacy.state,data:legacy.data,completedAt:legacy.completedAt});
    }else result=validateServiceResult(raw);
  }catch{const payload={schemaVersion:'github-direct-cli-error-v1',code:'service_failure',message:'GitHub Direct service returned an invalid response'};stderr(`${stableJson(payload)}\n`);return CLI_EXIT_CODES.service_failure;}
  const text=`${stableJson(result)}\n`;
  if(result.schemaVersion==='github-direct-service-error-v1'){stderr(text);if(result.code==='authorization_denied')return CLI_EXIT_CODES.authorization_denied;if(result.code==='stale_state'||result.code==='publication_conflict')return CLI_EXIT_CODES.conflict;return CLI_EXIT_CODES.service_failure;}
  stdout(text);return result.state==='execution_plane_unavailable'?CLI_EXIT_CODES.execution_unavailable:CLI_EXIT_CODES.success;
}
