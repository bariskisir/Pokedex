/** Presents base stats with semantic meters and a calculated total. */
import type { Pokemon } from '../api/schemas';

const LABELS: Record<string, string> = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SPA',
  'special-defense': 'SPD',
  speed: 'SPE',
};

/** Renders accessible stat values and their relative scale. */
export function Stats({ stats }: { stats: Pokemon['stats'] }) {
  let total = 0;
  const rows = [];
  for (const entry of stats) {
    total += entry.base_stat;
    rows.push(
      <div className="stat" key={entry.stat.name}>
        <span className="stat-label" title={entry.stat.name}>
          {LABELS[entry.stat.name] ?? entry.stat.name}
        </span>
        <span className="stat-value">{entry.base_stat}</span>
        <progress max={255} value={entry.base_stat} aria-label={entry.stat.name} />
      </div>,
    );
  }
  return (
    <section className="data-card">
      <h3>
        Base stats <span>TOTAL {total}</span>
      </h3>
      <div className="stats">{rows}</div>
    </section>
  );
}
