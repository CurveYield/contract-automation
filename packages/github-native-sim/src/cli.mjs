#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGitHubNativeJob } from './run-job-file.mjs';

const USAGE = 'Usage: node packages/github-native-sim/src/cli.mjs --job <job.json> --output <directory>';
const ALLOWED = new Set(['--job', '--output']);

export function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!ALLOWED.has(argument)) throw new Error(`Unknown argument: ${argument}`);
    if (argument in values) throw new Error(`Duplicate argument: ${argument}`);
    const value = args[index + 1];
    if (value === undefined || ALLOWED.has(value) || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    values[argument] = value;
    index += 1;
  }
  if (!values['--job'] || !values['--output']) throw new Error(USAGE);
  return {
    jobFile: values['--job'],
    outputDir: values['--output']
  };
}

export async function main(args = process.argv.slice(2)) {
  try {
    const options = parseArguments(args);
    await runGitHubNativeJob(options);
  } catch (cause) {
    const message = cause?.message ?? String(cause);
    process.stderr.write(`${message}\n`);
    if (message !== USAGE && /required|Missing value/.test(message)) {
      process.stderr.write(`${USAGE}\n`);
    }
    process.exitCode = 1;
  }
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedFile === fileURLToPath(import.meta.url)) {
  await main();
}
