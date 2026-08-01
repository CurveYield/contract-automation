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

export function parseDependency(profileId, parserVersion, prepared, root) {
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
  const dependencyFindings = canonicalizeByIdentity(
    records,
    (item) => JSON.stringify([
      item.sourcePath,
      item.sourceType,
      item.package.ecosystem,
      item.package.name,
      item.package.version,
      item.id
    ]),
    'dependency',
    (a, b) => a.sourcePath.localeCompare(b.sourcePath) ||
      a.sourceType.localeCompare(b.sourceType) ||
      a.package.ecosystem.localeCompare(b.package.ecosystem) ||
      a.package.name.localeCompare(b.package.name) ||
      a.package.version.localeCompare(b.package.version) ||
      a.id.localeCompare(b.id)
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
