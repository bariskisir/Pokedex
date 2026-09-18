/** Launches the actual desktop build to verify sandbox isolation and the preload bridge. */
import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mockApi } from './routes';

/** Verifies the real desktop process starts, stays isolated, and accepts scoped window controls. */
test('starts the packaged desktop with an isolated native bridge', async function testDesktop() {
  const userData = await mkdtemp(path.join(tmpdir(), 'pokedex-test-'));
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') environment[key] = value;
  }
  const app = await electron.launch({
    args: [
      path.resolve('dist/main/main.cjs'),
      `--user-data-dir=${userData}`,
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env: environment,
  });
  try {
    await mockApi(app.context());
    const page = await app.firstWindow();
    await page.waitForURL(/index\.html$/);
    await page.waitForLoadState('load');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Open Pokédex', exact: true })).toBeVisible();
    /** Reads the actual native dimensions to verify the physical window footprint. */
    function windowSize({ BrowserWindow }: typeof import('electron')) {
      return BrowserWindow.getAllWindows()[0]?.getSize();
    }
    const closedSize = await app.evaluate(windowSize);
    expect(closedSize?.[0]).toBe(440);
    expect(closedSize?.[1]).toBeLessThanOrEqual(680);
    /** Measures a safe height delta while treating unavailable native dimensions as a test failure. */
    function heightDifference(first: number | undefined, second: number | undefined): number {
      if (first === undefined || second === undefined) return Number.POSITIVE_INFINITY;
      return Math.abs(first - second);
    }
    await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
    await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
    const openSize = await app.evaluate(windowSize);
    expect(openSize?.[0]).toBe(812);
    expect(openSize?.[1]).toBeLessThanOrEqual(680);
    expect(heightDifference(openSize?.[1], closedSize?.[1])).toBeLessThanOrEqual(4);
    await expect(page.getByRole('heading', { name: 'pikachu', exact: true })).toBeVisible();
    /** Reads exposed bridge capabilities without importing privileged Electron APIs. */
    function inspectRenderer() {
      return {
        nodeAvailable: 'require' in window,
        minimize: typeof window.pokedex?.minimize,
        close: typeof window.pokedex?.close,
      };
    }
    expect(await page.evaluate(inspectRenderer)).toEqual({
      nodeAvailable: false,
      minimize: 'function',
      close: 'function',
    });
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      /script-src 'self';/,
    );
    await expect(page.getByRole('button', { name: 'Minimize window' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Pokédex', exact: true }).click();
    await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'closed');
    const restoredSize = await app.evaluate(windowSize);
    expect(restoredSize?.[0]).toBe(440);
    expect(restoredSize?.[1]).toBeLessThanOrEqual(680);
    expect(heightDifference(restoredSize?.[1], closedSize?.[1])).toBeLessThanOrEqual(4);
    const closed = page.waitForEvent('close');
    await page.getByRole('button', { name: 'Close window' }).click();
    await closed;
  } finally {
    if (app.process().exitCode === null) await app.close();
    await rm(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
