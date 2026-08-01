import { assertProfileId } from '../../audit-protocol/src/index.mjs';

export const MAX_PHASE5_INPUT_BYTES = 2_000_000;
export const MAX_PHASE5_RECORDS = 10_000;
export const MAX_PHASE5_STRING_LENGTH = 2_000;
const MAX_DURATION_MS = 86_400_000;
const MAX_COUNTEREXAMPLE_STEPS = 1_000;
const MAX_ARGUMENTS = 64;
const MAX_ALIASES = 64;
const TERMINATIONS = new Set(['completed', 'timeout', 'cancelled', 'resource_exhausted']);
const PROFILE_IDS = new Set(['hardhat-test-v1', 'echidna-v1', 'mutation-v1', 'dependency-scan-v1']);
const MUTATION_OPERATORS = new Set([
  'binary-op-mutation', 'unary-operator-mutation', 'require-mutation', 'assignment-mutation',
  'delete-expression-mutation', 'if-cond-mutation', 'swap-arguments-operator-mutation', 'elim-delegate-mutation'
]);
const SEVERITIES = new Set(['critical', 'high', 'moderate', 'low', 'unknown']);

export const PHASE5_PARSER_VERSIONS = Object.freeze({
  'hardhat-test-v1': 'hardhat-test-parser-v1',
  'echidna-v1': 'echidna-parser-v1',
  'mutation-v1': 'mutation-parser-v1',
  'dependency-scan-v1': 'dependency-scan-parser-v1'
});

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function fault(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function plainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw fault('invalid_object', `${path} must be an object`);
  }
  return value;
}

function exactKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw fault('unknown_field', `${path} contains an unknown field`);
  }
}

function array(value, path, maximum = MAX_PHASE5_RECORDS) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw fault('invalid_array', `${path} must contain at most ${maximum} entries`);
  }
  return value;
}

function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw fault('invalid_integer', `${path} contains an invalid integer`);
  }
  return value;
}

function cleanString(value, path, maximum = MAX_PHASE5_STRING_LENGTH, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0)) {
    throw fault('invalid_string', `${path} contains an invalid string`);
  }
  if (/\u0000/.test(value)) throw fault('invalid_string', `${path} contains an invalid string`);
  return value;
}

function cleanMessage(value, path) {
  const text = cleanString(value, path);
  return text
    .replace(/[A-Za-z]:\\[^\s]+/g, '[path]')
    .replace(/\/(?:[^\s/]+\/){2,}[^\s]+/g, '[path]');
}

function safePath(value, path) {
  const result = cleanString(value, path, 512, false).replaceAll('\\', '/');
  if (
    result.startsWith('/') || /^[A-Za-z]:\//.test(result) || result.split('/').includes('..') ||
    result.includes('//') || !/^[A-Za-z0-9_.@+\/-]+$/.test(result)
  ) {
    throw fault('unsafe_path', 'Tool result contains an unsafe relative path');
  }
  return result;
}

function stringArray(value, path, maximum = MAX_ARGUMENTS) {
  return array(value, path, maximum).map((item, index) => cleanString(item, `${path}[${index}]`, 512));
}

function baseResult(profileId, parserVersion, input, classification = 'success') {
  return {
    schemaVersion: 'phase5-tool-result-v1',
    profileId,
    parserVersion,
    classification,
    durationMs: input.durationMs,
    exitCode: input.exitCode,
    hardhatTests: [],
    echidnaProperties: [],
    mutationResults: [],
    dependencyFindings: [],
    evidence: [],
    artifacts: [],
    parserErrors: [],
    summary: {}
  };
}

