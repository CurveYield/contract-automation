import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePhase5ToolResult } from '../packages/audit-phase5-parsers/src/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE_ROOT = path.join(ROOT, 'test/fixtures/audit-phase5');
export const readText = (name) => fs.readFileSync(path.join(FIXTURE_ROOT, name), 'utf8');
export const readJson = (name) => JSON.parse(readText(name));

export const FIXTURE_CASES = Object.freeze([
  ['hardhat-success-v1.json','hardhat-test-v1',0,'completed','success'],
  ['hardhat-findings-v1.json','hardhat-test-v1',1,'completed','findings'],
  ['echidna-success-v1.json','echidna-v1',0,'completed','success'],
  ['echidna-findings-v1.json','echidna-v1',1,'completed','findings'],
  ['mutation-success-v1.json','mutation-v1',0,'completed','success'],
  ['mutation-findings-v1.json','mutation-v1',1,'completed','findings'],
  ['dependency-success-v1.json','dependency-scan-v1',0,'completed','success'],
  ['dependency-findings-v1.json','dependency-scan-v1',1,'completed','findings'],
  ['parser-error-unsafe-path-v1.json','hardhat-test-v1',0,'completed','parser_error'],
  ['malformed-output-v1.txt','hardhat-test-v1',1,'completed','malformed_output'],
  ['hardhat-sensitive-messages-v2.json','hardhat-test-v1',1,'completed','findings'],
  ['mutation-conflicting-duplicates-v2.json','mutation-v1',1,'completed','parser_error'],
  ['dependency-conflicting-duplicates-v2.json','dependency-scan-v1',1,'completed','parser_error']
]);

export function parseFixture(name, profileId, exitCode, termination='completed', durationMs=7) {
  return parsePhase5ToolResult(profileId, { resultBytes: readText(name), exitCode, durationMs, termination });
}
export function parseLifecycle(name, profileId='hardhat-test-v1') {
  const f=readJson(name);
  return parsePhase5ToolResult(profileId,{resultBytes:f.resultJson,exitCode:f.exitCode,durationMs:f.durationMs,termination:f.termination});
}
export function clone(value) { return structuredClone(value); }
export function reverseRawFixture(name) {
  const root=readJson(name);
  if (Array.isArray(root.tests)) root.tests.reverse();
  if (Array.isArray(root.mutants)) root.mutants.reverse();
  if (Array.isArray(root.results)) {
    root.results.reverse();
    for (const result of root.results) {
      result.packages?.reverse();
      for (const pkg of result.packages ?? []) pkg.vulnerabilities?.reverse();
    }
  }
  return JSON.stringify(root);
}
export function assertCodePath(assert, fn, code, pathValue) {
  assert.throws(fn, (error) => error?.code === code && error?.path === pathValue);
}
