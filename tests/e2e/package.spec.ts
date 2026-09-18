/** Verifies that a real npm tarball works in a clean consumer without development dependencies. */
import { _electron as electron, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mockApi } from './routes';

/** Packs, installs, and starts the npm payload from an otherwise empty consumer directory. */
test('installs and launches the published package layout', async function testConsumerInstall() {
  test.setTimeout(120_000);
  const workspace = await mkdtemp(path.join(tmpdir(), 'pokedex-package-'));
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error('Run package integration tests through npm.');
  try {
    const packed = JSON.parse(
      execFileSync(
        process.execPath,
        [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', workspace],
        { encoding: 'utf8', timeout: 30_000 },
      ),
    ) as { filename: string }[];
    const filename = packed[0]?.filename;
    if (!filename) throw new Error('npm did not produce a package tarball.');
    const consumer = path.join(workspace, 'consumer');
    execFileSync(
      process.execPath,
      [
        npm,
        'install',
        '--prefix',
        consumer,
        '--omit=dev',
        '--no-audit',
        '--no-fund',
        path.join(workspace, filename),
      ],
      { timeout: 60_000, stdio: 'pipe' },
    );
    const packageRoot = path.join(consumer, 'node_modules', 'pokedex-electron');
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as {
      version: string;
      bin: Record<string, string>;
    };
    const sourceManifest = JSON.parse(await readFile(path.resolve('package.json'), 'utf8')) as {
      version: string;
    };
    expect(manifest.version).toBe(sourceManifest.version);
    expect(manifest.bin['pokedex-electron']).toBe('./dist/main/cli.cjs');
    const executablePath: unknown = createRequire(path.join(consumer, 'package.json'))('electron');
    if (typeof executablePath !== 'string')
      throw new Error('Installed Electron binary is unavailable.');
    const app = await electron.launch({
      executablePath,
      args: [
        packageRoot,
        `--user-data-dir=${path.join(workspace, 'profile')}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
    });
    try {
      await mockApi(app.context());
      const page = await app.firstWindow();
      await page.waitForURL(/index\.html$/);
      await page.waitForLoadState('load');
      await page.reload();
      await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
      await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
      await expect(page.getByRole('heading', { name: 'pikachu', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close window' })).toBeVisible();
    } finally {
      await app.close();
    }
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