function parserFailure(profileId, parserVersion, input, classification, error) {
  const safeDuration = Number.isSafeInteger(input?.durationMs) && input.durationMs >= 0 && input.durationMs <= MAX_DURATION_MS ? input.durationMs : 0;
  const safeExit = input?.exitCode === null || (Number.isSafeInteger(input?.exitCode) && input.exitCode >= 0 && input.exitCode <= 255) ? input.exitCode : null;
  return deepFreeze({
    ...baseResult(profileId, parserVersion, { durationMs: safeDuration, exitCode: safeExit }, classification),
    parserErrors: [{
      code: typeof error?.code === 'string' ? error.code : 'parser_error',
      message: typeof error?.message === 'string' ? error.message.slice(0, MAX_PHASE5_STRING_LENGTH) : 'Tool output could not be parsed'
    }]
  });
}

function terminationResult(profileId, parserVersion, prepared) {
  const mapping = {
    timeout: 'timeout',
    cancelled: 'cancelled',
    resource_exhausted: 'resource_exhaustion'
  };
  return deepFreeze(baseResult(profileId, parserVersion, prepared, mapping[prepared.termination]));
}

function decodeBytes(value) {
  if (typeof value === 'string') {
    const bytes = encoder.encode(value);
    if (bytes.byteLength > MAX_PHASE5_INPUT_BYTES) throw fault('input_too_large', `Tool result exceeds ${MAX_PHASE5_INPUT_BYTES} bytes`);
    return value;
  }
  if (value instanceof Uint8Array) {
    if (value.byteLength > MAX_PHASE5_INPUT_BYTES) throw fault('input_too_large', `Tool result exceeds ${MAX_PHASE5_INPUT_BYTES} bytes`);
    try { return decoder.decode(value); }
    catch { throw fault('invalid_utf8', 'Tool result is not valid UTF-8'); }
  }
  throw fault('invalid_input_bytes', 'Tool result must be supplied as inert UTF-8 bytes or text');
}

function prepare(profileId, input) {
  assertProfileId(profileId);
  if (!PROFILE_IDS.has(profileId)) throw fault('unknown_profile_id', `Unsupported Phase 5 profileId: ${profileId}`);
  plainObject(input, '$');
  exactKeys(input, new Set(['resultBytes', 'exitCode', 'durationMs', 'termination']), '$');
  const termination = cleanString(input.termination, '$.termination', 32, false);
  if (!TERMINATIONS.has(termination)) throw fault('invalid_termination', '$.termination is not supported');
  const durationMs = integer(input.durationMs, '$.durationMs', 0, MAX_DURATION_MS);
  let exitCode;
  if (input.exitCode === null) exitCode = null;
  else exitCode = integer(input.exitCode, '$.exitCode', 0, 255);
  if (termination === 'completed' && exitCode === null) throw fault('invalid_exit_code', '$.exitCode is required for completed results');
  return { resultText: decodeBytes(input.resultBytes), exitCode, durationMs, termination };
}

function parseJson(text) {
  try { return JSON.parse(text); }
  catch { throw fault('invalid_json', 'Tool result JSON is malformed'); }
}

function dedupeAndSort(items, keyOf, compare) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  result.sort(compare);
  return result;
}

function evidenceFor(type, count) {
  return [{ schemaVersion: 'phase5-parser-evidence-v1', type, recordCount: count }];
}

