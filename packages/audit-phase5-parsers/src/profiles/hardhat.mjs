import {
  MAX_DURATION_MS,
  MAX_COUNTEREXAMPLE_STEPS,
  MAX_ALIASES,
  MUTATION_OPERATORS,
  SEVERITIES,
  deepFreeze,
  fault,
  plainObject,
  exactKeys,
  array,
  integer,
  cleanString,
  cleanMessage,
  safePath,
  stringArray,
  baseResult,
  dedupeAndSort,
  canonicalizeByIdentity,
  evidenceFor
} from '../common.mjs';

export function parseHardhat(profileId, parserVersion, prepared, root) {
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

