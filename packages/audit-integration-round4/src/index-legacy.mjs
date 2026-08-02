export class Round4IntegrationError extends Error {
  constructor(code, path, message = code) {
    super(String(message).slice(0, 320));
    this.name = 'Round4IntegrationError';
    this.code = code;
    this.path = path;
  }
}
const fail = (code, path, message) => { throw new Round4IntegrationError(code, path, message); };
const SHA = /^[0-9a-f]{40}$/;
const IDENTIFIER = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const NAME = /^[A-Z][A-Z0-9_]{1,127}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const ACCEPT = new Set(['ACCEPT','ACCEPT WITH REPAIR']);

function inspect(value, path) {
  try {
    return {
      prototype: Object.getPrototypeOf(value),
      keys: Reflect.ownKeys(value),
      descriptors: new Map(Object.entries(Object.getOwnPropertyDescriptors(value)))
    };
  } catch { fail('hostile_reflection', path); }
}
function safe(value, path = '$', seen = new WeakSet(), depth = 0) {
  if (depth > 32) fail('graph_too_deep', path);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > 100_000 || CONTROL.test(value)) fail('invalid_string', path);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('invalid_number', path);
    return value;
  }
  if (typeof value !== 'object') fail('invalid_type', path);
  if (seen.has(value)) fail('cyclic_value', path);
  seen.add(value);
  const { prototype, keys, descriptors } = inspect(value, path);
  for (const key of keys) if (typeof key === 'symbol') fail('symbol_field', path);
  let output;
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail('invalid_array', path);
    const length = descriptors.get('length')?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 20_000) fail('invalid_array', path);
    output = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors.get(String(index));
      if (!descriptor) fail('sparse_array', `${path}[${index}]`);
      if (!Object.hasOwn(descriptor, 'value')) fail('accessor_field', `${path}[${index}]`);
      if (descriptor.enumerable !== true) fail('hidden_field', `${path}[${index}]`);
      output[index] = safe(descriptor.value, `${path}[${index}]`, seen, depth + 1);
    }
    for (const key of keys) if (key !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(String(key)) || Number(key) >= length)) fail('array_property', path);
  } else {
    if (prototype !== Object.prototype && prototype !== null) fail('invalid_object', path);
    output = {};
    for (const key of keys.map(String).sort()) {
      const descriptor = descriptors.get(key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('accessor_field', `${path}.${key}`);
      if (descriptor.enumerable !== true) fail('hidden_field', `${path}.${key}`);
      output[key] = safe(descriptor.value, `${path}.${key}`, seen, depth + 1);
    }
  }
  seen.delete(value);
  return output;
}
function freeze(value) {
  const output = safe(value);
  const visit = (item) => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) {
      for (const child of Object.values(item)) visit(child);
      Object.freeze(item);
    }
  };
  visit(output);
  return output;
}
function object(value, path, required, optional = []) {
  const output = safe(value, path);
  if (!output || typeof output !== 'object' || Array.isArray(output)) fail('invalid_object', path);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(output)) if (!allowed.has(key)) fail('unknown_field', `${path}.${key}`);
  for (const key of required) if (!Object.hasOwn(output, key)) fail('missing_field', `${path}.${key}`);
  return output;
}
function string(value, path, maximum = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || CONTROL.test(value)) fail('invalid_string', path);
  return value;
}
function id(value, path) {
  const output = string(value, path, 128);
  if (!IDENTIFIER.test(output) || output.includes('..')) fail('invalid_identifier', path);
  return output;
}
function pathValue(value, path) {
  const output = string(value, path, 512).replaceAll('\\','/');
  if (output.startsWith('/') || output.includes('//') || output.split('/').includes('..') || !/^[A-Za-z0-9_.@+*/\/-]+$/.test(output)) fail('unsafe_path', path);
  return output;
}
function sha(value, path) { if (typeof value !== 'string' || !SHA.test(value)) fail('invalid_sha', path); return value; }
function integer(value, path, min = 0, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < min || value > max) fail('invalid_integer', path); return value; }
function array(value, path, maximum = 1000) { const output = safe(value, path); if (!Array.isArray(output) || output.length > maximum) fail('invalid_array', path); return output; }
function sortedUnique(value, path, validator, maximum = 1000) {
  const output = array(value, path, maximum).map((item,index)=>validator(item,`${path}[${index}]`));
  if (new Set(output).size !== output.length) fail('duplicate_value', path);
  return output.sort();
}
function overlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`) ||
    (right.endsWith('-') && left.startsWith(right)) || (left.endsWith('-') && right.startsWith(left));
}
function fieldOverlap(left, right) {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`) || left.startsWith(`${right}[`) || right.startsWith(`${left}[`);
}

