/** Lists the API's complete move pool without implying version-specific learn levels. */
import type { Pokemon } from '../api/schemas';
import { displayName } from '../domain/pokemon';

/** Renders moves in a bounded scroll area and exposes the total move count. */
export function Moves({ moves }: { moves: Pokemon['moves'] }) {
  const names = new Set<string>();
  for (const entry of moves) names.add(entry.move.name);
  const items = [];
  for (const name of [...names].sort()) items.push(<li key={name}>{displayName(name)}</li>);
  return (
    <section className="data-card moves-card">
      <h3>
        Moves <span>{items.length}</span>
      </h3>
      <p className="section-note">Across all available game versions</p>
      {items.length ? (
        <ul className="moves">{items}</ul>
      ) : (
        <p className="muted">No moves are available.</p>
      )}
    </section>
  );
}
