export class ReleaseIntegrationError extends Error {
  constructor(code, path, message = code) {
    super(String(message).slice(0, 320));
    this.name = 'ReleaseIntegrationError';
    this.code = code;
    this.path = path;
  }
}
const fail = (code, path, message) => { throw new ReleaseIntegrationError(code, path, message); };
const CONTROL = /[\u0000-\u001f\u007f]/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^(?:v[1-9][0-9]*|0\.[0-9]+\.[0-9]+)$/;
const IDENTIFIER = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const ALLOWED_RECOMMENDATIONS = new Set(['ACCEPT', 'ACCEPT_WITH_REPAIR']);

export const COMPONENT_MANIFEST_SCHEMA = 'audit-release-component-manifest-v1';
export const PUBLIC_INTERFACE_LOCK_SCHEMA = 'audit-public-interface-lock-v1';
export const SHARED_FILE_UNION_SCHEMA = 'audit-shared-file-union-v1';
export const INTAKE_PLAN_SCHEMA = 'audit-release-intake-plan-v1';
export const RELEASE_MANIFEST_SCHEMA = 'audit-release-integration-manifest-v1';
export const SAFE_CAPABILITIES = Object.freeze({
  executionEnabled: false,
  executorState: 'unavailable',
  networkEnabled: false,
  signingEnabled: false,
  transactionEnabled: false,
  deploymentEnabled: false
});
export const ROUND4_MASTER_ISSUE = 119;
export const ROUND4_INTAKE_SLOTS = deepFreeze([
  { workerId: 'worker-0', issueNumber: 120, branch: 'audit-round4/review-integration-spine-v1', role: 'review-phase1-6-spine', activationIssues: [114] },
  { workerId: 'worker-1', issueNumber: 121, branch: 'audit-round4/review-phase78-api-compat-v1', role: 'review-phase78-api-compat', activationIssues: [112, 113] },
  { workerId: 'worker-2', issueNumber: 122, branch: 'audit-round4/full-platform-integration-v1', role: 'assemble-full-platform', activationIssues: [112, 113, 114, 115, 116, 120, 121] },
  { workerId: 'worker-3', issueNumber: 123, branch: 'audit-round4/review-api-auth-security-v1', role: 'security-review-stage-b', activationIssues: [113, 115, 122] },
  { workerId: 'worker-4', issueNumber: 124, branch: 'audit-round4/review-web-direct-e2e-v1', role: 'ui-direct-review-stage-b', activationIssues: [112, 113, 115, 116, 122] }
]);

function inspect(value, path) {
  let prototype; let keys; let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    descriptors = new Map(Object.entries(Object.getOwnPropertyDescriptors(value)));
  } catch { fail('hostile_reflection', path); }
  return { prototype, keys, descriptors };
}
function childPath(path, key) {
  return typeof key === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(key) ? `${path}.${key}` : `${path}.[field]`;
}
function canonical(value, path = '$', seen = new WeakSet(), depth = 0) {
  if (depth > 32) fail('graph_too_deep', path);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > 2_000_000 || CONTROL.test(value)) fail('invalid_string', path);
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
  let result;
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail('invalid_array', path);
    const length = descriptors.get('length')?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 100_000) fail('invalid_array', path);
    result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors.get(String(index));
      if (!descriptor) fail('sparse_array', `${path}[${index}]`);
      if (!Object.hasOwn(descriptor, 'value')) fail('accessor_field', `${path}[${index}]`);
      result[index] = canonical(descriptor.value, `${path}[${index}]`, seen, depth + 1);
    }
    for (const key of keys) if (key !== 'length' && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) fail('array_property', path);
  } else {
    if (prototype !== Object.prototype && prototype !== null) fail('invalid_object', path);
    result = {};
    for (const key of keys.map(String).sort()) {
      const descriptor = descriptors.get(key);
      const nextPath = childPath(path, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('accessor_field', nextPath);
      Object.defineProperty(result, key, { value: canonical(descriptor.value, nextPath, seen, depth + 1), enumerable: true, writable: true, configurable: true });
    }
  }
  seen.delete(value);
  return result;
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function frozen(value) { return deepFreeze(canonical(value)); }
function exact(value, expected, path = '$') {
  const safe = canonical(value, path);
  if (safe === null || typeof safe !== 'object' || Array.isArray(safe)) fail('invalid_object', path);
  const actual = Object.keys(safe).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    const extra = actual.find((key) => !wanted.includes(key));
    const missing = wanted.find((key) => !actual.includes(key));
    fail(extra ? 'unknown_field' : 'missing_field', childPath(path, extra ?? missing));
  }
  return safe;
}
function text(value, path, max = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || CONTROL.test(value)) fail('invalid_string', path);
  return value;
}
function identifier(value, path) {
  const checked = text(value, path, 96);
  if (!IDENTIFIER.test(checked) || checked.includes('..') || checked === 'latest') fail('invalid_identifier', path);
  return checked;
}
function pathValue(value, path) {
  const checked = text(value, path, 512).replaceAll('\\', '/');
  if (checked.startsWith('/') || checked.includes('//') || checked.split('/').includes('..') || !/^[A-Za-z0-9_.@+\/-]+$/.test(checked)) fail('unsafe_path', path);
  return checked;
}
function sha40(value, path) { if (typeof value !== 'string' || !SHA40.test(value)) fail('invalid_sha', path); return value; }
function sha256(value, path) { if (typeof value !== 'string' || !SHA256.test(value)) fail('invalid_digest', path); return value; }
function version(value, path) { const checked = text(value, path, 80); if (!VERSION.test(checked)) fail('invalid_version', path); return checked; }
function array(value, path, max = 10_000) { const safe = canonical(value, path); if (!Array.isArray(safe) || safe.length > max) fail('invalid_array', path); return safe; }
function sortedUnique(value, path, max, validator) {
  const result = array(value, path, max).map((entry, index) => validator(entry, `${path}[${index}]`)).sort();
  if (new Set(result).size !== result.length) fail('duplicate_value', path);
  return result;
}
function canonicalJson(value) { return JSON.stringify(canonical(value)); }