export const ROUND4_PROTECTED_BLOBS = freeze([
  {path:'.github/workflows/github-native-simulate.yml',blobSha:'54e446d4a715ca9678ed4d7434f7ba90b2c67c96'},
  {path:'packages/runner/src/rpc-method-policy.mjs',blobSha:'59dfa72f41a697d533720a4d8f939a81aeba6736'},
  {path:'packages/runner/src/fork-rpc-guard.mjs',blobSha:'73690f16b506baa50ca471ce5b5566ccb601e765'},
  {path:'packages/runner/src/run-job.mjs',blobSha:'e6489c756d43a2f294120ac3c84687030fb919db'},
  {path:'packages/github-native-sim/src/fork-rpc-proxy.mjs',blobSha:'4d7e2bd1114f5a37914b26447c9c79a1e40a58e6'},
  {path:'packages/github-native-sim/src/run-job-file.mjs',blobSha:'8c4c82d76e249b74efc630c8cbf0d7707d25b5f2'}
]);

export const ROUND4_CANDIDATE_SLOTS = freeze([
  {candidateId:'phase1-6-reviewed',workerId:'worker-0',issueNumber:120,branch:'audit-round4/review-integration-spine-v1',startingSha:'5914b03382422ea714346625a601b5dbda3aa0cd',sourceIssues:[114,119],sourceFinalShas:['5914b03382422ea714346625a601b5dbda3aa0cd'],requiredManifestSchemas:['round4-stage-a-review-manifest-v1','audit-release-component-manifest-v1','audit-public-interface-lock-v1'],resolvedFinalSha:null},
  {candidateId:'phase7-8-reviewed',workerId:'worker-1',issueNumber:121,branch:'audit-round4/review-phase78-api-compat-v1',startingSha:'4d7513b7eabd2e2217b1e3fed43d999df828a93f',sourceIssues:[112,113,119],sourceFinalShas:['4d7513b7eabd2e2217b1e3fed43d999df828a93f','6d877e2d87f1a91380a6c5d1efc47550527d8729'],requiredManifestSchemas:['round4-stage-a-review-manifest-v1','audit-release-component-manifest-v1','audit-public-interface-lock-v1'],resolvedFinalSha:null},
  {candidateId:'api-auth-reviewed',workerId:'worker-3',issueNumber:123,branch:'audit-round4/review-api-auth-security-v1',startingSha:'6d877e2d87f1a91380a6c5d1efc47550527d8729',sourceIssues:[113,115,119],sourceFinalShas:['6d877e2d87f1a91380a6c5d1efc47550527d8729','1672b31a71674dd78eddc3bf5fc2fbe39d4ae07d'],requiredManifestSchemas:['round4-stage-a-review-manifest-v1','audit-release-component-manifest-v1','audit-public-interface-lock-v1'],resolvedFinalSha:null},
  {candidateId:'web-direct-reviewed',workerId:'worker-4',issueNumber:124,branch:'audit-round4/review-web-direct-e2e-v1',startingSha:'fdc55d684be2cd5053c1e617aa09399fdfcf60c2',sourceIssues:[112,113,115,116,119],sourceFinalShas:['4d7513b7eabd2e2217b1e3fed43d999df828a93f','6d877e2d87f1a91380a6c5d1efc47550527d8729','1672b31a71674dd78eddc3bf5fc2fbe39d4ae07d','fdc55d684be2cd5053c1e617aa09399fdfcf60c2'],requiredManifestSchemas:['round4-stage-a-review-manifest-v1','audit-release-component-manifest-v1','audit-public-interface-lock-v1'],resolvedFinalSha:null}
]);

