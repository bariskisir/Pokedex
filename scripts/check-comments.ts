/** Enforces documentation locations for source files and executable functions. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', 'node_modules', 'dist', 'test-results', 'playwright-report']);
const failures: string[] = [];

interface AstNode {
  type: string;
  leadingComments?: unknown[];
  loc?: { start: { line: number } };
  [key: string]: unknown;
}

/** Recognizes syntax nodes while ignoring primitive metadata fields. */
function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
}

/** Checks every executable function, including callbacks and class methods, for a leading comment. */
function inspect(node: AstNode, parents: AstNode[], filename: string): void {
  const executable = [
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ClassMethod',
    'ObjectMethod',
    'ClassPrivateMethod',
  ].includes(node.type);
  if (executable) {
    let documented = Boolean(node.leadingComments?.length);
    for (const parent of parents) {
      if (documented || /Function|Method|BlockStatement|Program/.test(parent.type)) break;
      documented = Boolean(parent.leadingComments?.length);
    }
    if (!documented)
      failures.push(`${filename}:${node.loc?.start.line ?? 1}: Add a comment above this function.`);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.endsWith('Comments') || key === 'loc' || key === 'tokens') continue;
    if (isNode(value)) inspect(value, [node, ...parents], filename);
    else if (Array.isArray(value))
      for (const child of value) if (isNode(child)) inspect(child, [node, ...parents], filename);
  }
}

/** Walks maintained source files and validates headers before parsing TypeScript functions. */
function checkDirectory(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      checkDirectory(fullPath);
      continue;
    }
    if (!/\.(?:[cm]?tsx?|scss|html)$/.test(entry.name)) continue;
    const filename = relative(root, fullPath);
    const source = readFileSync(fullPath, 'utf8');
    const header = source
      .replace(/^#![^\n]*\n/, '')
      .replace(/^<!doctype html>\s*/i, '')
      .trimStart();
    if (!/^(\/\*|\/\/|<!--)/.test(header)) failures.push(`${filename}: Add a file header comment.`);
    if (/\.[cm]?tsx?$/.test(entry.name)) {
      const ast = parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] });
      inspect(ast as unknown as AstNode, [], filename);
    }
  }
}

checkDirectory(root);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Every source file and executable function has a documentation comment.');
