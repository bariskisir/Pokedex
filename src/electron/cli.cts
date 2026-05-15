#!/usr/bin/env node

/**
 * Provides the npm binary entrypoint that launches the built Electron app.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const electronPath = require('electron') as string;

/**
 * Resolves the built Electron main-process script.
 */
function resolveMainScript(): string {
  return path.join(__dirname, 'main.cjs');
}

/**
 * Starts Electron and exits this CLI process with Electron's exit code.
 */
function runElectron(): void {
  const processRef = spawn(electronPath, [resolveMainScript()], { stdio: 'inherit' });

  processRef.on('close', (code: number | null) => {
    process.exit(code ?? 0);
  });
}

runElectron();
