import { ValidationError, assertProfileId } from '../../audit-protocol/src/index.mjs';

export const MAX_INPUT_BYTES = 5_000_000;
export const MAX_LINES = 10_000;
export const MAX_FINDINGS = 10_000;
const MAX_STRING_LENGTH = 4_000;
const MAX_DURATION_MS = 86_400_000;
const MAX_COUNTEREXAMPLE_BYTES = 256_000;

export const PARSER_VERSIONS = Object.freeze({
  'solidity-compile-v1': 'solidity-compile-parser-v1',
  'foundry-test-v1': 'foundry-test-parser-v1',
  'foundry-fuzz-v1': 'foundry-fuzz-parser-v1',
  'foundry-invariant-v1': 'foundry-invariant-parser-v1',
  'slither-v1': 'slither-parser-v1',
  'coverage-forge-v1': 'coverage-forge-parser-v1'
});

const encoder = new TextEncoder();

function knownProfile(profileId) {
  assertProfileId(profileId);
  const parserVersion = PARSER_VERSIONS[profileId];
  if (!parserVersion) throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
  return parserVersion;
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function cleanString(value, path, maximum = MAX_STRING_LENGTH) {
  if (typeof value !== 'string') throw parserFault('invalid_string', `${path} must be a string`);
  if (value.length > maximum) throw parserFault('string_too_long', `${path} exceeds ${maximum} characters`);
  return value.replace(/\u0000/g, '');
}

function safePath(value, path) {
  const result = cleanString(value, path, 1_024).replaceAll('\\', '/');
  if (result.startsWith('/') || /^[A-Za-z]:\//.test(result) || result.split('/').includes('..')) {
    throw parserFault('unsafe_path', `${path} is not a safe relative path`);
  }
  return result;
}

function integer(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw parserFault('invalid_integer', `${path} is invalid`);
  return value;
}

function numberValue(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw parserFault('invalid_number', `${path} is invalid`);
  return value;
}

function plainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw parserFault('invalid_object', `${path} must be an object`);
  return value;
}

function array(value, path, maximum = MAX_FINDINGS) {
  if (!Array.isArray(value) || value.length > maximum) throw parserFault('invalid_array', `${path} must contain at most ${maximum} entries`);
  return value;
}

function parserFault(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseJson(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); }
    catch { throw parserFault('invalid_json', 'Tool result JSON is malformed'); }
  }
  return plainObject(value, '$.resultJson');
}

function boundedData(value, path = '$.counterexample', depth = 0) {
  if (depth > 12) throw parserFault('data_too_deep', `${path} exceeds maximum nesting`);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw parserFault('invalid_number', `${path} contains a non-finite number`);
    return value;
  }
  if (typeof value === 'string') return cleanString(value, path);
  if (Array.isArray(value)) {
    if (value.length > 1_000) throw parserFault('array_too_large', `${path} contains too many entries`);
    return value.map((item, index) => boundedData(item, `${path}[${index}]`, depth + 1));
  }
  plainObject(value, path);
  const result = {};
  const entries = Object.entries(value);
  if (entries.length > 1_000) throw parserFault('object_too_large', `${path} contains too many fields`);
  for (const [key, child] of entries) {
    const safeKey = cleanString(key, `${path}.key`, 160);
    result[safeKey] = boundedData(child, `${path}.${safeKey}`, depth + 1);
  }
  if (encoder.encode(JSON.stringify(result)).byteLength > MAX_COUNTEREXAMPLE_BYTES) throw parserFault('data_too_large', `${path} exceeds ${MAX_COUNTEREXAMPLE_BYTES} bytes`);
  return result;
}

function percentage(covered, total) {
  return total === 0 ? 100 : Math.round((covered / total) * 10_000) / 100;
}

function compareStrings(left, right) {
  return left.localeCompare(right);
}

function baseResult(profileId, parserVersion, input) {
  return {
    schemaVersion: 'tool-result-v1',
    profileId,
    parserVersion,
    exitClassification: 'success',
    durationMs: input.durationMs,
    exitCode: input.exitCode,
    diagnostics: [],
    tests: [],
    counterexamples: [],
    invariants: [],
    findings: [],
    coverage: null,
    parserWarnings: [],
    parserErrors: [],
    summary: {}
  };
}

