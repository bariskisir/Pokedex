#!/usr/bin/env node
/** Launches the installed Electron application and propagates failures to the calling shell. */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const loadDependency = createRequire(__filename);

/** Launches the packaged main entrypoint without forwarding arbitrary Electron switches. */
function launch(): void {
  const electronPath: unknown = loadDependency('electron');
  if (typeof electronPath !== 'string')
    throw new Error(
      'The Electron executable is unavailable. Reinstall pokedex-electron with install scripts enabled.',
    );
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath, [path.join(__dirname, 'main.cjs')], {
    stdio: 'inherit',
    env: environment,
  });
  child.once('error', handleError);
  child.once('exit', handleExit);
  process.once('SIGINT', stopChild);
  process.once('SIGTERM', stopChild);

  /** Terminates the owned desktop process when the launcher receives a shutdown signal. */
  function stopChild(): void {
    child.kill('SIGTERM');
  }
}

/** Exits with the Electron process's status or a nonzero status after a signal. */
function handleExit(code: number | null, signal: NodeJS.Signals | null): void {
  process.exit(code ?? (signal ? 1 : 0));
}

/** Prints a concise actionable launch failure without swallowing the exit status. */
function handleError(error: unknown): void {
  console.error(
    `Unable to launch Pokédex: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}

try {
  launch();
} catch (error) {
  handleError(error);
}