export function validateCompletedCandidateEvidence(slotInput, evidenceInput) {
  const slot = object(slotInput,'$.slot',['candidateId','workerId','issueNumber','branch','startingSha','sourceIssues','sourceFinalShas','requiredManifestSchemas','resolvedFinalSha']);
  if (slot.resolvedFinalSha !== null) fail('slot_already_resolved','$.slot.resolvedFinalSha');
  const evidence = object(evidenceInput,'$.evidence',['status','resolvedBranchHead','report','manifests']);
  const status = object(evidence.status,'$.evidence.status',[
    'protocolVersion','workerId','state','lastConsumedSequence','activeSequence','activeMessageId','issueNumber','branch','startingSha','finalSha','recommendation','reportReference','blockers','updatedAt'
  ],['round','roundType','stage','previousRound','productionIntakeBlockedUntil','reportCommentId','reportUrl']);
  if (status.protocolVersion !== 1) fail('invalid_protocol','$.evidence.status.protocolVersion');
  if (status.state !== 'completed' || status.activeSequence !== null || status.activeMessageId !== null || status.finalSha === null) fail('candidate_incomplete','$.evidence.status');
  if (status.workerId !== slot.workerId || status.issueNumber !== slot.issueNumber || status.branch !== slot.branch || status.startingSha !== slot.startingSha) fail('candidate_slot_mismatch','$.evidence.status');
  if (!ACCEPT.has(status.recommendation)) fail('candidate_rejected','$.evidence.status.recommendation');
  if (array(status.blockers,'$.evidence.status.blockers',64).length !== 0) fail('candidate_blocked','$.evidence.status.blockers');
  const finalSha = sha(status.finalSha,'$.evidence.status.finalSha');
  if (sha(evidence.resolvedBranchHead,'$.evidence.resolvedBranchHead') !== finalSha) fail('branch_head_mismatch','$.evidence.resolvedBranchHead');
  const report = object(evidence.report,'$.evidence.report',['issueNumber','commentId','url','finalSha','recommendation']);
  const expectedUrl = `https://github.com/CurveYield/contract-automation/issues/${slot.issueNumber}#issuecomment-${integer(report.commentId,'$.evidence.report.commentId',1)}`;
  if (report.issueNumber !== slot.issueNumber || report.url !== expectedUrl || report.finalSha !== finalSha || report.recommendation !== status.recommendation || status.reportReference !== expectedUrl) fail('report_reference_mismatch','$.evidence.report');
  const manifests = array(evidence.manifests,'$.evidence.manifests',64).map((entry,index)=>{
    const item = object(entry,`$.evidence.manifests[${index}]`,['schemaVersion','path','blobSha']);
    return {schemaVersion:id(item.schemaVersion,`$.evidence.manifests[${index}].schemaVersion`),path:pathValue(item.path,`$.evidence.manifests[${index}].path`),blobSha:sha(item.blobSha,`$.evidence.manifests[${index}].blobSha`)};
  }).sort((a,b)=>a.schemaVersion.localeCompare(b.schemaVersion));
  if (new Set(manifests.map((item)=>item.schemaVersion)).size !== manifests.length) fail('duplicate_manifest_schema','$.evidence.manifests');
  for (const required of slot.requiredManifestSchemas) if (!manifests.some((item)=>item.schemaVersion===required)) fail('missing_manifest_schema','$.evidence.manifests');
  return freeze({candidateId:slot.candidateId,workerId:slot.workerId,issueNumber:slot.issueNumber,branch:slot.branch,startingSha:slot.startingSha,finalSha,recommendation:status.recommendation,report:{issueNumber:report.issueNumber,commentId:report.commentId,url:report.url},manifests});
}

