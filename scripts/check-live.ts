/** Checks the real PokéAPI integration in Chromium and captures diagnostic screenshots. */
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', reportRendererError);
  page.on('requestfailed', reportRequestFailure);
  await page.goto(process.env.POKEDEX_URL ?? 'http://127.0.0.1:5173');
  await page.screenshot({ path: 'test-results/live-closed.png' });
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('heading', { name: 'pikachu', exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('.generation-label')).toContainText('Generation I');
  const list = page.getByRole('list', { name: 'Pokémon results' });
  for (const [id, name, generation] of [
    ['906', 'sprigatito', 'Generation IX'],
    ['10001', 'deoxys attack', 'Generation III'],
  ]) {
    if (!id || !name || !generation) throw new Error('Incomplete live test case.');
    await page.getByRole('searchbox').fill(`#${id}`);
    await expect(list.getByRole('button')).toHaveCount(1, { timeout: 30_000 });
    await list.getByRole('button').click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.generation-label')).toContainText(generation);
    console.log(`Live API verified: #${id} ${name}, ${generation}.`);
  }
  await page.getByRole('searchbox').fill('#25');
  await list.getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'pikachu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.list-meta')).toContainText(/\d.*Pokémon/);
  console.log(`Live archive: ${await page.locator('.list-meta').innerText()}`);
  await page.locator('.artwork-stage img').evaluate(waitForImage);
  await page.screenshot({
    path: 'test-results/live-api.png',
  });
} finally {
  await browser.close();
}

/** Fails visibly when the renderer raises an uncaught exception during a live check. */
function reportRendererError(error: Error): void {
  console.error(error);
  process.exitCode = 1;
}

/** Reports network failures with their original browser reason for actionable diagnostics. */
function reportRequestFailure(request: import('@playwright/test').Request): void {
  if (request.failure()?.errorText !== 'net::ERR_ABORTED')
    console.error(`${request.url()}: ${request.failure()?.errorText}`);
}

/** Waits for artwork decoding before capturing a documentation screenshot. */
async function waitForImage(element: HTMLElement | SVGElement): Promise<void> {
  if (element instanceof HTMLImageElement) await element.decode();
}
