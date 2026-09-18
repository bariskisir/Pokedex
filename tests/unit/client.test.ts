/** Exercises API validation, cancellation, pagination, caching, and partial-data recovery. */
import { expect, test, vi } from 'vitest';
import { apiUrl, PokeApiClient } from '../../src/renderer/api/client';
import { pokemonSchema } from '../../src/renderer/api/schemas';
import { ResponseCache } from '../../src/renderer/services/storage';
import { fixtureResponse, makePokemon, resource } from '../fixtures/pokeapi';

/** Returns fixture responses using the same fetch contract as the real API client. */
async function fixtureFetch(input: string | URL | Request): Promise<Response> {
  const body = fixtureResponse(String(input));
  return Response.json(body ?? {}, { status: body === undefined ? 404 : 200 });
}

/** Ensures cached resources avoid repeated HTTP requests while honoring pre-aborted signals. */
test('caches validated responses and respects cancellation', async function testCachedRequests() {
  const fetcher = vi.fn(fixtureFetch);
  const api = new PokeApiClient(new ResponseCache(), fetcher);
  expect((await api.pokemon(25)).name).toBe('pikachu');
  await api.pokemon(25);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const controller = new AbortController();
  controller.abort();
  await expect(api.pokemon(25, controller.signal)).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

/** Prevents API references from sending requests outside the documented service origin. */
test('rejects untrusted links', function testOriginPolicy() {
  for (const url of [
    'https://example.com/api/v2/pokemon/25/',
    'http://pokeapi.co/api/v2/pokemon/25/',
    'https://pokeapi.co/private',
  ]) {
    /** Attempts to resolve an untrusted API reference. */
    function resolve() {
      apiUrl(url);
    }
    expect(resolve).toThrow('untrusted');
  }
});

/** Rejects malformed payloads and failed HTTP statuses instead of caching them. */
test('reports HTTP and schema errors', async function testResponseValidation() {
  /** Returns a success status with an invalid response body. */
  async function malformed(): Promise<Response> {
    return Response.json({ name: 'missing-fields' });
  }
  /** Simulates a service outage. */
  async function unavailable(): Promise<Response> {
    return new Response(null, { status: 503 });
  }
  await expect(new PokeApiClient(new ResponseCache(), malformed).pokemon(25)).rejects.toThrow(
    'unexpected response',
  );
  await expect(new PokeApiClient(new ResponseCache(), unavailable).pokemon(25)).rejects.toThrow(
    'HTTP 503',
  );
});

/** Follows subsequent index pages and retains later-generation and alternate-form IDs. */
test('follows pagination without a generation limit', async function testPagination() {
  /** Returns two pages with noncontiguous resource identifiers. */
  async function paginated(input: string | URL | Request): Promise<Response> {
    const second = String(input).includes('offset=1');
    return Response.json({
      count: 2,
      next: second ? null : 'https://pokeapi.co/api/v2/pokemon?offset=1',
      results: [
        second
          ? resource('pokemon', 10001, 'deoxys-attack')
          : resource('pokemon', 906, 'sprigatito'),
      ],
    });
  }
  const entries = await new PokeApiClient(new ResponseCache(), paginated).index();
  expect(entries[0]?.id).toBe(906);
  expect(entries[1]?.id).toBe(10001);
});

/** Keeps a usable profile if supplemental endpoints fail and resolves alternate species slugs. */
test('supports partial profiles and species default varieties', async function testSupplementalData() {
  /** Supplies only core Pokémon data to simulate independent supplemental failures. */
  async function partial(input: string | URL | Request): Promise<Response> {
    return String(input).includes('/pokemon/25/')
      ? Response.json(makePokemon())
      : new Response(null, { status: 503 });
  }
  const details = await new PokeApiClient(new ResponseCache(), partial).details(25);
  expect(details.pokemon.id).toBe(25);
  expect(details.species).toBeNull();
  expect(details.warnings).toHaveLength(2);
  const api = new PokeApiClient(new ResponseCache(), fixtureFetch);
  expect(await api.defaultVariety(resource('pokemon-species', 386, 'deoxys'))).toBe(
    'deoxys-normal',
  );
  expect((await api.details(906)).generation?.main_region.name).toBe('paldea');
});

/** Confirms malformed cached values are revalidated before reuse. */
test('refetches corrupted cached data', async function testCacheValidation() {
  const cache = new ResponseCache();
  cache.set(apiUrl('pokemon/25/'), { id: 'invalid' });
  const api = new PokeApiClient(cache, fixtureFetch);
  expect(pokemonSchema.safeParse(await api.pokemon(25)).success).toBe(true);
});