export const ROUND4_PRELIMINARY_OWNERSHIP = freeze({
  schemaVersion:'round4-preliminary-path-ownership-v1',
  domains:[
    {domain:'api',candidateId:'api-auth-reviewed',ownedPrefixes:['apps/audit-api','packages/audit-api-','packages/audit-auth-','packages/audit-gpt-'],ownedFiles:[],sharedFiles:['package.json']},
    {domain:'github-direct',candidateId:'web-direct-reviewed',ownedPrefixes:['packages/audit-github-direct','packages/github-direct-'],ownedFiles:['.github/workflows/audit-direct-v1.yml'],sharedFiles:['package.json']},
    {domain:'phase1-6-integration',candidateId:'phase1-6-reviewed',ownedPrefixes:['packages/audit-protocol','packages/audit-r2-store','packages/audit-profile-registry','packages/audit-workspace-protocol','packages/audit-workspaces','packages/audit-campaign-protocol','packages/audit-campaigns','packages/audit-evidence','packages/audit-tool-','packages/audit-executor-adapters','packages/audit-phase5-','packages/audit-phase6-','packages/audit-release-integration','packages/audit-integration-round4'],ownedFiles:[],sharedFiles:['package.json']},
    {domain:'phase7-8',candidateId:'phase7-8-reviewed',ownedPrefixes:['packages/audit-fork-','packages/audit-forks','packages/audit-clean-room-','packages/audit-controlled-merge','packages/audit-provenance'],ownedFiles:[],sharedFiles:['package.json']},
    {domain:'web',candidateId:'web-direct-reviewed',ownedPrefixes:['apps/audit-web','packages/audit-web-','packages/audit-ui-','packages/audit-report-view-'],ownedFiles:[],sharedFiles:['package.json']}
  ],
  protectedPaths:ROUND4_PROTECTED_BLOBS.map((item)=>item.path),
  sharedFiles:['package.json']
});

export function validatePathOwnershipRegistry(input) {
  const root = object(input,'$',['schemaVersion','domains','protectedPaths','sharedFiles']);
  if (root.schemaVersion !== 'round4-preliminary-path-ownership-v1') fail('invalid_schema_version','$.schemaVersion');
  const protectedPaths = sortedUnique(root.protectedPaths,'$.protectedPaths',pathValue,1000);
  const sharedFiles = sortedUnique(root.sharedFiles,'$.sharedFiles',pathValue,1000);
  const domains = array(root.domains,'$.domains',64).map((entry,index)=>{
    const item = object(entry,`$.domains[${index}]`,['domain','candidateId','ownedPrefixes','ownedFiles','sharedFiles']);
    return {domain:id(item.domain,`$.domains[${index}].domain`),candidateId:id(item.candidateId,`$.domains[${index}].candidateId`),ownedPrefixes:sortedUnique(item.ownedPrefixes,`$.domains[${index}].ownedPrefixes`,pathValue),ownedFiles:sortedUnique(item.ownedFiles,`$.domains[${index}].ownedFiles`,pathValue),sharedFiles:sortedUnique(item.sharedFiles,`$.domains[${index}].sharedFiles`,pathValue)};
  }).sort((a,b)=>a.domain.localeCompare(b.domain));
  if (new Set(domains.map((item)=>item.domain)).size !== domains.length) fail('duplicate_domain','$.domains');
  const claims=[];
  for (const domain of domains) {
    for (const claim of [...domain.ownedPrefixes,...domain.ownedFiles]) {
      if (protectedPaths.some((item)=>overlap(item,claim))) fail('protected_path','$.domains');
      const conflict = claims.find((item)=>overlap(item.path,claim));
      if (conflict && !sharedFiles.includes(claim)) fail('ownership_overlap','$.domains');
      claims.push({domain:domain.domain,path:claim});
    }
    for (const shared of domain.sharedFiles) if (!sharedFiles.includes(shared)) fail('unregistered_shared_file','$.domains');
  }
  return freeze({schemaVersion:root.schemaVersion,domains,protectedPaths,sharedFiles});
}

