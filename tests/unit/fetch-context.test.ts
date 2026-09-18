/** Guards against browser fetch failures caused by an incorrect native receiver. */
import { expect, test } from 'vitest';
import { PokeApiClient } from '../../src/renderer/api/client';
import { ResponseCache } from '../../src/renderer/services/storage';
import { makePokemon } from '../fixtures/pokeapi';

/** Requires native fetch to receive the global context rather than the API client instance. */
test('invokes browser fetch with its native global receiver', async function testFetchReceiver() {
  /** Simulates the receiver validation performed by native browser fetch. */
  async function nativeFetch(this: unknown): Promise<Response> {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return Response.json(makePokemon());
  }
  const api = new PokeApiClient(new ResponseCache(), nativeFetch);
  expect((await api.pokemon(25)).id).toBe(25);
});
