/** Verifies domain behavior across all generations, forms, and defensive type combinations. */
import { expect, test } from 'vitest';
import {
  artworkUrl,
  damageMultipliers,
  filterPokemon,
  flavorText,
  generationLabel,
  resourceId,
} from '../../src/renderer/domain/pokemon';
import { generations, makePokemon, makeSpecies, makeType, resource } from '../fixtures/pokeapi';

/** Ensures alternate-form IDs are never derived from their position in the index. */
test('preserves alternate-form resource identifiers', function testFormIds() {
  expect(resourceId('https://pokeapi.co/api/v2/pokemon/10001/')).toBe(10001);
  /** Supplies a malformed identifier to the domain boundary. */
  function invalidId() {
    resourceId('https://pokeapi.co/api/v2/pokemon/not-an-id/');
  }
  expect(invalidId).toThrow('Invalid resource identifier');
});

/** Confirms search includes later generations and composes favorites with type membership. */
test('searches every generation and combines filters', function testFilters() {
  const entries = [
    { ...resource('pokemon', 25, 'pikachu'), id: 25 },
    { ...resource('pokemon', 906, 'sprigatito'), id: 906 },
    { ...resource('pokemon', 10001, 'deoxys-attack'), id: 10001 },
  ];
  const filters = {
    query: ' #0906 ',
    favoritesOnly: true,
    favorites: new Set([906]),
    typeIds: new Set([906]),
  };
  expect(filterPokemon(entries, filters)).toEqual([entries[1]]);
  expect(
    filterPokemon(entries, {
      ...filters,
      query: 'deoxys attack',
      favoritesOnly: false,
      typeIds: null,
    }),
  ).toEqual([entries[2]]);
  expect(filterPokemon(entries, { ...filters, typeIds: new Set([25]) })).toEqual([]);
});

/** Keeps immunities at zero regardless of the order in which dual types are combined. */
test('preserves immunities and computes quadruple damage', function testMultipliers() {
  const first = makeType('ground');
  first.damage_relations.no_damage_from.push(resource('type', 13, 'electric'));
  first.damage_relations.double_damage_from.push(resource('type', 12, 'grass'));
  const second = makeType('water');
  second.damage_relations.double_damage_from.push(
    resource('type', 13, 'electric'),
    resource('type', 12, 'grass'),
  );
  expect(damageMultipliers([first, second]).get('electric')).toBe(0);
  expect(damageMultipliers([second, first]).get('electric')).toBe(0);
  expect(damageMultipliers([first, second]).get('grass')).toBe(4);
});

/** Falls back to standard artwork and then the bundled image when shiny assets are missing. */
test('falls back safely when artwork is missing', function testArtwork() {
  const pokemon = makePokemon();
  pokemon.sprites = { front_default: null, front_shiny: null };
  expect(artworkUrl(pokemon, true)).toBe('./pokeball.png');
});

/** Formats documented generation and region fields while allowing metadata to be absent. */
test('formats API metadata without guessing generations', function testMetadata() {
  expect(generationLabel(generations[3] ?? null)).toBe('Generation IX · Paldea');
  expect(generationLabel(null, makeSpecies())).toBe('Generation I');
  expect(generationLabel(null)).toBe('');
  expect(flavorText(makeSpecies())).toBe('A friendly Pokémon with remarkable abilities.');
});