export function validateRound4SharedUnion(input) {
  const root = object(input,'$',['schemaVersion','path','baseBlobSha','inputs','outputBlobSha','requiredTests']);
  if (root.schemaVersion !== 'round4-shared-file-union-v1') fail('invalid_schema_version','$.schemaVersion');
  const inputs = array(root.inputs,'$.inputs',32).map((entry,index)=>{
    const item=object(entry,`$.inputs[${index}]`,['candidateId','blobSha','fields']);
    return {candidateId:id(item.candidateId,`$.inputs[${index}].candidateId`),blobSha:sha(item.blobSha,`$.inputs[${index}].blobSha`),fields:sortedUnique(item.fields,`$.inputs[${index}].fields`,string)};
  });
  if (inputs.length<2 || new Set(inputs.map((item)=>item.candidateId)).size!==inputs.length) fail('invalid_union_inputs','$.inputs');
  const sorted=[...inputs].sort((a,b)=>a.candidateId.localeCompare(b.candidateId));
  if (JSON.stringify(inputs)!==JSON.stringify(sorted)) fail('noncanonical_union_order','$.inputs');
  const fields=[];
  for(const item of inputs) for(const field of item.fields){if(fields.some((existing)=>fieldOverlap(existing,field))) fail('union_field_overlap','$.inputs');fields.push(field);}
  const requiredTests=sortedUnique(root.requiredTests,'$.requiredTests',pathValue,128);
  if(requiredTests.length<1) fail('missing_required_tests','$.requiredTests');
  return freeze({schemaVersion:root.schemaVersion,path:pathValue(root.path,'$.path'),baseBlobSha:sha(root.baseBlobSha,'$.baseBlobSha'),inputs,outputBlobSha:sha(root.outputBlobSha,'$.outputBlobSha'),requiredTests});
}

export const ROUND4_INTAKE_WAVES = freeze([
  {schemaVersion:'round4-intake-wave-template-v1',waveId:'phase1-8-core',state:'waiting-for-stage-a',requiredCandidateIds:['phase1-6-reviewed','phase7-8-reviewed'],allowedDomains:['phase1-6-integration','phase7-8'],requiredTests:['test/audit-round4-integration-core.test.mjs'],checkpointTitle:'Checkpoint 2 — Phase 1–8 core intake'},
  {schemaVersion:'round4-intake-wave-template-v1',waveId:'api-auth',state:'waiting-for-stage-a',requiredCandidateIds:['api-auth-reviewed'],allowedDomains:['api'],requiredTests:['test/audit-round4-integration-api-auth.test.mjs'],checkpointTitle:'Checkpoint 3A — API/auth intake'},
  {schemaVersion:'round4-intake-wave-template-v1',waveId:'github-direct-web',state:'waiting-for-stage-a',requiredCandidateIds:['web-direct-reviewed'],allowedDomains:['github-direct','web'],requiredTests:['test/audit-round4-integration-direct-web.test.mjs'],checkpointTitle:'Checkpoint 3B — GitHub Direct/web intake'},
  {schemaVersion:'round4-intake-wave-template-v1',waveId:'protected-addon-final',state:'waiting-for-stage-a',requiredCandidateIds:['phase1-6-reviewed','phase7-8-reviewed','api-auth-reviewed','web-direct-reviewed'],allowedDomains:[],requiredTests:['test/audit-round4-integration-protected-addon.test.mjs','test/audit-round4-integration-full.test.mjs'],checkpointTitle:'Checkpoint 4 — frozen assembled candidate'}
]);
export function validateIntakeWaveTemplate(input){
  const root=object(input,'$',['schemaVersion','waveId','state','requiredCandidateIds','allowedDomains','requiredTests','checkpointTitle']);
  if(root.schemaVersion!=='round4-intake-wave-template-v1') fail('invalid_schema_version','$.schemaVersion');
  if(root.state!=='waiting-for-stage-a') fail('premature_wave_state','$.state');
  const requiredCandidateIds=sortedUnique(root.requiredCandidateIds,'$.requiredCandidateIds',id,16);
  for(const candidateId of requiredCandidateIds){const slot=ROUND4_CANDIDATE_SLOTS.find((item)=>item.candidateId===candidateId);if(!slot)fail('unknown_candidate','$.requiredCandidateIds');if(slot.resolvedFinalSha!==null)fail('unexpected_resolved_slot','$.requiredCandidateIds');}
  return freeze({schemaVersion:root.schemaVersion,waveId:id(root.waveId,'$.waveId'),state:root.state,requiredCandidateIds,allowedDomains:sortedUnique(root.allowedDomains,'$.allowedDomains',id,16),requiredTests:sortedUnique(root.requiredTests,'$.requiredTests',pathValue,64),checkpointTitle:string(root.checkpointTitle,'$.checkpointTitle',160)});
}

