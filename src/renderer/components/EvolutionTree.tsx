/** Preserves branching evolution relationships instead of presenting siblings as a sequence. */
import type { Evolution, EvolutionStage, NamedResource } from '../api/schemas';
import { displayName } from '../domain/pokemon';

interface EvolutionNodeProps {
  stage: EvolutionStage;
  currentSpecies: string;
  onSelect: (species: NamedResource) => void;
}

/** Renders a species and nests each of its alternative evolution branches beneath it. */
function EvolutionNode({ stage, currentSpecies, onSelect }: EvolutionNodeProps) {
  /** Requests the selected species' default Pokémon variety. */
  function handleClick(): void {
    onSelect(stage.species);
  }
  const children = [];
  for (const next of stage.evolves_to)
    children.push(
      <EvolutionNode
        key={next.species.name}
        stage={next}
        currentSpecies={currentSpecies}
        onSelect={onSelect}
      />,
    );
  return (
    <li>
      <button
        type="button"
        aria-current={stage.species.name === currentSpecies}
        onClick={handleClick}
      >
        {displayName(stage.species.name)}
      </button>
      {children.length > 0 && (
        <ul
          className="evolution-tree"
          aria-label={`Evolutions of ${displayName(stage.species.name)}`}
        >
          {children}
        </ul>
      )}
    </li>
  );
}

/** Renders the full species tree while keeping missing data distinct from no evolutions. */
export function EvolutionTree({
  evolution,
  currentSpecies,
  onSelect,
}: {
  evolution: Evolution | null;
  currentSpecies: string;
  onSelect: (species: NamedResource) => void;
}) {
  return (
    <section className="data-card evolution-card">
      <h3>Evolution family</h3>
      {evolution ? (
        <ul className="evolution-tree">
          <EvolutionNode
            stage={evolution.chain}
            currentSpecies={currentSpecies}
            onSelect={onSelect}
          />
        </ul>
      ) : (
        <p className="muted">Evolution data is unavailable.</p>
      )}
    </section>
  );
}