function parserErrorResult(profileId, parserVersion, input, error) {
  return Object.freeze({
    ...baseResult(profileId, parserVersion, {
      durationMs: Number.isSafeInteger(input?.durationMs) && input.durationMs >= 0 ? input.durationMs : 0,
      exitCode: Number.isSafeInteger(input?.exitCode) ? input.exitCode : null
    }),
    exitClassification: 'parser_error',
    parserErrors: Object.freeze([Object.freeze({
      code: typeof error?.code === 'string' ? error.code : 'parser_error',
      message: typeof error?.message === 'string' ? error.message.slice(0, MAX_STRING_LENGTH) : 'Tool output could not be parsed'
    })])
  });
}

function prepareInput(input) {
  plainObject(input, '$');
  const stdout = text(input.stdout);
  const stderr = text(input.stderr);
  const resultText = typeof input.resultJson === 'string' ? input.resultJson : JSON.stringify(input.resultJson ?? null);
  const totalBytes = encoder.encode(stdout).byteLength + encoder.encode(stderr).byteLength + encoder.encode(resultText).byteLength;
  if (totalBytes > MAX_INPUT_BYTES) throw parserFault('input_too_large', `Combined parser input exceeds ${MAX_INPUT_BYTES} bytes`);
  const lineCount = stdout.split('\n').length + stderr.split('\n').length;
  if (lineCount > MAX_LINES) throw parserFault('too_many_lines', `Combined stdout and stderr exceed ${MAX_LINES} lines`);
  const exitCode = integer(input.exitCode, '$.exitCode', 0, 255);
  const durationMs = integer(input.durationMs, '$.durationMs', 0, MAX_DURATION_MS);
  return { result: parseJson(input.resultJson), stdout, stderr, exitCode, durationMs };
}

function parseCompiler(profileId, parserVersion, prepared) {
  const root = plainObject(prepared.result, '$.resultJson');
  const diagnostics = [];
  const seen = new Set();
  for (const [index, item] of array(root.errors ?? [], '$.resultJson.errors')) {
    void index;
  }
  array(root.errors ?? [], '$.resultJson.errors').forEach((item, index) => {
    plainObject(item, `$.resultJson.errors[${index}]`);
    const locationValue = item.sourceLocation ?? {};
    plainObject(locationValue, `$.resultJson.errors[${index}].sourceLocation`);
    const diagnostic = {
      severity: ['error', 'warning', 'info'].includes(item.severity) ? item.severity : 'info',
      category: cleanString(String(item.type ?? 'Diagnostic'), `$.resultJson.errors[${index}].type`, 160),
      component: cleanString(String(item.component ?? 'general'), `$.resultJson.errors[${index}].component`, 160),
      message: cleanString(String(item.message ?? item.formattedMessage ?? ''), `$.resultJson.errors[${index}].message`),
      formattedMessage: cleanString(String(item.formattedMessage ?? item.message ?? ''), `$.resultJson.errors[${index}].formattedMessage`),
      location: {
        path: locationValue.file ? safePath(locationValue.file, `$.resultJson.errors[${index}].sourceLocation.file`) : '',
        start: Number.isSafeInteger(locationValue.start) && locationValue.start >= 0 ? locationValue.start : null,
        end: Number.isSafeInteger(locationValue.end) && locationValue.end >= 0 ? locationValue.end : null
      }
    };
    const key = JSON.stringify(diagnostic);
    if (!seen.has(key)) { seen.add(key); diagnostics.push(diagnostic); }
  });
  diagnostics.sort((a, b) => compareStrings(a.location.path, b.location.path) || (a.location.start ?? -1) - (b.location.start ?? -1) || compareStrings(a.severity, b.severity) || compareStrings(a.message, b.message));
  const contracts = plainObject(root.contracts ?? {}, '$.resultJson.contracts');
  let contractCount = 0;
  for (const [source, sourceContracts] of Object.entries(contracts)) {
    safePath(source, `$.resultJson.contracts.${source}`);
    contractCount += Object.keys(plainObject(sourceContracts, `$.resultJson.contracts.${source}`)).length;
  }
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.filter((item) => item.severity === 'warning').length;
  return {
    ...baseResult(profileId, parserVersion, prepared),
    exitClassification: prepared.exitCode !== 0 || errors > 0 ? 'tool_failure' : 'success',
    diagnostics,
    summary: { contracts: contractCount, errors, warnings }
  };
}

