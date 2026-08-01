import {
  MAX_CATEGORY_LENGTH,
  MAX_COVERAGE_VALUE,
  MAX_DURATION_MS,
  MAX_FINDINGS,
  MAX_LINE_NUMBER,
  MAX_NAME_LENGTH,
  MAX_NUMERIC_VALUE,
  MAX_OBJECT_FIELDS,
  MAX_RAW_COLLECTION_ENTRIES,
  MAX_SEED,
  MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES,
  boolValue,
  boundedInteger,
  boundedNumber,
  cleanString,
  compareNumber,
  compareText,
  enumValue,
  fault,
  finalizeResult,
  normalizeCounterexample,
  normalizeSortedCollection,
  normalizeTrace,
  optionalString,
  percentage,
  requireArray,
  requirePlainObject,
  safePath,
  stableStringify
} from './core.mjs';

function normalizeLocation(locationValue, path) {
  if (locationValue === undefined || locationValue === null) locationValue = {};
  requirePlainObject(locationValue, path);
  const location = {
    path: locationValue.file === undefined || locationValue.file === null || locationValue.file === ''
      ? ''
      : safePath(locationValue.file, `${path}.file`),
    start: locationValue.start === undefined || locationValue.start === null
      ? null
      : boundedInteger(locationValue.start, `${path}.start`, 0, MAX_NUMERIC_VALUE),
    end: locationValue.end === undefined || locationValue.end === null
      ? null
      : boundedInteger(locationValue.end, `${path}.end`, 0, MAX_NUMERIC_VALUE)
  };
  if (location.start !== null && location.end !== null && location.end < location.start) fault('invalid_integer', `${path}.end`);
  return location;
}

export function parseCompiler(profileId, parserVersion, prepared, warnings) {
  const root = requirePlainObject(prepared.result, '$.resultJson');
  let observedDiagnostics = [];
  const diagnostics = normalizeSortedCollection(
    root.errors ?? [],
    '$.resultJson.errors',
    MAX_FINDINGS,
    (item, index) => {
      const path = `$.resultJson.errors[${index}]`;
      requirePlainObject(item, path);
      return {
        severity: enumValue(item.severity ?? 'info', ['error', 'warning', 'info'], `${path}.severity`),
        category: cleanString(item.type ?? 'Diagnostic', `${path}.type`, MAX_CATEGORY_LENGTH),
        component: cleanString(item.component ?? 'general', `${path}.component`, MAX_CATEGORY_LENGTH),
        message: cleanString(item.message ?? item.formattedMessage ?? '', `${path}.message`),
        formattedMessage: cleanString(item.formattedMessage ?? item.message ?? '', `${path}.formattedMessage`),
        location: normalizeLocation(item.sourceLocation, `${path}.sourceLocation`)
      };
    },
    (left, right) =>
      compareText(left.location.path, right.location.path) ||
      compareNumber(left.location.start ?? -1, right.location.start ?? -1) ||
      compareNumber(left.location.end ?? -1, right.location.end ?? -1) ||
      compareText(left.severity, right.severity) ||
      compareText(left.category, right.category) ||
      compareText(left.message, right.message),
    warnings,
    (values) => { observedDiagnostics = values; }
  );

  const contracts = root.contracts ?? {};
  requirePlainObject(contracts, '$.resultJson.contracts');
  const contractEntries = Object.entries(contracts);
  if (contractEntries.length > MAX_RAW_COLLECTION_ENTRIES) fault('collection_too_large', '$.resultJson.contracts');
  contractEntries.sort(([left], [right]) => compareText(left, right));
  const omittedSources = Math.max(0, contractEntries.length - MAX_SOURCE_REFERENCES);
  warnings.addTruncation('$.resultJson.contracts', omittedSources);
  let contractCount = 0;
  for (const [source, sourceContracts] of contractEntries.slice(0, MAX_SOURCE_REFERENCES)) {
    safePath(source, '$.resultJson.contracts.key');
    requirePlainObject(sourceContracts, '$.resultJson.contracts.*');
    const names = Object.keys(sourceContracts);
    if (names.length > MAX_OBJECT_FIELDS) fault('object_too_large', '$.resultJson.contracts.*');
    contractCount += names.length;
  }

  const errors = observedDiagnostics.filter((item) => item.severity === 'error').length;
  const warningCount = observedDiagnostics.filter((item) => item.severity === 'warning').length;
  return finalizeResult(profileId, parserVersion, prepared, warnings, {
    exitClassification: prepared.exitCode !== 0 || errors > 0 ? 'tool_failure' : 'success',
    diagnostics,
    summary: {
      contracts: contractCount,
      errors,
      warnings: warningCount,
      diagnostics: diagnostics.length,
      ...(observedDiagnostics.length > diagnostics.length ? { observedDiagnostics: observedDiagnostics.length } : {})
    }
  });
}

