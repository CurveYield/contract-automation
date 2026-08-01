import test from 'node:test';
import assert from 'node:assert/strict';
async function protocol(){try{return await import('../packages/audit-fork-protocol/src/index.mjs');}catch(cause){assert.fail(`Phase 7 protocol module unavailable: ${cause.code}`);}}
const base={schemaVersion:'fork-action-request-v1',forkId:'fork_'+'4'.repeat(32),attemptId:'att_'+'5'.repeat(32),actionId:'act_00000001',requestedAt:'2026-08-01T00:00:00.000Z'};
test('accepts bounded structured no-wallet actions',async()=>{const p=await protocol(); for(const action of [
 {...base,type:'read_call',payload:{target:'0x'+'1'.repeat(40),inputHex:'0x12345678',maxReturnBytes:4096}},
 {...base,actionId:'act_00000002',type:'inspect_state',payload:{address:'0x'+'2'.repeat(40),slots:['0x'+'0'.repeat(64)]}},
 {...base,actionId:'act_00000003',type:'advance_time',payload:{seconds:3600}},
 {...base,actionId:'act_00000004',type:'advance_blocks',payload:{blocks:100}},
 {...base,actionId:'act_00000005',type:'snapshot',payload:{label:'before-upgrade'}},
 {...base,actionId:'act_00000006',type:'restore',payload:{checkpointId:'snap_'+'6'.repeat(32)}},
 {...base,actionId:'act_00000007',type:'state_override',payload:{address:'0x'+'3'.repeat(40),slots:[{slot:'0x'+'0'.repeat(64),value:'0x'+'f'.repeat(64)}]}}
 ]) assert.equal(p.validateForkActionRequest(action).type,action.type);});
test('rejects credentials, network endpoints, executable intent, and unbounded payloads',async()=>{const p=await protocol(); for(const payload of [{wallet:'x'},{privateKey:'x'},{rpcUrl:'https://x'},{rawTransaction:'0x01'},{broadcast:true},{script:'x'},{containerImage:'x'},{url:'https://x'}]) assert.throws(()=>p.validateForkActionRequest({...base,type:'snapshot',payload}),{code:'forbidden_field'}); assert.throws(()=>p.validateForkActionRequest({...base,type:'advance_blocks',payload:{blocks:10001}}),{code:'invalid_limit'});});
