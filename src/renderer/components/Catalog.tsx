/** Renders searchable national results, generation metadata, and composable filters. */
import type { ChangeEvent } from 'react';
import { displayName, type PokemonEntry } from '../domain/pokemon';
import type { PokedexController } from '../hooks/usePokedex';

interface CatalogProps {
  controller: PokedexController;
}
interface CatalogEntryProps {
  entry: PokemonEntry;
  label?: string | undefined;
  active: boolean;
  favorite: boolean;
  onSelect: (id: number) => void;
}

/** Renders one result using its real API ID and available generation metadata. */
function CatalogEntry({ entry, label, active, favorite, onSelect }: CatalogEntryProps) {
  /** Selects this result using a typed identifier. */
  function handleClick(): void {
    onSelect(entry.id);
  }
  return (
    <li>
      <button type="button" onClick={handleClick} aria-current={active}>
        <span className="list-number">#{String(entry.id).padStart(3, '0')}</span>
        <span className="list-text">
          <span className="list-name">{displayName(entry.name)}</span>
          {label && <span className="list-generation">{label}</span>}
        </span>
        {favorite && (
          <span className="list-favorite" role="img" aria-label="Favorite">
            ★
          </span>
        )}
      </button>
    </li>
  );
}

/** Renders every matching Pokémon in one scrollable archive without pagination controls. */
export function Catalog({ controller: c }: CatalogProps) {
  /** Sends a normalized search input value to the controller. */
  function handleSearch(event: ChangeEvent<HTMLInputElement>): void {
    c.search(event.target.value);
  }
  /** Applies the type selected from the API-provided options. */
  function handleType(event: ChangeEvent<HTMLSelectElement>): void {
    c.selectType(event.target.value);
  }
  const rows = [];
  for (const entry of c.entries)
    rows.push(
      <CatalogEntry
        key={entry.id}
        entry={entry}
        label={c.generations.get(entry.name)}
        active={entry.id === c.currentId}
        favorite={c.favorites.has(entry.id)}
        onSelect={c.selectPokemon}
      />,
    );
  const options = [];
  let hasSelectedType = !c.typeName;
  for (const type of c.types) {
    if (type.name === c.typeName) hasSelectedType = true;
    options.push(
      <option key={type.name} value={type.name}>
        {displayName(type.name)}
      </option>,
    );
  }
  if (!hasSelectedType)
    options.push(
      <option key={c.typeName} value={c.typeName}>
        {displayName(c.typeName)}
      </option>,
    );
  const loading = c.indexLoading || c.filterLoading;
  return (
    <aside className="catalog" aria-label="Pokémon catalog">
      <div className="catalog-heading">
        <h1>POKÉMON INDEX</h1>
        <span className="micro-label">ALL GENERATIONS</span>
      </div>
      <label className="search-label" htmlFor="search">
        Search Pokémon
      </label>
      <div className="search-box">
        <span aria-hidden="true">⌕</span>
        <input
          id="search"
          type="search"
          placeholder="Name or #number"
          autoComplete="off"
          spellCheck={false}
          value={c.query}
          onChange={handleSearch}
        />
      </div>
      <div className="filters">
        <label className="visually-hidden" htmlFor="type-filter">
          Filter by type
        </label>
        <select id="type-filter" value={c.typeName} onChange={handleType}>
          <option value="">All types</option>
          {options}
        </select>
        <button type="button" aria-pressed={c.favoritesOnly} onClick={c.toggleFavoritesOnly}>
          ☆ Favorites
        </button>
      </div>
      <div className="list-meta">
        <span role="status">
          {loading ? 'Loading archive…' : `${c.entries.length.toLocaleString('en-US')} Pokémon`}
        </span>
        <button type="button" onClick={c.resetFilters}>
          Reset
        </button>
      </div>
      {c.indexError && (
        <div className="status" role="alert">
          <p>{c.indexError}</p>
          <button type="button" onClick={c.retryIndex}>
            Retry archive
          </button>
        </div>
      )}
      {c.filterError && (
        <div className="status" role="alert">
          <p>{c.filterError}</p>
          <button type="button" onClick={c.retryFilter}>
            Retry filter
          </button>
        </div>
      )}
      {!loading && !c.indexError && !c.filterError && rows.length === 0 && (
        <p className="status" role="status">
          No Pokémon match these filters.
        </p>
      )}
      <ul className="pokemon-list" aria-label="Pokémon results" aria-busy={loading}>
        {!loading && rows}
      </ul>
      <footer className="catalog-footer">
        <span className="connection-dot" aria-hidden="true" />
        Powered by PokéAPI v2
      </footer>
    </aside>
  );
}