function normalizeTestCase(item, index) {
  const path = `$.resultJson.tests[${index}]`;
  requirePlainObject(item, path);
  return {
    suite: cleanString(item.suite ?? '', `${path}.suite`, MAX_NAME_LENGTH),
    name: cleanString(item.name ?? '', `${path}.name`, MAX_NAME_LENGTH),
    status: enumValue(item.status, ['passed', 'failed', 'skipped'], `${path}.status`),
    durationMs: boundedNumber(item.durationMs ?? 0, `${path}.durationMs`, 0, MAX_DURATION_MS),
    reason: optionalString(item.reason, `${path}.reason`)
  };
}

function compareTestCase(left, right) {
  return compareText(left.suite, right.suite) ||
    compareText(left.name, right.name) ||
    compareText(left.status, right.status) ||
    compareNumber(left.durationMs, right.durationMs) ||
    compareText(left.reason ?? '', right.reason ?? '');
}

export function parseFoundryTests(profileId, parserVersion, prepared, warnings) {
  const root = requirePlainObject(prepared.result, '$.resultJson');
  let observedTests = [];
  const tests = normalizeSortedCollection(
    root.tests ?? [],
    '$.resultJson.tests',
    MAX_TEST_CASES,
    normalizeTestCase,
    compareTestCase,
    warnings,
    (values) => { observedTests = values; }
  );
  const summary = {
    passed: tests.filter((item) => item.status === 'passed').length,
    failed: tests.filter((item) => item.status === 'failed').length,
    skipped: tests.filter((item) => item.status === 'skipped').length,
    total: tests.length,
    ...(observedTests.length > tests.length ? {
      observedTotal: observedTests.length,
      observedPassed: observedTests.filter((item) => item.status === 'passed').length,
      observedFailed: observedTests.filter((item) => item.status === 'failed').length,
      observedSkipped: observedTests.filter((item) => item.status === 'skipped').length
    } : {})
  };
  return finalizeResult(profileId, parserVersion, prepared, warnings, {
    exitClassification: prepared.exitCode !== 0 || observedTests.some((item) => item.status === 'failed') ? 'tool_failure' : 'success',
    tests,
    summary
  });
}

function normalizeFuzzCase(item, index, warnings) {
  const path = `$.resultJson.cases[${index}]`;
  requirePlainObject(item, path);
  const counterexample = item.counterexample === undefined || item.counterexample === null
    ? null
    : normalizeCounterexample(item.counterexample, `${path}.counterexample`);
  const trace = normalizeTrace(item.trace, `${path}.trace`, warnings);
  return {
    test: cleanString(item.test ?? '', `${path}.test`, MAX_NAME_LENGTH),
    status: enumValue(item.status, ['passed', 'failed'], `${path}.status`),
    runs: boundedInteger(item.runs ?? 0, `${path}.runs`, 0, 1_000_000),
    seed: boundedInteger(item.seed ?? 0, `${path}.seed`, 0, MAX_SEED),
    counterexample,
    trace
  };
}

function compareFuzzCase(left, right) {
  return compareText(left.test, right.test) ||
    compareNumber(left.seed, right.seed) ||
    compareText(left.status, right.status) ||
    compareNumber(left.runs, right.runs) ||
    compareText(stableStringify(left.counterexample), stableStringify(right.counterexample)) ||
    compareText(stableStringify(left.trace), stableStringify(right.trace));
}

export function parseFuzz(profileId, parserVersion, prepared, warnings) {
  const root = requirePlainObject(prepared.result, '$.resultJson');
  let observedCases = [];
  const cases = normalizeSortedCollection(
    root.cases ?? [],
    '$.resultJson.cases',
    MAX_TEST_CASES,
    (item, index) => normalizeFuzzCase(item, index, warnings),
    compareFuzzCase,
    warnings,
    (values) => { observedCases = values; }
  );
  const tests = cases.map(({ counterexample, trace, ...item }) => item);
  const counterexamples = cases
    .filter((item) => item.counterexample !== null || item.trace.length > 0)
    .map((item) => ({ test: item.test, seed: item.seed, value: item.counterexample, trace: item.trace }));
  const summary = {
    passed: cases.filter((item) => item.status === 'passed').length,
    failed: cases.filter((item) => item.status === 'failed').length,
    total: cases.length,
    ...(observedCases.length > cases.length ? {
      observedTotal: observedCases.length,
      observedPassed: observedCases.filter((item) => item.status === 'passed').length,
      observedFailed: observedCases.filter((item) => item.status === 'failed').length
    } : {})
  };
  return finalizeResult(profileId, parserVersion, prepared, warnings, {
    exitClassification: prepared.exitCode !== 0 || observedCases.some((item) => item.status === 'failed') ? 'tool_failure' : 'success',
    tests,
    counterexamples,
    summary
  });
}

