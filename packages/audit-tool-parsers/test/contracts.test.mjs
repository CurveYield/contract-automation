import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARSER_LIMITS,
  PARSER_VERSIONS,
  TOOL_RESULT_SCHEMA_VERSION,
  parseToolOutput
} from '../src/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(packageRoot, relativePath), 'utf8'));
}

test('publishes strict versioned parser input and normalized result schemas', async () => {
  const inputSchema = await readJson('schemas/parser-input-v1.schema.json');
  assert.equal(inputSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(inputSchema.$id, 'https://curveyield.com/audit/schemas/parser-input-v1.schema.json');
  assert.equal(inputSchema.type, 'object');
  assert.equal(inputSchema.additionalProperties, false);
  assert.deepEqual(inputSchema.required, ['durationMs', 'terminationReason']);
  assert.deepEqual(inputSchema.properties.terminationReason.enum, ['completed', 'timeout', 'cancelled', 'resource_exhaustion']);
  assert.equal(inputSchema.properties.durationMs.maximum, PARSER_LIMITS.durationMs);
  assert.equal(inputSchema.properties.stdout.maxLength, PARSER_LIMITS.inputBytes);
  assert.equal(inputSchema.properties.stderr.maxLength, PARSER_LIMITS.inputBytes);
  assert.deepEqual(inputSchema.allOf[0].then.required, ['resultJson', 'exitCode']);

  const resultSchema = await readJson('schemas/tool-result-v1.schema.json');
  assert.equal(resultSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(resultSchema.$id, 'https://curveyield.com/audit/schemas/tool-result-v1.schema.json');
  assert.equal(resultSchema.properties.schemaVersion.const, TOOL_RESULT_SCHEMA_VERSION);
  assert.deepEqual(resultSchema.properties.profileId.enum, Object.keys(PARSER_VERSIONS));
  assert.deepEqual(resultSchema.properties.parserVersion.enum, Object.values(PARSER_VERSIONS));
  assert.deepEqual(resultSchema.properties.exitClassification.enum, ['success', 'tool_failure', 'timeout', 'cancelled', 'resource_exhaustion', 'parser_error']);
  assert.equal(resultSchema.additionalProperties, false);
  assert.equal(resultSchema.properties.diagnostics.maxItems, PARSER_LIMITS.findings);
  assert.equal(resultSchema.properties.tests.maxItems, PARSER_LIMITS.testCases);
  assert.equal(resultSchema.properties.findings.maxItems, PARSER_LIMITS.findings);
  assert.equal(resultSchema.properties.counterexamples.maxItems, PARSER_LIMITS.testCases);
  assert.equal(resultSchema.properties.invariants.maxItems, PARSER_LIMITS.testCases);
  assert.equal(resultSchema.$defs.trace.maxItems, PARSER_LIMITS.traceEntries);
  assert.equal(resultSchema.$defs.sourceReferences.maxItems, PARSER_LIMITS.sourceReferences);
});

test('documents the inert parser boundary and deterministic normalization contract', async () => {
  const readme = await readFile(join(packageRoot, 'README_v1.md'), 'utf8');
  assert.match(readme, /only explicitly supplied inert UTF-8 text or JSON bytes/i);
  assert.match(readme, /never invokes tools, compilers, processes, containers, networks, or submitted code/i);
  assert.match(readme, /deterministic sorting and deduplication/i);
  assert.match(readme, /parser-error sanitization/i);
  assert.match(readme, /tool-result-v1/);
});

test('parser source has no execution, process, filesystem, container, or network capability', async () => {
  const sourceNames = (await readdir(join(packageRoot, 'src'))).filter((name) => name.endsWith('.mjs')).sort();
  const sources = await Promise.all(sourceNames.map(async (name) => [name, await readFile(join(packageRoot, 'src', name), 'utf8')]));
  const forbidden = [
    /node:(?:child_process|cluster|worker_threads|fs|fs\/promises|net|tls|http|https|http2|dns|dgram|vm|module)/,
    /\b(?:spawn|spawnSync|exec|execFile|execSync|fork)\s*\(/,
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bDeno\b/,
    /\bBun\b/,
    /\bprocess\.(?:env|binding|dlopen|kill|chdir)\b/,
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\bWebAssembly\b/,
    /\bimport\s*\(/
  ];
  for (const [name, source] of sources) {
    for (const expression of forbidden) assert.doesNotMatch(source, expression, name);
  }
  const core = sources.find(([name]) => name === 'core.mjs')[1];
  const index = sources.find(([name]) => name === 'index.mjs')[1];
  assert.match(core, /^import \{ ValidationError, assertProfileId \} from '\.\.\/\.\.\/audit-protocol\/src\/index\.mjs';/);
  assert.match(index, /from '\.\/core\.mjs';/);
  assert.match(index, /from '\.\/profiles\.mjs';/);
});

test('enforces the configured maximum string length', () => {
  const result = parseToolOutput('foundry-test-v1', {
    resultJson: JSON.stringify({ tests: [{ suite: 'S', name: 'N', status: 'failed', durationMs: 0, reason: 'x'.repeat(PARSER_LIMITS.stringLength + 1) }] }),
    stdout: '',
    stderr: '',
    exitCode: 1,
    durationMs: 1,
    terminationReason: 'completed'
  });
  assert.deepEqual(result.parserErrors, [{
    code: 'string_too_long',
    message: 'A string exceeded the configured length bound.',
    path: '$.resultJson.tests[0].reason'
  }]);
});
