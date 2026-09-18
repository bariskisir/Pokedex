/** Displays combined defensive weaknesses, resistances, and immunities. */
import type { PokemonType } from '../api/schemas';
import { damageMultipliers } from '../domain/pokemon';
import { TypeBadge } from './ui';

/** Groups exact multipliers so immunity and quadruple weaknesses remain visible. */
export function TypeMatchups({
  types,
  onSelect,
}: {
  types: PokemonType[];
  onSelect: (name: string) => void;
}) {
  const groups = {
    Weaknesses: [] as [string, number][],
    Resistances: [] as [string, number][],
    Immunities: [] as [string, number][],
  };
  for (const entry of damageMultipliers(types)) {
    if (entry[1] === 0) groups.Immunities.push(entry);
    else if (entry[1] < 1) groups.Resistances.push(entry);
    else if (entry[1] > 1) groups.Weaknesses.push(entry);
  }
  const sections = [];
  for (const [label, entries] of Object.entries(groups)) {
    if (entries.length === 0) continue;
    const badges = [];
    for (const [name, multiplier] of entries)
      badges.push(<TypeBadge key={name} name={name} multiplier={multiplier} onSelect={onSelect} />);
    sections.push(
      <div key={label} className="matchup-group">
        <p>{label}</p>
        <div className="badges">{badges}</div>
      </div>,
    );
  }
  return (
    <section className="data-card">
      <h3>Type matchups</h3>
      <p className="section-note">Incoming damage · type only</p>
      <div className="matchups">
        {types.length === 0 ? (
          <p className="muted">Type data is unavailable.</p>
        ) : sections.length ? (
          sections
        ) : (
          <p className="muted">All incoming types deal neutral damage.</p>
        )}
      </div>
    </section>
  );
}