function parseFoundryTests(profileId, parserVersion, prepared) {
  const root = plainObject(prepared.result, '$.resultJson');
  const tests = array(root.tests ?? [], '$.resultJson.tests').map((item, index) => {
    plainObject(item, `$.resultJson.tests[${index}]`);
    const status = ['passed', 'failed', 'skipped'].includes(item.status) ? item.status : 'failed';
    return {
      suite: cleanString(String(item.suite ?? ''), `$.resultJson.tests[${index}].suite`, 512),
      name: cleanString(String(item.name ?? ''), `$.resultJson.tests[${index}].name`, 512),
      status,
      durationMs: numberValue(item.durationMs ?? 0, `$.resultJson.tests[${index}].durationMs`, 0, MAX_DURATION_MS),
      reason: item.reason === undefined ? null : cleanString(String(item.reason), `$.resultJson.tests[${index}].reason`)
    };
  });
  tests.sort((a, b) => compareStrings(a.suite, b.suite) || compareStrings(a.name, b.name));
  const summary = {
    passed: tests.filter((item) => item.status === 'passed').length,
    failed: tests.filter((item) => item.status === 'failed').length,
    skipped: tests.filter((item) => item.status === 'skipped').length,
    total: tests.length
  };
  return { ...baseResult(profileId, parserVersion, prepared), exitClassification: prepared.exitCode !== 0 || summary.failed > 0 ? 'tool_failure' : 'success', tests, summary };
}

function parseFuzz(profileId, parserVersion, prepared) {
  const root = plainObject(prepared.result, '$.resultJson');
  const cases = array(root.cases ?? [], '$.resultJson.cases').map((item, index) => {
    plainObject(item, `$.resultJson.cases[${index}]`);
    return {
      test: cleanString(String(item.test ?? ''), `$.resultJson.cases[${index}].test`, 512),
      status: item.status === 'passed' ? 'passed' : 'failed',
      runs: integer(item.runs ?? 0, `$.resultJson.cases[${index}].runs`, 0, 100_000),
      seed: integer(item.seed ?? 0, `$.resultJson.cases[${index}].seed`, 0, 4_294_967_295),
      counterexample: item.counterexample === undefined ? null : boundedData(item.counterexample, `$.resultJson.cases[${index}].counterexample`)
    };
  });
  cases.sort((a, b) => compareStrings(a.test, b.test));
  const counterexamples = cases.filter((item) => item.counterexample !== null).map((item) => ({ test: item.test, seed: item.seed, value: item.counterexample }));
  const summary = { passed: cases.filter((item) => item.status === 'passed').length, failed: cases.filter((item) => item.status === 'failed').length, total: cases.length };
  return { ...baseResult(profileId, parserVersion, prepared), exitClassification: prepared.exitCode !== 0 || summary.failed > 0 ? 'tool_failure' : 'success', tests: cases.map(({ counterexample, ...item }) => item), counterexamples, summary };
}

function parseInvariant(profileId, parserVersion, prepared) {
  const root = plainObject(prepared.result, '$.resultJson');
  const invariants = array(root.invariants ?? [], '$.resultJson.invariants').map((item, index) => {
    plainObject(item, `$.resultJson.invariants[${index}]`);
    return {
      contract: cleanString(String(item.contract ?? ''), `$.resultJson.invariants[${index}].contract`, 512),
      name: cleanString(String(item.name ?? ''), `$.resultJson.invariants[${index}].name`, 512),
      status: item.status === 'passed' ? 'passed' : 'failed',
      runs: integer(item.runs ?? 0, `$.resultJson.invariants[${index}].runs`, 0, 10_000),
      depth: integer(item.depth ?? 0, `$.resultJson.invariants[${index}].depth`, 0, 1_024),
      seed: integer(item.seed ?? 0, `$.resultJson.invariants[${index}].seed`, 0, 4_294_967_295),
      counterexample: item.counterexample === undefined ? null : boundedData(item.counterexample, `$.resultJson.invariants[${index}].counterexample`)
    };
  });
  invariants.sort((a, b) => compareStrings(a.contract, b.contract) || compareStrings(a.name, b.name));
  const summary = { passed: invariants.filter((item) => item.status === 'passed').length, failed: invariants.filter((item) => item.status === 'failed').length, total: invariants.length };
  return { ...baseResult(profileId, parserVersion, prepared), exitClassification: prepared.exitCode !== 0 || summary.failed > 0 ? 'tool_failure' : 'success', invariants, counterexamples: invariants.filter((item) => item.counterexample !== null).map((item) => ({ contract: item.contract, invariant: item.name, seed: item.seed, value: item.counterexample })), summary };
}