function parseHardhat(profileId, parserVersion, prepared, root) {
  plainObject(root, '$.result');
  exactKeys(root, new Set(['tests']), '$.result');
  const records = array(root.tests, '$.result.tests').map((item, index) => {
    plainObject(item, `$.result.tests[${index}]`);
    exactKeys(item, new Set(['file', 'suite', 'name', 'status', 'durationMs', 'errorMessage']), `$.result.tests[${index}]`);
    const status = cleanString(item.status, `$.result.tests[${index}].status`, 16, false);
    if (!['passed', 'failed', 'skipped'].includes(status)) throw fault('invalid_status', '$.result.tests contains an invalid status');
    return {
      file: safePath(item.file, `$.result.tests[${index}].file`),
      suite: cleanString(item.suite, `$.result.tests[${index}].suite`, 512),
      name: cleanString(item.name, `$.result.tests[${index}].name`, 512, false),
      status,
      durationMs: integer(item.durationMs, `$.result.tests[${index}].durationMs`, 0, MAX_DURATION_MS),
      errorMessage: item.errorMessage === undefined ? null : cleanMessage(item.errorMessage, `$.result.tests[${index}].errorMessage`)
    };
  });
  const hardhatTests = dedupeAndSort(
    records,
    (item) => JSON.stringify(item),
    (a, b) => a.file.localeCompare(b.file) || a.suite.localeCompare(b.suite) || a.name.localeCompare(b.name)
  );
  const summary = {
    passed: hardhatTests.filter((item) => item.status === 'passed').length,
    failed: hardhatTests.filter((item) => item.status === 'failed').length,
    skipped: hardhatTests.filter((item) => item.status === 'skipped').length,
    total: hardhatTests.length
  };
  const classification = prepared.exitCode !== 0 || summary.failed > 0 ? 'findings' : 'success';
  return deepFreeze({
    ...baseResult(profileId, parserVersion, prepared, classification),
    hardhatTests,
    evidence: evidenceFor('hardhat-test-summary', hardhatTests.length),
    summary
  });
}

function transaction(item, path) {
  plainObject(item, path);
  exactKeys(item, new Set(['contract', 'function', 'arguments', 'gas', 'gasprice']), path);
  return {
    contract: cleanString(item.contract, `${path}.contract`, 512, false),
    function: cleanString(item.function, `${path}.function`, 512, false),
    arguments: item.arguments === undefined ? [] : stringArray(item.arguments, `${path}.arguments`),
    gas: integer(item.gas, `${path}.gas`, 0, Number.MAX_SAFE_INTEGER),
    gasprice: integer(item.gasprice, `${path}.gasprice`, 0, Number.MAX_SAFE_INTEGER)
  };
}

function parseEchidna(profileId, parserVersion, prepared, root) {
  plainObject(root, '$.result');
  exactKeys(root, new Set(['success', 'error', 'tests', 'seed', 'coverage']), '$.result');
  if (typeof root.success !== 'boolean') throw fault('invalid_boolean', '$.result.success must be a boolean');
  const seed = integer(root.seed, '$.result.seed', 0, 4_294_967_295);
  const records = array(root.tests, '$.result.tests').map((item, index) => {
    const path = `$.result.tests[${index}]`;
    plainObject(item, path);
    exactKeys(item, new Set(['contract', 'name', 'status', 'error', 'testType', 'transactions']), path);
    const rawStatus = cleanString(item.status, `${path}.status`, 32, false);
    if (!['passed', 'solved', 'error'].includes(rawStatus)) throw fault('invalid_status', '$.result.tests contains a non-terminal Echidna status');
    const testType = cleanString(item.testType, `${path}.testType`, 32, false);
    if (!['property', 'assertion', 'optimization', 'exploration', 'call', 'foundry', 'overflow'].includes(testType)) {
      throw fault('invalid_test_type', '$.result.tests contains an invalid test type');
    }
    const counterexample = item.transactions === undefined || item.transactions === null
      ? []
      : array(item.transactions, `${path}.transactions`, MAX_COUNTEREXAMPLE_STEPS).map((entry, txIndex) => transaction(entry, `${path}.transactions[${txIndex}]`));
    return {
      contract: cleanString(item.contract, `${path}.contract`, 512, false),
      name: cleanString(item.name, `${path}.name`, 512, false),
      status: rawStatus === 'passed' ? 'passed' : 'failed',
      testType,
      error: item.error === undefined || item.error === null ? null : cleanMessage(item.error, `${path}.error`),
      counterexample
    };
  });
  const echidnaProperties = dedupeAndSort(
    records,
    (item) => JSON.stringify(item),
    (a, b) => a.contract.localeCompare(b.contract) || a.name.localeCompare(b.name)
  );
  const summary = {
    passed: echidnaProperties.filter((item) => item.status === 'passed').length,
    failed: echidnaProperties.filter((item) => item.status === 'failed').length,
    total: echidnaProperties.length,
    seed
  };
  const classification = prepared.exitCode !== 0 || !root.success || summary.failed > 0 ? 'findings' : 'success';
  return deepFreeze({
    ...baseResult(profileId, parserVersion, prepared, classification),
    echidnaProperties,
    evidence: evidenceFor('echidna-campaign-summary', echidnaProperties.length),
    summary
  });
}

