import { PHASE5_PROFILE_IDS, getPhase5ProfileTemplate } from '../../audit-phase5-profile-contracts/src/index.mjs';
import { PHASE5_PARSER_VERSIONS } from '../../audit-phase5-parsers/src/index.mjs';

const TOP_KEYS = Object.freeze([
  'schemaVersion','profileId','parserVersion','classification','durationMs','exitCode',
  'hardhatTests','echidnaProperties','mutationResults','dependencyFindings',
  'evidence','artifacts','parserErrors','summary'
]);
const CLASSIFICATIONS = new Set(['success','findings','timeout','cancelled','resource_exhaustion','malformed_output','parser_error']);
const TERMINAL_EMPTY = new Set(['timeout','cancelled','resource_exhaustion']);
const PROFILE_SET = new Set([...PHASE5_PROFILE_IDS, 'invalid-profile-v1']);
const MAX_RECORDS = 10_000;
const MAX_STRING = 2_000;

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function plain(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('invalid_object', `${path} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('invalid_object', `${path} must be a plain object`);
  return value;
}
function exact(value, keys, path) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail('invalid_keys', `${path} has invalid keys`);
}
function string(value, path, maximum = MAX_STRING, empty = true) {
  if (typeof value !== 'string' || value.length > maximum || (!empty && value.length === 0) || /\u0000/.test(value)) fail('invalid_string', `${path} is invalid`);
  return value;
}
function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail('invalid_integer', `${path} is invalid`);
  return value;
}
function list(value, path, maximum = MAX_RECORDS) {
  if (!Array.isArray(value) || value.length > maximum) fail('invalid_array', `${path} is invalid`);
  return value;
}
function path(value, at) {
  const result = string(value, at, 512, false);
  if (result.startsWith('/') || /^[A-Za-z]:[\\/]/.test(result) || result.split(/[\\/]/).includes('..')) fail('unsafe_path', `${at} is unsafe`);
  return result;
}
function nullableString(value, at, maximum = MAX_STRING) { if (value !== null) string(value, at, maximum); }
function recursivelyPlain(value, at = '$') {
  if (Array.isArray(value)) { if (value.length > MAX_RECORDS) fail('invalid_array', `${at} is invalid`); value.forEach((item, i) => recursivelyPlain(item, `${at}[${i}]`)); return; }
  if (value && typeof value === 'object') { plain(value, at); for (const [key, child] of Object.entries(value)) recursivelyPlain(child, `${at}.${key}`); }
}
function freezeClone(value) {
  const clone = Array.isArray(value) ? value.map(freezeClone) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeClone(child)])) : value;
  return clone && typeof clone === 'object' ? Object.freeze(clone) : clone;
}
function ensureUnique(items, identity, pathName) {
  const seen = new Map();
  for (const item of items) {
    const key = identity(item); const encoded = JSON.stringify(item);
    if (seen.has(key) && seen.get(key) !== encoded) fail('conflicting_duplicate', `${pathName} contains a conflicting duplicate`);
    if (seen.has(key)) fail('duplicate_result', `${pathName} contains a duplicate`);
    seen.set(key, encoded);
  }
}
function validateEvidence(items) {
  list(items, '$.evidence').forEach((item, i) => { plain(item, `$.evidence[${i}]`); exact(item, ['schemaVersion','type','recordCount'], `$.evidence[${i}]`); string(item.schemaVersion, `$.evidence[${i}].schemaVersion`, 80, false); string(item.type, `$.evidence[${i}].type`, 80, false); integer(item.recordCount, `$.evidence[${i}].recordCount`, 0, MAX_RECORDS); });
}
function validateErrors(items) {
  list(items, '$.parserErrors').forEach((item, i) => { plain(item, `$.parserErrors[${i}]`); exact(item, ['code','message'], `$.parserErrors[${i}]`); string(item.code, `$.parserErrors[${i}].code`, 80, false); string(item.message, `$.parserErrors[${i}].message`); });
}
function validateHardhat(result) {
  result.hardhatTests.forEach((item, i) => { plain(item, `$.hardhatTests[${i}]`); exact(item, ['file','suite','name','status','durationMs','errorMessage'], `$.hardhatTests[${i}]`); path(item.file, `$.hardhatTests[${i}].file`); string(item.suite, `$.hardhatTests[${i}].suite`, 512); string(item.name, `$.hardhatTests[${i}].name`, 512, false); if (!['passed','failed','skipped'].includes(item.status)) fail('invalid_status','invalid Hardhat status'); integer(item.durationMs, `$.hardhatTests[${i}].durationMs`, 0, 86_400_000); nullableString(item.errorMessage, `$.hardhatTests[${i}].errorMessage`); });
  exact(result.summary, ['passed','failed','skipped','total'], '$.summary');
}
function validateEchidna(result) {
  result.echidnaProperties.forEach((item, i) => { plain(item, `$.echidnaProperties[${i}]`); exact(item, ['contract','name','status','testType','error','counterexample'], `$.echidnaProperties[${i}]`); string(item.contract,'$.contract',512,false); string(item.name,'$.name',512,false); if (!['passed','failed'].includes(item.status)) fail('invalid_status','invalid Echidna status'); string(item.testType,'$.testType',32,false); nullableString(item.error,'$.error'); list(item.counterexample,'$.counterexample',1000).forEach((tx,j)=>{ plain(tx,`$.counterexample[${j}]`); exact(tx,['contract','function','arguments','gas','gasprice'],`$.counterexample[${j}]`); string(tx.contract,'$.contract',512,false); string(tx.function,'$.function',512,false); list(tx.arguments,'$.arguments',64).forEach((arg)=>string(arg,'$.argument',512)); integer(tx.gas,'$.gas'); integer(tx.gasprice,'$.gasprice'); }); });
  exact(result.summary, ['passed','failed','total','seed'], '$.summary'); integer(result.summary.seed,'$.summary.seed',0,4_294_967_295);
}
function validateMutation(result) {
  result.mutationResults.forEach((item,i)=>{ plain(item,`$.mutationResults[${i}]`); exact(item,['id','status','operator','file','line','column','killedBy'],`$.mutationResults[${i}]`); string(item.id,'$.id',160,false); if(!['killed','survived','timeout','invalid'].includes(item.status)) fail('invalid_status','invalid mutation status'); string(item.operator,'$.operator',80,false); path(item.file,'$.file'); integer(item.line,'$.line',1,10_000_000); integer(item.column,'$.column',1,1_000_000); nullableString(item.killedBy,'$.killedBy',512); });
  ensureUnique(result.mutationResults,(item)=>item.id,'$.mutationResults'); exact(result.summary,['killed','survived','timedOut','invalid','total','mutationScore'],'$.summary');
}
function validateDependency(result) {
  result.dependencyFindings.forEach((item,i)=>{ plain(item,`$.dependencyFindings[${i}]`); exact(item,['sourcePath','sourceType','package','id','aliases','summary','severity','fixedVersion'],`$.dependencyFindings[${i}]`); path(item.sourcePath,'$.sourcePath'); string(item.sourceType,'$.sourceType',80,false); plain(item.package,'$.package'); exact(item.package,['name','version','ecosystem'],'$.package'); string(item.package.name,'$.package.name',512,false); string(item.package.version,'$.package.version',160,false); string(item.package.ecosystem,'$.package.ecosystem',80,false); string(item.id,'$.id',160,false); list(item.aliases,'$.aliases',64).forEach((alias)=>string(alias,'$.alias',512)); string(item.summary,'$.summary'); if(!['critical','high','moderate','low','unknown'].includes(item.severity)) fail('invalid_severity','invalid dependency severity'); nullableString(item.fixedVersion,'$.fixedVersion',160); });
  ensureUnique(result.dependencyFindings,(item)=>JSON.stringify([item.sourcePath,item.sourceType,item.package.ecosystem,item.package.name,item.package.version,item.id]),'$.dependencyFindings'); exact(result.summary,['critical','high','moderate','low','unknown','total'],'$.summary');
}
function validateCounts(summary) { for (const [key,value] of Object.entries(summary)) { if (key === 'mutationScore') { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) fail('invalid_number','invalid mutation score'); } else integer(value, `$.summary.${key}`, 0, MAX_RECORDS); } }

export function validatePhase5ToolResult(value) {
  recursivelyPlain(value);
  const result = plain(value, '$'); exact(result, TOP_KEYS, '$');
  if (result.schemaVersion !== 'phase5-tool-result-v1') fail('invalid_schema_version','invalid result schema');
  string(result.profileId,'$.profileId',80,false); if (!PROFILE_SET.has(result.profileId)) fail('invalid_profile_id','invalid result profile');
  string(result.parserVersion,'$.parserVersion',80,false); if (!CLASSIFICATIONS.has(result.classification)) fail('invalid_classification','invalid result classification');
  integer(result.durationMs,'$.durationMs',0,86_400_000); if (result.exitCode !== null) integer(result.exitCode,'$.exitCode',0,255);
  for (const key of ['hardhatTests','echidnaProperties','mutationResults','dependencyFindings','artifacts']) list(result[key], `$.${key}`);
  validateEvidence(result.evidence); validateErrors(result.parserErrors); plain(result.summary,'$.summary');
  if (result.profileId !== 'invalid-profile-v1' && result.parserVersion !== PHASE5_PARSER_VERSIONS[result.profileId]) fail('parser_profile_mismatch','parser/profile mismatch');
  if (result.profileId === 'invalid-profile-v1' && result.parserVersion !== 'unknown-parser-v1') fail('parser_profile_mismatch','invalid-profile sentinel mismatch');
  const populated = { 'hardhat-test-v1':'hardhatTests','echidna-v1':'echidnaProperties','mutation-v1':'mutationResults','dependency-scan-v1':'dependencyFindings' }[result.profileId];
  for (const key of ['hardhatTests','echidnaProperties','mutationResults','dependencyFindings']) if (key !== populated && result[key].length !== 0) fail('profile_substitution',`${key} is not valid for profile`);
  if (result.classification === 'success' || result.classification === 'findings') { if (result.exitCode === null) fail('lifecycle_mismatch','completed result requires exitCode'); if (result.parserErrors.length) fail('classification_mismatch','completed result cannot contain parser errors'); }
  if (TERMINAL_EMPTY.has(result.classification)) { if (result.exitCode !== null || result.parserErrors.length || result.evidence.length || Object.keys(result.summary).length) fail('lifecycle_mismatch','terminal result envelope is inconsistent'); }
  if (['malformed_output','parser_error'].includes(result.classification) && result.parserErrors.length !== 1) fail('classification_mismatch','parser failure requires one parser error');
  if (populated === 'hardhatTests') validateHardhat(result); else if (populated === 'echidnaProperties') validateEchidna(result); else if (populated === 'mutationResults') validateMutation(result); else if (populated === 'dependencyFindings') validateDependency(result); else exact(result.summary, [], '$.summary');
  validateCounts(result.summary);
  return freezeClone(result);
}

export function validatePhase5ResultForProfile(profileContract, result) {
  plain(profileContract, '$.profileContract');
  const normalized = validatePhase5ToolResult(result);
  if (profileContract.profileId !== normalized.profileId) fail('profile_substitution','result does not match profile contract');
  if (profileContract.parserVersion !== normalized.parserVersion) fail('parser_substitution','result does not match profile parser');
  const template = getPhase5ProfileTemplate(profileContract.profileId);
  if (template.parserVersion !== normalized.parserVersion) fail('parser_substitution','template parser mismatch');
  return normalized;
}
