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

export function parseEchidna(profileId, parserVersion, prepared, root) {
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