function parseMutation(profileId, parserVersion, prepared, root) {
  plainObject(root, '$.result');
  exactKeys(root, new Set(['mutants']), '$.result');
  const records = array(root.mutants, '$.result.mutants').map((item, index) => {
    const path = `$.result.mutants[${index}]`;
    plainObject(item, path);
    exactKeys(item, new Set(['id', 'status', 'operator', 'file', 'line', 'column', 'killedBy']), path);
    const status = cleanString(item.status, `${path}.status`, 32, false);
    if (!['killed', 'survived', 'timeout', 'invalid'].includes(status)) throw fault('invalid_status', '$.result.mutants contains an invalid status');
    const operator = cleanString(item.operator, `${path}.operator`, 80, false);
    if (!MUTATION_OPERATORS.has(operator)) throw fault('invalid_mutation_operator', '$.result.mutants contains an invalid mutation operator');
    return {
      id: cleanString(item.id, `${path}.id`, 160, false),
      status,
      operator,
      file: safePath(item.file, `${path}.file`),
      line: integer(item.line, `${path}.line`, 1, 10_000_000),
      column: integer(item.column, `${path}.column`, 1, 1_000_000),
      killedBy: item.killedBy === undefined ? null : cleanString(item.killedBy, `${path}.killedBy`, 512, false)
    };
  });
  const mutationResults = dedupeAndSort(records, (item) => item.id, (a, b) => a.id.localeCompare(b.id));
  const killed = mutationResults.filter((item) => item.status === 'killed').length;
  const survived = mutationResults.filter((item) => item.status === 'survived').length;
  const timedOut = mutationResults.filter((item) => item.status === 'timeout').length;
  const invalid = mutationResults.filter((item) => item.status === 'invalid').length;
  const denominator = killed + survived;
  const mutationScore = denominator === 0 ? 100 : Math.round((killed / denominator) * 10_000) / 100;
  const summary = { killed, survived, timedOut, invalid, total: mutationResults.length, mutationScore };
  const classification = prepared.exitCode !== 0 || survived > 0 || timedOut > 0 || invalid > 0 ? 'findings' : 'success';
  return deepFreeze({
    ...baseResult(profileId, parserVersion, prepared, classification),
    mutationResults,
    evidence: evidenceFor('mutation-summary', mutationResults.length),
    summary
  });
}