function normalizeInvariant(item, index, warnings) {
  const path = `$.resultJson.invariants[${index}]`;
  requirePlainObject(item, path);
  return {
    contract: cleanString(item.contract ?? '', `${path}.contract`, MAX_NAME_LENGTH),
    name: cleanString(item.name ?? '', `${path}.name`, MAX_NAME_LENGTH),
    status: enumValue(item.status, ['passed', 'failed'], `${path}.status`),
    runs: boundedInteger(item.runs ?? 0, `${path}.runs`, 0, 1_000_000),
    depth: boundedInteger(item.depth ?? 0, `${path}.depth`, 0, 10_000),
    seed: boundedInteger(item.seed ?? 0, `${path}.seed`, 0, MAX_SEED),
    counterexample: item.counterexample === undefined || item.counterexample === null
      ? null
      : normalizeCounterexample(item.counterexample, `${path}.counterexample`),
    trace: normalizeTrace(item.trace, `${path}.trace`, warnings)
  };
}

function compareInvariant(left, right) {
  return compareText(left.contract, right.contract) ||
    compareText(left.name, right.name) ||
    compareNumber(left.seed, right.seed) ||
    compareText(left.status, right.status) ||
    compareNumber(left.runs, right.runs) ||
    compareNumber(left.depth, right.depth) ||
    compareText(stableStringify(left.counterexample), stableStringify(right.counterexample)) ||
    compareText(stableStringify(left.trace), stableStringify(right.trace));
}

export function parseInvariant(profileId, parserVersion, prepared, warnings) {
  const root = requirePlainObject(prepared.result, '$.resultJson');
  let observedInvariants = [];
  const invariants = normalizeSortedCollection(
    root.invariants ?? [],
    '$.resultJson.invariants',
    MAX_TEST_CASES,
    (item, index) => normalizeInvariant(item, index, warnings),
    compareInvariant,
    warnings,
    (values) => { observedInvariants = values; }
  );
  const counterexamples = invariants
    .filter((item) => item.counterexample !== null || item.trace.length > 0)
    .map((item) => ({
      contract: item.contract,
      invariant: item.name,
      seed: item.seed,
      value: item.counterexample,
      trace: item.trace
    }));
  const summary = {
    passed: invariants.filter((item) => item.status === 'passed').length,
    failed: invariants.filter((item) => item.status === 'failed').length,
    total: invariants.length,
    ...(observedInvariants.length > invariants.length ? {
      observedTotal: observedInvariants.length,
      observedPassed: observedInvariants.filter((item) => item.status === 'passed').length,
      observedFailed: observedInvariants.filter((item) => item.status === 'failed').length
    } : {})
  };
  return finalizeResult(profileId, parserVersion, prepared, warnings, {
    exitClassification: prepared.exitCode !== 0 || observedInvariants.some((item) => item.status === 'failed') ? 'tool_failure' : 'success',
    invariants,
    counterexamples,
    summary
  });
}

function normalizeSourceLocation(element, path) {
  requirePlainObject(element, path);
  const mapping = element.source_mapping ?? {};
  requirePlainObject(mapping, `${path}.source_mapping`);
  const lines = requireArray(mapping.lines ?? [], `${path}.source_mapping.lines`, MAX_SOURCE_REFERENCES)
    .map((line, index) => boundedInteger(line, `${path}.source_mapping.lines[${index}]`, 1, MAX_LINE_NUMBER));
  lines.sort(compareNumber);
  return {
    path: safePath(mapping.filename_relative ?? '', `${path}.source_mapping.filename_relative`),
    lines: [...new Set(lines)]
  };
}

function compareSourceLocation(left, right) {
  return compareText(left.path, right.path) || compareNumber(left.lines[0] ?? 0, right.lines[0] ?? 0) || compareText(stableStringify(left.lines), stableStringify(right.lines));
}