const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
function sha256Hex(value) {
  const input = new TextEncoder().encode(value); const length=input.length; const padded=((length+72)>>6)<<6; const bytes=new Uint8Array(padded); bytes.set(input); bytes[length]=0x80; const bits=length*8; const view=new DataView(bytes.buffer); view.setUint32(padded-8,Math.floor(bits/0x100000000),false); view.setUint32(padded-4,bits>>>0,false);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19; const w=new Uint32Array(64);
  for(let offset=0;offset<padded;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4,false);for(let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;for(let i=0;i<64;i++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^((~e)&g),t1=(h+s1+ch+K[i]+w[i])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;}
  return [h0,h1,h2,h3,h4,h5,h6,h7].map((item)=>item.toString(16).padStart(8,'0')).join('');
}
function digestOf(value) { return sha256Hex(canonicalJson(value)); }
function validateCapabilities(value, path) {
  const safe = exact(value, Object.keys(SAFE_CAPABILITIES), path);
  for (const [key, expected] of Object.entries(SAFE_CAPABILITIES)) if (safe[key] !== expected) fail('capability_broadening', `${path}.${key}`);
  return frozen(safe);
}

export function createPublicInterfaceLock(input) {
  const safe = exact(input, ['componentId','schemaVersion','entrypoints','exports','storagePrefixes','lifecycleOutcomes','capabilities']);
  return frozen({
    lockSchemaVersion: PUBLIC_INTERFACE_LOCK_SCHEMA,
    componentId: identifier(safe.componentId, '$.componentId'),
    schemaVersion: version(safe.schemaVersion, '$.schemaVersion'),
    entrypoints: sortedUnique(safe.entrypoints, '$.entrypoints', 128, pathValue),
    exports: sortedUnique(safe.exports, '$.exports', 512, identifier),
    storagePrefixes: sortedUnique(safe.storagePrefixes, '$.storagePrefixes', 128, pathValue),
    lifecycleOutcomes: sortedUnique(safe.lifecycleOutcomes, '$.lifecycleOutcomes', 128, identifier),
    capabilities: validateCapabilities(safe.capabilities, '$.capabilities')
  });
}
export function validatePublicInterfaceLock(value) {
  const safe = exact(value, ['lockSchemaVersion','componentId','schemaVersion','entrypoints','exports','storagePrefixes','lifecycleOutcomes','capabilities']);
  if (safe.lockSchemaVersion !== PUBLIC_INTERFACE_LOCK_SCHEMA) fail('invalid_schema_version', '$.lockSchemaVersion');
  return createPublicInterfaceLock(safe);
}
export function assertPublicInterfaceCompatibility(expected, actual) {
  const left = validatePublicInterfaceLock(expected); const right = validatePublicInterfaceLock(actual);
  for (const key of ['componentId','schemaVersion','entrypoints','exports','storagePrefixes','lifecycleOutcomes','capabilities']) if (canonicalJson(left[key]) !== canonicalJson(right[key])) fail('public_interface_drift', `$.${key}`);
  return frozen({ compatible: true, componentId: left.componentId });
}
export function composeReleaseCapabilities(locks) {
  const checked = array(locks, '$.locks', 128).map(validatePublicInterfaceLock);
  return frozen({ ...SAFE_CAPABILITIES, components: checked.map((item)=>item.componentId).sort() });
}

function overlap(left, right) { return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`) || left.startsWith(`${right}[`) || right.startsWith(`${left}[`); }
export function validateSharedFileUnion(input) {
  const safe = exact(input, ['schemaVersion','path','baseBlobSha','inputs','outputBlobSha','strategy']);
  if (safe.schemaVersion !== SHARED_FILE_UNION_SCHEMA) fail('invalid_schema_version', '$.schemaVersion');
  if (safe.strategy !== 'field-owned-v1') fail('invalid_union_strategy', '$.strategy');
  const inputs = array(safe.inputs, '$.inputs', 32).map((entry,index)=>{
    const item=exact(entry,['componentId','blobSha','fields'],`$.inputs[${index}]`);
    return { componentId:identifier(item.componentId,`$.inputs[${index}].componentId`), blobSha:sha40(item.blobSha,`$.inputs[${index}].blobSha`), fields:sortedUnique(item.fields,`$.inputs[${index}].fields`,256,(value,path)=>text(value,path,240)) };
  }).sort((a,b)=>a.componentId.localeCompare(b.componentId));
  if (inputs.length < 2 || new Set(inputs.map((item)=>item.componentId)).size !== inputs.length) fail('invalid_union_inputs', '$.inputs');
  const owned=[];
  for(const item of inputs) for(const field of item.fields){const conflict=owned.find((entry)=>overlap(entry.field,field));if(conflict)fail('union_field_overlap','$.inputs',`${conflict.componentId} and ${item.componentId} overlap`);owned.push({componentId:item.componentId,field});}
  return frozen({ schemaVersion:SHARED_FILE_UNION_SCHEMA, path:pathValue(safe.path,'$.path'), baseBlobSha:sha40(safe.baseBlobSha,'$.baseBlobSha'), inputs, outputBlobSha:sha40(safe.outputBlobSha,'$.outputBlobSha'), strategy:safe.strategy });
}

function validateBlob(entry, path) {
  const safe=exact(entry,['path','sourceBlobSha','destinationBlobSha'],path);
  return {path:pathValue(safe.path,`${path}.path`),sourceBlobSha:sha40(safe.sourceBlobSha,`${path}.sourceBlobSha`),destinationBlobSha:sha40(safe.destinationBlobSha,`${path}.destinationBlobSha`)};
}
export function createComponentManifest(input) {
  const safe=exact(input,['componentId','issueNumber','branch','finalSha','status','recommendation','reportUrl','ownedPaths','blobs','publicInterface','adaptation']);
  if(safe.status!=='completed')fail('candidate_incomplete','$.status');
  if(!ALLOWED_RECOMMENDATIONS.has(safe.recommendation))fail('candidate_rejected','$.recommendation');
  if(!Number.isSafeInteger(safe.issueNumber)||safe.issueNumber<1)fail('invalid_issue','$.issueNumber');
  const adaptation=exact(safe.adaptation,['kind','repairId'],'$.adaptation');
  if(!['exact','repaired'].includes(adaptation.kind))fail('invalid_adaptation','$.adaptation.kind');
  if(adaptation.kind==='exact'&&adaptation.repairId!==null)fail('invalid_adaptation','$.adaptation.repairId');
  if(adaptation.kind==='repaired')identifier(adaptation.repairId,'$.adaptation.repairId');
  const blobs=array(safe.blobs,'$.blobs',10000).map(validateBlob).sort((a,b)=>a.path.localeCompare(b.path));
  if(new Set(blobs.map((item)=>item.path)).size!==blobs.length)fail('duplicate_path','$.blobs');
  if(adaptation.kind==='exact')for(const blob of blobs)if(blob.sourceBlobSha!==blob.destinationBlobSha)fail('blob_mismatch','$.blobs');
  const body={schemaVersion:COMPONENT_MANIFEST_SCHEMA,componentId:identifier(safe.componentId,'$.componentId'),issueNumber:safe.issueNumber,branch:pathValue(safe.branch,'$.branch'),finalSha:sha40(safe.finalSha,'$.finalSha'),status:safe.status,recommendation:safe.recommendation,reportUrl:text(safe.reportUrl,'$.reportUrl',1024),ownedPaths:sortedUnique(safe.ownedPaths,'$.ownedPaths',10000,pathValue),blobs,publicInterface:validatePublicInterfaceLock(safe.publicInterface),adaptation:frozen(adaptation)};
  for(const blob of blobs)if(!body.ownedPaths.includes(blob.path))fail('unowned_blob','$.blobs');
  return frozen({...body,manifestDigest:digestOf(body)});
}
export function validateComponentManifest(value) {
  const safe=exact(value,['schemaVersion','componentId','issueNumber','branch','finalSha','status','recommendation','reportUrl','ownedPaths','blobs','publicInterface','adaptation','manifestDigest']);
  if(safe.schemaVersion!==COMPONENT_MANIFEST_SCHEMA)fail('invalid_schema_version','$.schemaVersion');
  const rebuilt=createComponentManifest(safe);
  if(safe.manifestDigest!==rebuilt.manifestDigest)fail('digest_mismatch','$.manifestDigest');
  return rebuilt;
}

export function createReleaseIntakePlan(input) {
  const safe=exact(input,['baseSha','candidates','protectedPaths','sharedUnions']);
  const protectedPaths=sortedUnique(safe.protectedPaths,'$.protectedPaths',10000,pathValue);
  const candidates=array(safe.candidates,'$.candidates',128).map(validateComponentManifest).sort((a,b)=>a.componentId.localeCompare(b.componentId));
  if(new Set(candidates.map((item)=>item.componentId)).size!==candidates.length)fail('duplicate_component','$.candidates');
  const ownership=[];
  for(const candidate of candidates)for(const ownedPath of candidate.ownedPaths){if(protectedPaths.includes(ownedPath))fail('protected_path','$.candidates');const conflict=ownership.find((item)=>item.path===ownedPath||item.path.startsWith(`${ownedPath}/`)||ownedPath.startsWith(`${item.path}/`));if(conflict)fail('path_overlap','$.candidates');ownership.push({componentId:candidate.componentId,path:ownedPath});}
  const sharedUnions=array(safe.sharedUnions,'$.sharedUnions',128).map(validateSharedFileUnion).sort((a,b)=>a.path.localeCompare(b.path));
  return frozen({schemaVersion:INTAKE_PLAN_SCHEMA,baseSha:sha40(safe.baseSha,'$.baseSha'),candidates,protectedPaths,sharedUnions,capabilities:composeReleaseCapabilities(candidates.map((item)=>item.publicInterface))});
}

function validateProtectedBlob(entry,path){const safe=exact(entry,['path','blobSha'],path);return{path:pathValue(safe.path,`${path}.path`),blobSha:sha40(safe.blobSha,`${path}.blobSha`)}}
export function createReleaseIntegrationManifest(input){
  const safe=exact(input,['baseSha','components','protectedBlobs','staleInputs','round4Slots']);
  const components=array(safe.components,'$.components',128).map(validateComponentManifest).sort((a,b)=>a.componentId.localeCompare(b.componentId));
  const protectedBlobs=array(safe.protectedBlobs,'$.protectedBlobs',10000).map(validateProtectedBlob).sort((a,b)=>a.path.localeCompare(b.path));
  const staleInputs=sortedUnique(safe.staleInputs,'$.staleInputs',128,identifier);
  const round4Slots=array(safe.round4Slots,'$.round4Slots',16);
  if(canonicalJson(round4Slots)!==canonicalJson(ROUND4_INTAKE_SLOTS))fail('round4_slot_mismatch','$.round4Slots');
  const body={schemaVersion:RELEASE_MANIFEST_SCHEMA,baseSha:sha40(safe.baseSha,'$.baseSha'),components,protectedBlobs,staleInputs,round4Slots:ROUND4_INTAKE_SLOTS,capabilities:composeReleaseCapabilities(components.map((item)=>item.publicInterface))};
  return frozen({...body,releaseDigest:digestOf(body)});
}
export function validateReleaseIntegrationManifest(value){const safe=exact(value,['schemaVersion','baseSha','components','protectedBlobs','staleInputs','round4Slots','capabilities','releaseDigest']);if(safe.schemaVersion!==RELEASE_MANIFEST_SCHEMA)fail('invalid_schema_version','$.schemaVersion');const rebuilt=createReleaseIntegrationManifest(safe);if(canonicalJson(safe.capabilities)!==canonicalJson(rebuilt.capabilities))fail('capability_drift','$.capabilities');if(safe.releaseDigest!==rebuilt.releaseDigest)fail('digest_mismatch','$.releaseDigest');return rebuilt;}