function parseDependency(profileId, parserVersion, prepared, root) {
  plainObject(root, '$.result');
  exactKeys(root, new Set(['results']), '$.result');
  const records = [];
  array(root.results, '$.result.results').forEach((result, resultIndex) => {
    const resultPath = `$.result.results[${resultIndex}]`;
    plainObject(result, resultPath);
    exactKeys(result, new Set(['source', 'packages']), resultPath);
    plainObject(result.source, `${resultPath}.source`);
    exactKeys(result.source, new Set(['path', 'type']), `${resultPath}.source`);
    const sourcePath = safePath(result.source.path, `${resultPath}.source.path`);
    const sourceType = cleanString(result.source.type, `${resultPath}.source.type`, 80, false);
    array(result.packages, `${resultPath}.packages`).forEach((packageResult, packageIndex) => {
      const packagePath = `${resultPath}.packages[${packageIndex}]`;
      plainObject(packageResult, packagePath);
      exactKeys(packageResult, new Set(['package', 'vulnerabilities']), packagePath);
      plainObject(packageResult.package, `${packagePath}.package`);
      exactKeys(packageResult.package, new Set(['name', 'version', 'ecosystem']), `${packagePath}.package`);
      const packageValue = {
        name: cleanString(packageResult.package.name, `${packagePath}.package.name`, 512, false),
        version: cleanString(packageResult.package.version, `${packagePath}.package.version`, 160, false),
        ecosystem: cleanString(packageResult.package.ecosystem, `${packagePath}.package.ecosystem`, 80, false)
      };
      array(packageResult.vulnerabilities, `${packagePath}.vulnerabilities`).forEach((vulnerability, vulnerabilityIndex) => {
        const path = `${packagePath}.vulnerabilities[${vulnerabilityIndex}]`;
        plainObject(vulnerability, path);
        exactKeys(vulnerability, new Set(['id', 'aliases', 'summary', 'severity', 'fixedVersion']), path);
        const severity = cleanString(vulnerability.severity, `${path}.severity`, 32, false);
        if (!SEVERITIES.has(severity)) throw fault('invalid_severity', '$.result contains an invalid severity');
        records.push({
          sourcePath,
          sourceType,
          package: packageValue,
          id: cleanString(vulnerability.id, `${path}.id`, 160, false),
          aliases: vulnerability.aliases === undefined ? [] : [...new Set(stringArray(vulnerability.aliases, `${path}.aliases`, MAX_ALIASES))].sort(),
          summary: cleanMessage(vulnerability.summary, `${path}.summary`),
          severity,
          fixedVersion: vulnerability.fixedVersion === null || vulnerability.fixedVersion === undefined
            ? null
            : cleanString(vulnerability.fixedVersion, `${path}.fixedVersion`, 160, false)
        });
      });
    });
  });
  const dependencyFindings = dedupeAndSort(
    records,
    (item) => `${item.package.ecosystem}\u0000${item.package.name}\u0000${item.package.version}\u0000${item.id}`,
    (a, b) => a.package.ecosystem.localeCompare(b.package.ecosystem) || a.package.name.localeCompare(b.package.name) || a.id.localeCompare(b.id)
  );
  const summary = { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0, total: dependencyFindings.length };
  for (const item of dependencyFindings) summary[item.severity] += 1;
  const classification = prepared.exitCode !== 0 || dependencyFindings.length > 0 ? 'findings' : 'success';
  return deepFreeze({
    ...baseResult(profileId, parserVersion, prepared, classification),
    dependencyFindings,
    evidence: evidenceFor('dependency-scan-summary', dependencyFindings.length),
    summary
  });
}

export function parsePhase5ToolResult(profileId, input) {
  let parserVersion = PHASE5_PARSER_VERSIONS[profileId] ?? 'unknown-parser-v1';
  let prepared;
  try {
    prepared = prepare(profileId, input);
    parserVersion = PHASE5_PARSER_VERSIONS[profileId];
    if (prepared.termination !== 'completed') return terminationResult(profileId, parserVersion, prepared);
    let root;
    try { root = parseJson(prepared.resultText); }
    catch (error) { return parserFailure(profileId, parserVersion, prepared, 'malformed_output', error); }
    switch (profileId) {
      case 'hardhat-test-v1': return parseHardhat(profileId, parserVersion, prepared, root);
      case 'echidna-v1': return parseEchidna(profileId, parserVersion, prepared, root);
      case 'mutation-v1': return parseMutation(profileId, parserVersion, prepared, root);
      case 'dependency-scan-v1': return parseDependency(profileId, parserVersion, prepared, root);
      default: throw fault('unknown_profile_id', `Unsupported Phase 5 profileId: ${profileId}`);
    }
  } catch (error) {
    return parserFailure(profileId, parserVersion, input, 'parser_error', error);
  }
}