function parseSlither(profileId, parserVersion, prepared) {
  const root = plainObject(prepared.result, '$.resultJson');
  const results = plainObject(root.results ?? {}, '$.resultJson.results');
  const findings = array(results.detectors ?? [], '$.resultJson.results.detectors').map((item, index) => {
    plainObject(item, `$.resultJson.results.detectors[${index}]`);
    const locations = array(item.elements ?? [], `$.resultJson.results.detectors[${index}].elements`, 1_000).map((element, elementIndex) => {
      plainObject(element, `$.resultJson.results.detectors[${index}].elements[${elementIndex}]`);
      const mapping = plainObject(element.source_mapping ?? {}, `$.resultJson.results.detectors[${index}].elements[${elementIndex}].source_mapping`);
      const lines = array(mapping.lines ?? [], `$.resultJson.results.detectors[${index}].elements[${elementIndex}].source_mapping.lines`, 1_000).map((line, lineIndex) => integer(line, `$.lines[${lineIndex}]`, 1, 10_000_000));
      return { path: safePath(String(mapping.filename_relative ?? ''), '$.source_mapping.filename_relative'), lines: [...new Set(lines)].sort((a, b) => a - b) };
    });
    locations.sort((a, b) => compareStrings(a.path, b.path) || (a.lines[0] ?? 0) - (b.lines[0] ?? 0));
    return {
      detector: cleanString(String(item.check ?? ''), `$.resultJson.results.detectors[${index}].check`, 160),
      impact: cleanString(String(item.impact ?? 'Unknown'), `$.resultJson.results.detectors[${index}].impact`, 80),
      confidence: cleanString(String(item.confidence ?? 'Unknown'), `$.resultJson.results.detectors[${index}].confidence`, 80),
      description: cleanString(String(item.description ?? ''), `$.resultJson.results.detectors[${index}].description`),
      locations
    };
  });
  findings.sort((a, b) => compareStrings(a.detector, b.detector) || compareStrings(a.locations[0]?.path ?? '', b.locations[0]?.path ?? '') || compareStrings(a.description, b.description));
  return { ...baseResult(profileId, parserVersion, prepared), exitClassification: prepared.exitCode !== 0 || root.success === false ? 'tool_failure' : 'success', findings, summary: { findings: findings.length, high: findings.filter((item) => item.impact.toLowerCase() === 'high').length } };
}

function coverageMetric(value, path) {
  plainObject(value, path);
  const covered = integer(value.covered, `${path}.covered`, 0, 1_000_000_000);
  const total = integer(value.total, `${path}.total`, 0, 1_000_000_000);
  if (covered > total) throw parserFault('invalid_coverage', `${path}.covered exceeds total`);
  return { covered, total, percentage: percentage(covered, total) };
}

function parseCoverage(profileId, parserVersion, prepared) {
  const root = plainObject(prepared.result, '$.resultJson');
  const files = array(root.files ?? [], '$.resultJson.files').map((item, index) => {
    plainObject(item, `$.resultJson.files[${index}]`);
    return {
      path: safePath(String(item.path ?? ''), `$.resultJson.files[${index}].path`),
      lines: coverageMetric(item.lines, `$.resultJson.files[${index}].lines`),
      functions: coverageMetric(item.functions, `$.resultJson.files[${index}].functions`),
      branches: coverageMetric(item.branches, `$.resultJson.files[${index}].branches`)
    };
  });
  files.sort((a, b) => compareStrings(a.path, b.path));
  const totals = {};
  for (const metric of ['lines', 'functions', 'branches']) {
    const covered = files.reduce((sum, item) => sum + item[metric].covered, 0);
    const total = files.reduce((sum, item) => sum + item[metric].total, 0);
    totals[metric] = { covered, total, percentage: percentage(covered, total) };
  }
  return { ...baseResult(profileId, parserVersion, prepared), exitClassification: prepared.exitCode === 0 ? 'success' : 'tool_failure', coverage: { files, totals }, summary: { files: files.length } };
}

export function parseToolOutput(profileId, input) {
  const parserVersion = knownProfile(profileId);
  try {
    const prepared = prepareInput(input);
    let result;
    switch (profileId) {
      case 'solidity-compile-v1': result = parseCompiler(profileId, parserVersion, prepared); break;
      case 'foundry-test-v1': result = parseFoundryTests(profileId, parserVersion, prepared); break;
      case 'foundry-fuzz-v1': result = parseFuzz(profileId, parserVersion, prepared); break;
      case 'foundry-invariant-v1': result = parseInvariant(profileId, parserVersion, prepared); break;
      case 'slither-v1': result = parseSlither(profileId, parserVersion, prepared); break;
      case 'coverage-forge-v1': result = parseCoverage(profileId, parserVersion, prepared); break;
      default: throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
    }
    return Object.freeze(result);
  } catch (error) {
    return parserErrorResult(profileId, parserVersion, input, error);
  }
}
