/** Installs deterministic network fixtures without allowing tests to depend on the public API. */
import type { BrowserContext, Route } from '@playwright/test';
import { fixtureResponse } from '../fixtures/pokeapi';

/** Fulfills one API request or explicitly fails an unknown fixture URL. */
async function routeApi(route: Route): Promise<void> {
  const body = fixtureResponse(route.request().url());
  await route.fulfill({
    status: body === undefined ? 404 : 200,
    json: body ?? { error: 'Unknown fixture' },
  });
}

/** Prevents remote image or audio requests during deterministic test runs. */
async function blockRemoteMedia(route: Route): Promise<void> {
  await route.abort();
}

/** Registers API and media handlers before any application document is loaded. */
export async function mockApi(context: BrowserContext): Promise<void> {
  await context.route('https://pokeapi.co/api/v2/**', routeApi);
  await context.route('https://raw.githubusercontent.com/**', blockRemoteMedia);
}
