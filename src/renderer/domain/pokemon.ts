/** Contains pure transformations for search, artwork, species text, and type matchups. */
import type { Generation, NamedResource, Pokemon, PokemonType, Species } from '../api/schemas';

export interface PokemonEntry extends NamedResource {
  id: number;
}
export interface SearchFilters {
  query: string;
  favoritesOnly: boolean;
  favorites: ReadonlySet<number>;
  typeIds: ReadonlySet<number> | null;
}

/** Extracts the real resource identifier instead of deriving one from list position. */
export function resourceId(url: string): number {
  const match = /\/(\d+)\/?$/.exec(new URL(url).pathname);
  const id = Number(match?.[1]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid resource identifier: ${url}`);
  return id;
}

/** Converts API slugs into readable labels without changing their identifiers. */
export function displayName(name: string): string {
  return name.replaceAll('-', ' ');
}

/** Combines name or ID search with optional type and favorite filters. */
export function filterPokemon(
  entries: readonly PokemonEntry[],
  filters: SearchFilters,
): PokemonEntry[] {
  const query = filters.query.trim().toLowerCase().replaceAll(' ', '-').replace(/^#/, '');
  const matches: PokemonEntry[] = [];
  for (const entry of entries) {
    const matchesQuery = /^\d+$/.test(query)
      ? entry.id === Number(query)
      : entry.name.includes(query);
    if (
      matchesQuery &&
      (!filters.favoritesOnly || filters.favorites.has(entry.id)) &&
      (!filters.typeIds || filters.typeIds.has(entry.id))
    )
      matches.push(entry);
  }
  return matches;
}

/** Preserves immunities when combining defensive multipliers for dual types. */
export function damageMultipliers(types: readonly PokemonType[]): Map<string, number> {
  const multipliers = new Map<string, number>();
  for (const type of types) {
    const groups: [NamedResource[], number][] = [
      [type.damage_relations.double_damage_from, 2],
      [type.damage_relations.half_damage_from, 0.5],
      [type.damage_relations.no_damage_from, 0],
    ];
    for (const [resources, multiplier] of groups) {
      for (const resource of resources)
        multipliers.set(resource.name, (multipliers.get(resource.name) ?? 1) * multiplier);
    }
  }
  return multipliers;
}

/** Selects available official artwork, then sprites, then the bundled fallback. */
export function artworkUrl(pokemon: Pokemon, shiny: boolean): string {
  const artwork = pokemon.sprites.other?.['official-artwork'];
  if (shiny)
    return artwork?.front_shiny ?? pokemon.sprites.front_shiny ?? artworkUrl(pokemon, false);
  return artwork?.front_default ?? pokemon.sprites.front_default ?? './pokeball.png';
}

/** Chooses English flavor text and removes control characters used by the games. */
export function flavorText(species: Species | null): string {
  for (const entry of species?.flavor_text_entries ?? []) {
    if (entry.language.name === 'en')
      return entry.flavor_text
        .replace(/[\n\f\r]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
  }
  return 'No English description is available for this Pokémon.';
}

/** Selects an English species classification when the API provides one. */
export function genus(species: Species | null): string {
  for (const entry of species?.genera ?? []) if (entry.language.name === 'en') return entry.genus;
  return 'Pokémon';
}

/** Formats the API's generation slug and optional canonical region as readable metadata. */
export function generationLabel(
  generation: Generation | null,
  species: Species | null = null,
): string {
  const name = generation?.name ?? species?.generation.name;
  if (!name) return '';
  const label = name
    .replace('generation-', 'Generation ')
    .toUpperCase()
    .replace('GENERATION', 'Generation');
  if (!generation) return label;
  const region = generation.main_region.name;
  return `${label} · ${region.charAt(0).toUpperCase()}${region.slice(1)}`;
}
