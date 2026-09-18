/** Coordinates independent catalog, filter, and detail requests without stale UI updates. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PokeApiClient } from '../api/client';
import { resourceListSchema, type NamedResource, type PokemonDetails } from '../api/schemas';
import { filterPokemon, generationLabel, resourceId, type PokemonEntry } from '../domain/pokemon';
import { browserStorage, Preferences, ResponseCache } from '../services/storage';

const storage = browserStorage();
const preferences = new Preferences(storage);
const api = new PokeApiClient(new ResponseCache(storage));

/** Converts unknown failures into a stable message for accessible status regions. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred. Please retry.';
}

/** Loads all generations and exposes focused actions for the presentation components. */
export function usePokedex() {
  const [entries, setEntries] = useState<PokemonEntry[]>([]);
  const [types, setTypes] = useState<NamedResource[]>([]);
  const [generations, setGenerations] = useState(new Map<string, string>());
  const [favorites, setFavorites] = useState(loadFavorites);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [typeName, setTypeName] = useState('');
  const [typeIds, setTypeIds] = useState<Set<number> | null>(null);
  const [indexError, setIndexError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [indexLoading, setIndexLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [details, setDetails] = useState<PokemonDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [selected, setSelected] = useState<number | string>(25);
  const [speciesTarget, setSpeciesTarget] = useState<NamedResource | null>(null);
  const [indexRevision, setIndexRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);
  const [filterRevision, setFilterRevision] = useState(0);
  const [notice, setNotice] = useState('Ready for your next discovery.');
  const favoriteRef = useRef(favorites);

  /** Restores favorites once when the controller is mounted. */
  function loadFavorites(): Set<number> {
    return preferences.favorites();
  }

  /** Fetches the complete paginated index without blocking Pokémon detail requests. */
  useEffect(
    function loadIndex() {
      const controller = new AbortController();
      setIndexLoading(true);
      setIndexError('');
      /** Commits index results only while this effect owns the active request. */
      async function run(): Promise<void> {
        try {
          const data = await api.index(controller.signal);
          if (!controller.signal.aborted) setEntries(data);
        } catch (error) {
          if (!controller.signal.aborted) setIndexError(errorMessage(error));
        } finally {
          if (!controller.signal.aborted) setIndexLoading(false);
        }
      }
      void run();
      /** Cancels the previous index request on retry or unmount. */
      return function cleanup() {
        controller.abort();
      };
    },
    [indexRevision],
  );

  /** Loads optional generation labels and the current type catalog independently. */
  useEffect(
    function loadMetadata() {
      const controller = new AbortController();
      /** Associates each species with its API-provided generation and main region. */
      async function loadGenerations(): Promise<void> {
        try {
          const data = await api.generations(controller.signal);
          const labels = new Map<string, string>();
          for (const generation of data)
            for (const species of generation.pokemon_species)
              labels.set(species.name, generationLabel(generation));
          if (!controller.signal.aborted) setGenerations(labels);
        } catch {
          /* Optional labels remain absent when the metadata service is unavailable. */
        }
      }
      /** Populates the type selector from the API instead of hardcoding type names. */
      async function loadTypes(): Promise<void> {
        try {
          const data = await api.request('type?limit=100', resourceListSchema, controller.signal);
          if (!controller.signal.aborted) setTypes(data.results);
        } catch {
          /* Profile type badges still support filtering when the type index is unavailable. */
        }
      }
      void loadGenerations();
      void loadTypes();
      /** Aborts metadata work when the application unmounts or the archive is retried. */
      return function cleanup() {
        controller.abort();
      };
    },
    [indexRevision],
  );

  /** Replaces detail requests atomically when selection changes or a retry is requested. */
  useEffect(
    function loadDetails() {
      const controller = new AbortController();
      setDetailLoading(true);
      setDetailError('');
      setDetails(null);
      /** Resolves evolution species to default forms and fetches the selected profile. */
      async function run(): Promise<void> {
        try {
          const target = speciesTarget
            ? await api.defaultVariety(speciesTarget, controller.signal)
            : selected;
          const data = await api.details(target, controller.signal);
          if (!controller.signal.aborted) setDetails(data);
        } catch (error) {
          if (!controller.signal.aborted) setDetailError(errorMessage(error));
        } finally {
          if (!controller.signal.aborted) setDetailLoading(false);
        }
      }
      void run();
      /** Prevents earlier selections from replacing the newest Pokémon profile. */
      return function cleanup() {
        controller.abort();
      };
    },
    [selected, speciesTarget, detailRevision],
  );

  /** Recomputes type membership independently of the selected Pokémon. */
  useEffect(
    function loadTypeFilter() {
      const controller = new AbortController();
      setFilterError('');
      setTypeIds(typeName ? new Set() : null);
      setFilterLoading(Boolean(typeName));
      /** Resolves member IDs and ignores superseded filter responses. */
      async function run(): Promise<void> {
        if (!typeName) return;
        try {
          const data = await api.type(typeName, controller.signal);
          const ids = new Set<number>();
          for (const entry of data.pokemon) ids.add(resourceId(entry.pokemon.url));
          if (!controller.signal.aborted) setTypeIds(ids);
        } catch (error) {
          if (!controller.signal.aborted) setFilterError(errorMessage(error));
        } finally {
          if (!controller.signal.aborted) setFilterLoading(false);
        }
      }
      void run();
      /** Cancels requests for filters that the user has already changed. */
      return function cleanup() {
        controller.abort();
      };
    },
    [typeName, filterRevision],
  );

  /** Selects a Pokémon and clears a previous evolution-species selection. */
  function selectPokemon(id: number): void {
    setSpeciesTarget(null);
    setSelected(id);
  }
  /** Follows an evolution link through the species' default form. */
  function selectSpecies(species: NamedResource): void {
    setSpeciesTarget(species);
  }
  /** Changes the search text used to filter the complete archive. */
  function search(value: string): void {
    setQuery(value);
  }
  /** Changes the active type filter. */
  function selectType(name: string): void {
    setTypeName(name);
  }
  /** Toggles the persisted favorites filter without changing the active profile. */
  function toggleFavoritesOnly(): void {
    setFavoritesOnly(!favoritesOnly);
  }
  /** Clears all filters and restores the full national archive. */
  function resetFilters(): void {
    setQuery('');
    setTypeName('');
    setFavoritesOnly(false);
  }
  /** Restarts catalog and optional metadata loading after a failure. */
  function retryIndex(): void {
    setIndexRevision(indexRevision + 1);
  }
  /** Restarts the selected Pokémon request after a failure or partial response. */
  function retryDetails(): void {
    setDetailRevision(detailRevision + 1);
  }
  /** Restarts type membership loading after a failure. */
  function retryFilter(): void {
    setFilterRevision(filterRevision + 1);
  }
  /** Saves favorite changes while retaining session state if disk storage is unavailable. */
  function toggleFavorite(): void {
    if (!details) return;
    const next = new Set(favoriteRef.current);
    const id = details.pokemon.id;
    if (next.has(id)) next.delete(id);
    else next.add(id);
    favoriteRef.current = next;
    setFavorites(next);
    setNotice(
      preferences.saveFavorites(next)
        ? 'Ready for your next discovery.'
        : 'Favorites are available for this session; local storage is unavailable.',
    );
  }

  /** Supplies a stable notice callback to media components with cleanup effects. */
  const notify = useCallback(function notify(message: string): void {
    setNotice(message);
  }, []);
  const labels = new Map(generations);
  if (details) {
    const label = generationLabel(details.generation, details.species);
    if (label) labels.set(details.pokemon.name, label);
  }
  const filtered = filterPokemon(entries, { query, favoritesOnly, favorites, typeIds });
  const currentId =
    details?.pokemon.id ?? (typeof selected === 'number' && !speciesTarget ? selected : null);
  let currentIndex = -1;
  for (let index = 0; index < filtered.length; index++)
    if (filtered[index]?.id === currentId) currentIndex = index;
  const previousId = currentIndex > 0 ? filtered[currentIndex - 1]?.id : undefined;
  const nextId = currentIndex >= 0 ? filtered[currentIndex + 1]?.id : undefined;

  return {
    entries: filtered,
    types,
    generations: labels,
    favorites,
    favoritesOnly,
    query,
    typeName,
    indexError,
    filterError,
    detailError,
    indexLoading,
    filterLoading,
    details,
    detailLoading,
    notice,
    currentId,
    previousId,
    nextId,
    selectPokemon,
    selectSpecies,
    search,
    selectType,
    toggleFavoritesOnly,
    resetFilters,
    retryIndex,
    retryDetails,
    retryFilter,
    toggleFavorite,
    notify,
  };
}

export type PokedexController = ReturnType<typeof usePokedex>;
