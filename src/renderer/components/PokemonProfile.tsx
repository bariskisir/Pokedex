/** Composes Pokémon identity, artwork, measurements, combat data, and evolution navigation. */
import { displayName, flavorText, generationLabel, genus } from '../domain/pokemon';
import type { PokedexController } from '../hooks/usePokedex';
import { Artwork } from './Artwork';
import { EvolutionTree } from './EvolutionTree';
import { Moves } from './Moves';
import { Stats } from './Stats';
import { TypeMatchups } from './TypeMatchups';
import { TypeBadge } from './ui';
import type { ScreenMode } from './device/DeviceControls';

/** Presents explicit loading, failure, partial-data, and ready states for a profile. */
export function PokemonProfile({
  controller: c,
  mode,
  active,
  muted,
}: {
  controller: PokedexController;
  mode: ScreenMode;
  active: boolean;
  muted: boolean;
}) {
  const data = c.details;
  const pokemon = data?.pokemon;
  const types = [];
  const abilities = [];
  for (const slot of pokemon?.types ?? [])
    types.push(<TypeBadge key={slot.type.name} name={slot.type.name} onSelect={c.selectType} />);
  for (const slot of pokemon?.abilities ?? [])
    abilities.push(
      <span className="ability" key={slot.ability.name}>
        {displayName(slot.ability.name)}
        {slot.is_hidden && <small> · Hidden</small>}
      </span>,
    );
  const label = data ? generationLabel(data.generation, data.species) : '';
  const isFavorite = pokemon ? c.favorites.has(pokemon.id) : false;
  return (
    <section className="detail-panel" aria-label="Pokémon details" aria-busy={c.detailLoading}>
      {c.detailLoading && (
        <p className="detail-status" role="status">
          Loading Pokémon profile…
        </p>
      )}
      {c.detailError && (
        <div className="detail-status" role="alert">
          <p>{c.detailError}</p>
          <button type="button" onClick={c.retryDetails}>
            Retry Pokémon
          </button>
        </div>
      )}
      {data && pokemon && (
        <article>
          {data.warnings.length > 0 && (
            <div className="detail-status" role="status">
              <p>{data.warnings.join(' ')}</p>
              <button type="button" onClick={c.retryDetails}>
                Retry missing details
              </button>
            </div>
          )}
          <div
            id="panel-profile"
            role="tabpanel"
            aria-labelledby="tab-profile"
            hidden={mode !== 'profile'}
          >
            <div className="profile-heading">
              <div>
                <span className="entry-number">#{String(pokemon.id).padStart(3, '0')}</span>
                <h2>{displayName(pokemon.name)}</h2>
                <p className="muted">{genus(data.species)}</p>
                {label && <p className="generation-label">{label}</p>}
              </div>
              <button
                className="favorite-button"
                type="button"
                aria-pressed={isFavorite}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={c.toggleFavorite}
              >
                {isFavorite ? '★' : '☆'}
              </button>
            </div>
            <div className="profile-overview">
              <Artwork
                key={pokemon.id}
                pokemon={pokemon}
                notify={c.notify}
                active={active && mode === 'profile'}
                muted={muted}
              />
              <div className="profile-summary">
                <div className="badges">{types}</div>
                <p className="description">{flavorText(data.species)}</p>
                <dl className="measurements">
                  <div>
                    <dt>Height</dt>
                    <dd>{pokemon.height / 10} m</dd>
                  </div>
                  <div>
                    <dt>Weight</dt>
                    <dd>{pokemon.weight / 10} kg</dd>
                  </div>
                </dl>
                <h3>Abilities</h3>
                <div className="badges">{abilities}</div>
              </div>
            </div>
          </div>
          <div
            id="panel-stats"
            role="tabpanel"
            aria-labelledby="tab-stats"
            className="detail-grid"
            hidden={mode !== 'stats'}
          >
            <Stats stats={pokemon.stats} />
            <TypeMatchups types={data.types} onSelect={c.selectType} />
          </div>
          <div
            id="panel-evolution"
            role="tabpanel"
            aria-labelledby="tab-evolution"
            hidden={mode !== 'evolution'}
          >
            <EvolutionTree
              evolution={data.evolution}
              currentSpecies={pokemon.species.name}
              onSelect={c.selectSpecies}
            />
          </div>
          <div
            id="panel-moves"
            role="tabpanel"
            aria-labelledby="tab-moves"
            hidden={mode !== 'moves'}
          >
            <Moves moves={pokemon.moves} />
          </div>
        </article>
      )}
    </section>
  );
}
