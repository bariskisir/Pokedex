/** Supplies representative API fixtures spanning generations, alternate forms, and evolutions. */
import type {
  Evolution,
  Generation,
  NamedResource,
  Pokemon,
  PokemonType,
  Species,
} from '../../src/renderer/api/schemas';

/** Creates a canonical API reference for a named fixture resource. */
export function resource(endpoint: string, id: number, name: string): NamedResource {
  return { name, url: `https://pokeapi.co/api/v2/${endpoint}/${id}/` };
}

/** Builds a complete minimal Pokémon response with overridable identity and species. */
export function makePokemon(
  id = 25,
  name = 'pikachu',
  speciesId = id,
  speciesName = name,
): Pokemon {
  const type =
    id === 906 || id === 1 ? resource('type', 12, 'grass') : resource('type', 13, 'electric');
  return {
    id,
    name,
    height: 4,
    weight: 60,
    species: resource('pokemon-species', speciesId, speciesName),
    types: [{ slot: 1, type }],
    abilities: [{ is_hidden: false, ability: resource('ability', 9, 'static') }],
    stats: [
      { base_stat: 35, stat: resource('stat', 1, 'hp') },
      { base_stat: 90, stat: resource('stat', 6, 'speed') },
    ],
    moves: [{ move: resource('move', 85, 'thunderbolt') }],
    sprites: {
      front_default: './pokeball.png',
      front_shiny: './pokeball.png?shiny',
      other: {
        'official-artwork': {
          front_default: './pokeball.png',
          front_shiny: './pokeball.png?shiny',
        },
      },
    },
    cries: { latest: null, legacy: null },
  };
}

/** Creates a species fixture with English metadata and its default variety. */
export function makeSpecies(
  id = 25,
  name = 'pikachu',
  generation = 1,
  regionName = 'generation-i',
  variety = name,
): Species {
  return {
    name,
    generation: resource('generation', generation, regionName),
    flavor_text_entries: [
      {
        flavor_text: 'A friendly\nPokémon\fwith remarkable abilities.',
        language: resource('language', 9, 'en'),
      },
    ],
    genera: [{ genus: 'Mouse Pokémon', language: resource('language', 9, 'en') }],
    evolution_chain: { url: `https://pokeapi.co/api/v2/evolution-chain/${id}/` },
    varieties: [{ is_default: true, pokemon: resource('pokemon', id, variety) }],
  };
}

/** Creates a defensive type fixture with explicit empty relationships. */
export function makeType(name = 'electric'): PokemonType {
  return {
    name,
    damage_relations: { double_damage_from: [], half_damage_from: [], no_damage_from: [] },
    pokemon: [],
  };
}

const pokemon = [
  makePokemon(1, 'bulbasaur'),
  makePokemon(),
  makePokemon(26, 'raichu'),
  makePokemon(172, 'pichu'),
  makePokemon(386, 'deoxys-normal', 386, 'deoxys'),
  makePokemon(906, 'sprigatito'),
  makePokemon(10001, 'deoxys-attack', 386, 'deoxys'),
];
const species = [
  makeSpecies(1, 'bulbasaur'),
  makeSpecies(),
  makeSpecies(26, 'raichu'),
  makeSpecies(172, 'pichu', 2, 'generation-ii'),
  makeSpecies(386, 'deoxys', 3, 'generation-iii', 'deoxys-normal'),
  makeSpecies(906, 'sprigatito', 9, 'generation-ix'),
];
export const generations: Generation[] = [
  {
    name: 'generation-i',
    main_region: resource('region', 1, 'kanto'),
    pokemon_species: [
      resource('pokemon-species', 1, 'bulbasaur'),
      resource('pokemon-species', 25, 'pikachu'),
      resource('pokemon-species', 26, 'raichu'),
    ],
  },
  {
    name: 'generation-ii',
    main_region: resource('region', 2, 'johto'),
    pokemon_species: [resource('pokemon-species', 172, 'pichu')],
  },
  {
    name: 'generation-iii',
    main_region: resource('region', 3, 'hoenn'),
    pokemon_species: [resource('pokemon-species', 386, 'deoxys')],
  },
  {
    name: 'generation-ix',
    main_region: resource('region', 10, 'paldea'),
    pokemon_species: [resource('pokemon-species', 906, 'sprigatito')],
  },
];
export const branchingEvolution: Evolution = {
  chain: {
    species: resource('pokemon-species', 133, 'eevee'),
    evolves_to: [
      { species: resource('pokemon-species', 134, 'vaporeon'), evolves_to: [] },
      { species: resource('pokemon-species', 135, 'jolteon'), evolves_to: [] },
    ],
  },
};

/** Returns fixture responses by URL, including generation and species-to-variety metadata. */
export function fixtureResponse(url: string): unknown {
  const parsed = new URL(url);
  const parts = parsed.pathname.split('/').filter(Boolean);
  const endpoint = parts[2];
  const id = parts[3];
  if (endpoint === 'pokemon' && !id) {
    const results = [];
    for (const entry of pokemon) results.push(resource('pokemon', entry.id, entry.name));
    return { count: results.length, next: null, results };
  }
  if (endpoint === 'pokemon')
    for (const entry of pokemon) if (id === String(entry.id) || id === entry.name) return entry;
  if (endpoint === 'pokemon-species')
    for (const entry of species)
      if (entry.varieties[0]?.pokemon.url.endsWith(`/${id}/`) || entry.name === id) return entry;
  if (endpoint === 'type' && !id)
    return {
      count: 2,
      next: null,
      results: [resource('type', 12, 'grass'), resource('type', 13, 'electric')],
    };
  if (endpoint === 'type') {
    const name = id === '12' || id === 'grass' ? 'grass' : 'electric';
    const type = makeType(name);
    for (const entry of pokemon)
      if (entry.types[0]?.type.name === name)
        type.pokemon.push({ pokemon: resource('pokemon', entry.id, entry.name) });
    return type;
  }
  if (endpoint === 'generation' && !id)
    return {
      count: 4,
      next: null,
      results: [
        resource('generation', 1, 'generation-i'),
        resource('generation', 2, 'generation-ii'),
        resource('generation', 3, 'generation-iii'),
        resource('generation', 9, 'generation-ix'),
      ],
    };
  if (endpoint === 'generation') {
    const index = { '1': 0, '2': 1, '3': 2, '9': 3 }[id ?? ''];
    if (index !== undefined) return generations[index];
  }
  if (endpoint === 'evolution-chain') {
    for (const entry of species)
      if (entry.evolution_chain?.url.endsWith(`/${id}/`))
        return {
          chain: { species: resource('pokemon-species', Number(id), entry.name), evolves_to: [] },
        };
  }
  return undefined;
}
