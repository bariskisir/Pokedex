/** Verifies the npm payload and executable entrypoints without publishing anything. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this check using npm run package:check.');
const output = execFileSync(
  process.execPath,
  [npm, 'pack', '--dry-run', '--ignore-scripts', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const packages = JSON.parse(output) as { files: { path: string }[] }[];
const files = new Set<string>();
for (const file of packages[0]?.files ?? []) files.add(file.path);
for (const required of [
  'dist/main/main.cjs',
  'dist/main/preload.cjs',
  'dist/main/cli.cjs',
  'dist/renderer/index.html',
  'dist/renderer/pokeball.png',
  'package.json',
  'README.md',
  'LICENSE',
]) {
  if (!files.has(required)) throw new Error(`The npm package is missing ${required}.`);
}
for (const file of files) {
  if (!file.startsWith('dist/') && !['package.json', 'README.md', 'LICENSE'].includes(file))
    throw new Error(`Unexpected file in npm package: ${file}`);
}
const cli = readFileSync(new URL('../dist/main/cli.cjs', import.meta.url), 'utf8');
if (!cli.startsWith('#!/usr/bin/env node'))
  throw new Error('The npm executable is missing its Node.js shebang.');
console.log(`Validated ${files.size} npm package files and all desktop entrypoints.`);
