/** Fetches and validates PokéAPI resources with caching, cancellation, and request deadlines. */
import type { z } from 'zod';
import {
  evolutionSchema,
  generationSchema,
  pokemonSchema,
  resourceListSchema,
  speciesSchema,
  typeSchema,
} from './schemas';
import type { Generation, NamedResource, Pokemon, PokemonDetails, PokemonType } from './schemas';
import { resourceId, type PokemonEntry } from '../domain/pokemon';
import { ResponseCache } from '../services/storage';

const API_BASE = 'https://pokeapi.co/api/v2/';

export class ApiError extends Error {
  /** Gives callers a readable failure message while retaining an optional HTTP status. */
  public constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Restricts API-provided links to the documented HTTPS API origin and path. */
export function apiUrl(resource: string): string {
  const url = new URL(resource, API_BASE);
  if (
    url.origin !== 'https://pokeapi.co' ||
    !url.pathname.startsWith('/api/v2/') ||
    url.username ||
    url.password
  )
    throw new ApiError('The API returned an untrusted resource URL.');
  url.hash = '';
  return url.href;
}

export class PokeApiClient {
  private readonly cache: ResponseCache;
  private readonly fetcher: typeof fetch;

  /** Allows deterministic tests and optional persistent caching without global state. */
  public constructor(cache = new ResponseCache(), fetcher: typeof fetch = fetch) {
    this.cache = cache;
    this.fetcher = fetcher.bind(globalThis);
  }

  /** Reads a validated resource, honoring cancellation even when the response is cached. */
  public async request<T>(
    resource: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    const url = apiUrl(resource);
    const cached = schema.safeParse(this.cache.get(url));
    if (cached.success) return cached.data;
    const timeout = AbortSignal.timeout(15_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await this.fetcher(url, {
        signal: requestSignal,
        headers: { Accept: 'application/json' },
        redirect: 'error',
      });
      if (!response.ok)
        throw new ApiError(
          response.status === 404
            ? 'This Pokémon could not be found.'
            : `PokéAPI is unavailable (HTTP ${response.status}). Please retry.`,
          response.status,
        );
      const data = schema.safeParse(await response.json());
      if (!data.success)
        throw new ApiError('PokéAPI returned an unexpected response. Please retry.');
      requestSignal.throwIfAborted();
      this.cache.set(url, data.data);
      return data.data;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (timeout.aborted) throw new ApiError('The request timed out. Please retry.');
      if (error instanceof ApiError) throw error;
      throw new ApiError('Unable to reach PokéAPI. Check your connection and retry.');
    }
  }

  /** Follows pagination links and preserves real IDs for alternate Pokémon forms. */
  public async index(signal?: AbortSignal): Promise<PokemonEntry[]> {
    const entries = new Map<number, PokemonEntry>();
    const visited = new Set<string>();
    let next: string | null = 'pokemon?limit=2000';
    while (next) {
      const url = apiUrl(next);
      if (visited.has(url)) throw new ApiError('PokéAPI returned a repeated index page.');
      visited.add(url);
      const page = await this.request(url, resourceListSchema, signal);
      for (const resource of page.results) {
        const id = resourceId(resource.url);
        entries.set(id, { ...resource, id });
      }
      next = page.next;
    }
    return [...entries.values()];
  }

  /** Loads one Pokémon by its API identifier or slug. */
  public pokemon(id: number | string, signal?: AbortSignal): Promise<Pokemon> {
    return this.request(`pokemon/${encodeURIComponent(id)}/`, pokemonSchema, signal);
  }

  /** Retrieves a type's defensive relationships and Pokémon membership. */
  public type(name: string, signal?: AbortSignal): Promise<PokemonType> {
    return this.request(`type/${encodeURIComponent(name)}/`, typeSchema, signal);
  }

  /** Retrieves generation labels in a small batch instead of requesting every species. */
  public async generations(signal?: AbortSignal): Promise<Generation[]> {
    const list = await this.request('generation?limit=100', resourceListSchema, signal);
    const requests: Promise<Generation>[] = [];
    for (const resource of list.results)
      requests.push(this.request(resource.url, generationSchema, signal));
    const results = await Promise.allSettled(requests);
    signal?.throwIfAborted();
    const generations: Generation[] = [];
    for (const result of results) if (result.status === 'fulfilled') generations.push(result.value);
    return generations;
  }

  /** Resolves a species to its default Pokémon form, including mismatched species slugs. */
  public async defaultVariety(species: NamedResource, signal?: AbortSignal): Promise<string> {
    const data = await this.request(species.url, speciesSchema, signal);
    for (const variety of data.varieties) if (variety.is_default) return variety.pokemon.name;
    throw new ApiError('No default Pokémon form is available for this species.');
  }

  /** Loads details while allowing unavailable supplemental sections to degrade gracefully. */
  public async details(id: number | string, signal?: AbortSignal): Promise<PokemonDetails> {
    const pokemon = await this.pokemon(id, signal);
    const typeRequests: Promise<PokemonType>[] = [];
    for (const slot of pokemon.types)
      typeRequests.push(this.request(slot.type.url, typeSchema, signal));
    const [speciesResult, typesResult] = await Promise.allSettled([
      this.request(pokemon.species.url, speciesSchema, signal),
      Promise.all(typeRequests),
    ]);
    signal?.throwIfAborted();
    const details: PokemonDetails = {
      pokemon,
      species: null,
      types: [],
      evolution: null,
      generation: null,
      warnings: [],
    };
    if (speciesResult.status === 'fulfilled') details.species = speciesResult.value;
    else details.warnings.push('Species details are temporarily unavailable.');
    if (typesResult.status === 'fulfilled') details.types = typesResult.value;
    else details.warnings.push('Type matchups are temporarily unavailable.');
    if (details.species) {
      try {
        details.generation = await this.request(
          details.species.generation.url,
          generationSchema,
          signal,
        );
      } catch {
        signal?.throwIfAborted(); /* Generation labels are optional supplemental metadata. */
      }
    }
    if (details.species?.evolution_chain) {
      try {
        details.evolution = await this.request(
          details.species.evolution_chain.url,
          evolutionSchema,
          signal,
        );
      } catch {
        signal?.throwIfAborted();
        details.warnings.push('Evolution details are temporarily unavailable.');
      }
    }
    return details;
  }
}
