/** Exercises the built React application through its public browser interactions. */
import { expect, test } from '@playwright/test';
import { mockApi } from './routes';

/** Prepares deterministic API responses and opens the production renderer. */
test.beforeEach(async function prepare({ context, page }) {
  await mockApi(context);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('heading', { name: 'pikachu', exact: true })).toBeVisible();
});

/** Confirms later generations and alternate forms are searchable with accurate identity labels. */
test('browses every generation and alternate forms', async function browseAllGenerations({ page }) {
  const list = page.getByRole('list', { name: 'Pokémon results' });
  await expect(
    list.getByRole('button', { name: /sprigatito.*Generation IX.*Paldea/ }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('#906');
  await expect(list.getByRole('button')).toHaveCount(1);
  await list.getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'sprigatito', exact: true })).toBeVisible();
  await expect(page.locator('.generation-label')).toHaveText('Generation IX · Paldea');
  await page.getByRole('searchbox').fill('deoxys attack');
  await list.getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'deoxys attack' })).toBeVisible();
  await expect(page.locator('.entry-number')).toHaveText('#10001');
  await expect(page.locator('.generation-label')).toHaveText('Generation III · Hoenn');
  await page.getByRole('tab', { name: 'EVOLUTION', exact: true }).click();
  await page
    .locator('.evolution-tree')
    .getByRole('button', { name: 'deoxys', exact: true })
    .click();
  await page.getByRole('tab', { name: 'INFO', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'deoxys normal' })).toBeVisible();
});

/** Verifies favorite persistence, combined filtering, and shiny artwork controls. */
test('persists favorites and supports search and artwork controls', async function testControls({
  page,
}) {
  await page.getByRole('button', { name: 'Add to favorites' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
  await page.getByRole('button', { name: '☆ Favorites', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Pokémon results' }).getByRole('button')).toHaveCount(
    1,
  );
  await page.getByRole('combobox', { name: 'Filter by type' }).selectOption('grass');
  await expect(page.getByText('No Pokémon match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: '✧ Shiny' }).click();
  await expect(page.getByRole('img', { name: 'Shiny pikachu' })).toHaveAttribute('src', /shiny/);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
  await expect(page.locator('kbd')).toHaveCount(0);
  await page.getByRole('searchbox').fill('definitely-not-a-pokemon');
  await expect(page.getByText('No Pokémon match these filters.')).toBeVisible();
});

/** Provides a usable retry when a Pokémon request fails without losing the searchable catalog. */
test('recovers after a failed detail request', async function testRetry({ page, context }) {
  /** Overrides a Pokémon response to simulate a temporary upstream outage. */
  async function fail(route: import('@playwright/test').Route) {
    await route.fulfill({ status: 503 });
  }
  await context.route('**/pokemon/906/', fail);
  await page.getByRole('searchbox').fill('sprigatito');
  await page.getByRole('list', { name: 'Pokémon results' }).getByRole('button').click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await context.unroute('**/pokemon/906/', fail);
  await page.getByRole('button', { name: 'Retry Pokémon' }).click();
  await expect(page.getByRole('heading', { name: 'sprigatito' })).toBeVisible();
});

/** Holds an older request in flight and verifies a newer selection remains visible. */
test('does not render stale detail responses', async function testSelectionRace({ page, context }) {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(captureRelease);
  /** Captures the resolver used to release the intentionally delayed response. */
  function captureRelease(resolve: () => void): void {
    release = resolve;
  }
  /** Delays the older request until after the newer profile has finished loading. */
  async function delay(route: import('@playwright/test').Route) {
    await gate;
    await route.fallback();
  }
  await context.route('**/pokemon/1/', delay);
  const list = page.getByRole('list', { name: 'Pokémon results' });
  await list.getByRole('button', { name: /bulbasaur/ }).click();
  await list.getByRole('button', { name: /sprigatito/ }).click();
  await expect(page.getByRole('heading', { name: 'sprigatito' })).toBeVisible();
  release?.();
  await expect(page.getByRole('heading', { name: 'sprigatito' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'bulbasaur' })).toHaveCount(0);
});

/** Keeps the responsive layout within the viewport and reports no renderer exceptions. */
test('renders at desktop and mobile sizes', async function testResponsiveLayout({ page }) {
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  /** Measures whether the responsive page overflows horizontally. */
  function hasHorizontalOverflow(): boolean {
    return document.documentElement.scrollWidth > window.innerWidth;
  }
  expect(await page.evaluate(hasHorizontalOverflow)).toBe(false);
  await page.getByRole('heading', { name: 'pikachu', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'pikachu', exact: true })).toBeVisible();
});