export function validateRound5ProductionInput(input){
  const root=object(input,'$',['schemaVersion','secretNames','variableNames','cloudflare','github','rpcNetworks','caps','rollback','observability']);
  if(root.schemaVersion!=='round5-production-input-v1') fail('invalid_schema_version','$.schemaVersion');
  const secretNames=sortedUnique(root.secretNames,'$.secretNames',(value,path)=>{if(typeof value!=='string'||!NAME.test(value))fail('invalid_secret_name',path);return value;},256);
  const variableNames=sortedUnique(root.variableNames,'$.variableNames',(value,path)=>{if(typeof value!=='string'||!NAME.test(value))fail('invalid_variable_name',path);return value;},256);
  const cloudflare=object(root.cloudflare,'$.cloudflare',['workerName','pagesProject','zones','routes','r2Bindings','corsOrigins']);
  const r2Bindings=array(cloudflare.r2Bindings,'$.cloudflare.r2Bindings',32).map((entry,index)=>{const item=object(entry,`$.cloudflare.r2Bindings[${index}]`,['binding','bucket']);if(!NAME.test(item.binding))fail('invalid_binding_name',`$.cloudflare.r2Bindings[${index}].binding`);return{binding:item.binding,bucket:id(item.bucket,`$.cloudflare.r2Bindings[${index}].bucket`)}}).sort((a,b)=>a.binding.localeCompare(b.binding));
  const github=object(root.github,'$.github',['repository','environment','workflowPath']);
  const rpcNetworks=array(root.rpcNetworks,'$.rpcNetworks',32).map((entry,index)=>{const item=object(entry,`$.rpcNetworks[${index}]`,['name','secretName','readOnly']);if(!NAME.test(item.secretName)||!secretNames.includes(item.secretName))fail('invalid_secret_name',`$.rpcNetworks[${index}].secretName`);if(item.readOnly!==true)fail('writable_rpc_forbidden',`$.rpcNetworks[${index}].readOnly`);return{name:id(item.name,`$.rpcNetworks[${index}].name`),secretName:item.secretName,readOnly:true}}).sort((a,b)=>a.name.localeCompare(b.name));
  const caps=object(root.caps,'$.caps',['requestsPerMinute','dailyUsd','artifactBytes','retentionDays']);
  const rollback=object(root.rollback,'$.rollback',['requiredChecks','preservePreviousRelease']);
  if(rollback.preservePreviousRelease!==true)fail('rollback_required','$.rollback.preservePreviousRelease');
  const observability=object(root.observability,'$.observability',['fields','redactions']);
  return freeze({schemaVersion:root.schemaVersion,secretNames,variableNames,cloudflare:{workerName:id(cloudflare.workerName,'$.cloudflare.workerName'),pagesProject:id(cloudflare.pagesProject,'$.cloudflare.pagesProject'),zones:sortedUnique(cloudflare.zones,'$.cloudflare.zones',string),routes:sortedUnique(cloudflare.routes,'$.cloudflare.routes',string),r2Bindings,corsOrigins:sortedUnique(cloudflare.corsOrigins,'$.cloudflare.corsOrigins',string)},github:{repository:string(github.repository,'$.github.repository'),environment:id(github.environment,'$.github.environment'),workflowPath:pathValue(github.workflowPath,'$.github.workflowPath')},rpcNetworks,caps:{requestsPerMinute:integer(caps.requestsPerMinute,'$.caps.requestsPerMinute',1,10000),dailyUsd:integer(caps.dailyUsd,'$.caps.dailyUsd',0,100000),artifactBytes:integer(caps.artifactBytes,'$.caps.artifactBytes',1,1000000000),retentionDays:integer(caps.retentionDays,'$.caps.retentionDays',1,365)},rollback:{requiredChecks:sortedUnique(rollback.requiredChecks,'$.rollback.requiredChecks',id),preservePreviousRelease:true},observability:{fields:sortedUnique(observability.fields,'$.observability.fields',id),redactions:sortedUnique(observability.redactions,'$.observability.redactions',id)}});
}
