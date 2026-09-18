/** Validates the PokéAPI v2 fields consumed by the application at the network boundary. */
import { z } from 'zod';

export const resourceSchema = z.object({ name: z.string().min(1), url: z.url() });
const imageSchema = z.string().nullable();
export const resourceListSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.url().nullable(),
  results: z.array(resourceSchema),
});
export const pokemonSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  height: z.number().nonnegative(),
  weight: z.number().nonnegative(),
  species: resourceSchema,
  types: z.array(z.object({ slot: z.number(), type: resourceSchema })),
  abilities: z.array(z.object({ is_hidden: z.boolean(), ability: resourceSchema })),
  stats: z.array(z.object({ base_stat: z.number().nonnegative(), stat: resourceSchema })),
  moves: z.array(z.object({ move: resourceSchema })),
  sprites: z.object({
    front_default: imageSchema,
    front_shiny: imageSchema,
    other: z
      .object({
        'official-artwork': z.object({ front_default: imageSchema, front_shiny: imageSchema }),
      })
      .optional(),
  }),
  cries: z.object({ latest: imageSchema, legacy: imageSchema }).optional(),
});
export const speciesSchema = z.object({
  name: z.string(),
  generation: resourceSchema,
  flavor_text_entries: z.array(z.object({ flavor_text: z.string(), language: resourceSchema })),
  genera: z.array(z.object({ genus: z.string(), language: resourceSchema })),
  evolution_chain: z.object({ url: z.url() }).nullable(),
  varieties: z.array(z.object({ is_default: z.boolean(), pokemon: resourceSchema })),
});
export const typeSchema = z.object({
  name: z.string(),
  damage_relations: z.object({
    double_damage_from: z.array(resourceSchema),
    half_damage_from: z.array(resourceSchema),
    no_damage_from: z.array(resourceSchema),
  }),
  pokemon: z.array(z.object({ pokemon: resourceSchema })),
});

export interface EvolutionStage {
  species: z.infer<typeof resourceSchema>;
  evolves_to: EvolutionStage[];
}

export const evolutionStageSchema: z.ZodType<EvolutionStage> = z.lazy(getEvolutionStageSchema);

/** Defines a recursive schema without losing the evolution tree's branch structure. */
function getEvolutionStageSchema() {
  return z.object({ species: resourceSchema, evolves_to: z.array(evolutionStageSchema) });
}

export const evolutionSchema = z.object({ chain: evolutionStageSchema });
export const generationSchema = z.object({
  name: z.string(),
  main_region: resourceSchema,
  pokemon_species: z.array(resourceSchema),
});
export type NamedResource = z.infer<typeof resourceSchema>;
export type Pokemon = z.infer<typeof pokemonSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type PokemonType = z.infer<typeof typeSchema>;
export type Evolution = z.infer<typeof evolutionSchema>;
export type Generation = z.infer<typeof generationSchema>;

export interface PokemonDetails {
  pokemon: Pokemon;
  species: Species | null;
  types: PokemonType[];
  evolution: Evolution | null;
  warnings: string[];
  generation: Generation | null;
}