function normalizeSlitherFinding(item, index, warnings) {
  const path = `$.resultJson.results.detectors[${index}]`;
  requirePlainObject(item, path);
  const locations = normalizeSortedCollection(
    item.elements ?? [],
    `${path}.elements`,
    MAX_SOURCE_REFERENCES,
    (element, elementIndex) => normalizeSourceLocation(element, `${path}.elements[${elementIndex}]`),
    compareSourceLocation,
    warnings
  );
  return {
    detector: cleanString(item.check ?? '', `${path}.check`, MAX_CATEGORY_LENGTH),
    impact: cleanString(item.impact ?? 'Unknown', `${path}.impact`, 80),
    confidence: cleanString(item.confidence ?? 'Unknown', `${path}.confidence`, 80),
    description: cleanString(item.description ?? '', `${path}.description`),
    locations
  };
}

function compareFinding(left, right) {
  return compareText(left.detector, right.detector) ||
    compareText(left.locations[0]?.path ?? '', right.locations[0]?.path ?? '') ||
    compareText(left.description, right.description) ||
    compareText(left.impact, right.impact) ||
    compareText(left.confidence, right.confidence) ||
    compareText(stableStringify(left.locations), stableStringify(right.locations));
}

export function parseSlither(profileId, parserVersion, prepared, warnings) {
  const root = requirePlainObject(prepared.result, '$.resultJson');
  const success = root.success === undefined ? true : boolValue(root.success, '$.resultJson.success');
  const results = root.results ?? {};
  requirePlainObject(results, '$.resultJson.results');
  const findings = normalizeSortedCollection(
    results.detectors ?? [],
    '$.resultJson.results.detectors',
    MAX_FINDINGS,
    (item, index) => normalizeSlitherFinding(item, index, warnings),
    compareFinding,
    warnings
  );
  return finalizeResult(profileId, parserVersion, prepared, warnings, {
    exitClassification: prepared.exitCode !== 0 || success === false ? 'tool_failure' : 'success',
    findings,
    summary: {
      findings: findings.length,
      high: findings.filter((item) => item.impact.toLowerCase() === 'high').length
    }
  });
}

function coverageMetric(value, path) {
  requirePlainObject(value, path);
  const covered = boundedInteger(value.covered, `${path}.covered`, 0, MAX_COVERAGE_VALUE);
  const total = boundedInteger(value.total, `${path}.total`, 0, MAX_COVERAGE_VALUE);
  if (covered > total) fault('invalid_coverage', path);
  return { covered, total, percentage: percentage(covered, total) };
}

function normalizeCoverageFile(item, index) {
  const path = `$.resultJson.files[${index}]`;
  requirePlainObject(item, path);
  return {
    path: safePath(item.path ?? '', `${path}.path`),
    lines: coverageMetric(item.lines, `${path}.lines`),
    functions: coverageMetric(item.functions, `${path}.functions`),
    branches: coverageMetric(item.branches, `${path}.branches`)
  };
}

export function parseCoverage(profileId, parserVersion, prepared, warnings) {
  const root = requirePlainObject(prepared.result, '$.resultJson');
  const rawFiles = requireArray(root.files ?? [], '$.resultJson.files');
  const normalizedFiles = rawFiles.map(normalizeCoverageFile).sort((left, right) => compareText(left.path, right.path) || compareText(stableStringify(left), stableStringify(right)));
  const files = [];
  for (const file of normalizedFiles) {
    const previous = files.at(-1);
    if (!previous || previous.path !== file.path) {
      files.push(file);
      continue;
    }
    if (stableStringify(previous) !== stableStringify(file)) fault('conflicting_coverage_file', '$.resultJson.files');
  }
  const omitted = Math.max(0, files.length - MAX_SOURCE_REFERENCES);
  warnings.addTruncation('$.resultJson.files', omitted);
  const boundedFiles = files.slice(0, MAX_SOURCE_REFERENCES);
  const totals = {};
  for (const metric of ['lines', 'functions', 'branches']) {
    const covered = boundedFiles.reduce((sum, item) => sum + item[metric].covered, 0);
    const total = boundedFiles.reduce((sum, item) => sum + item[metric].total, 0);
    if (covered > MAX_NUMERIC_VALUE || total > MAX_NUMERIC_VALUE) fault('numeric_out_of_range', `$.coverage.totals.${metric}`);
    totals[metric] = { covered, total, percentage: percentage(covered, total) };
  }
  return finalizeResult(profileId, parserVersion, prepared, warnings, {
    exitClassification: prepared.exitCode === 0 ? 'success' : 'tool_failure',
    coverage: { files: boundedFiles, totals },
    summary: { files: boundedFiles.length }
  });
}
