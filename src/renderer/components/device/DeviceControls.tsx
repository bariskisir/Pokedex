/** Implements tactile navigation, information modes, and speaker controls as physical hardware. */
import type { PokedexController } from '../../hooks/usePokedex';

export type ScreenMode = 'profile' | 'stats' | 'evolution' | 'moves';

interface DeviceControlsProps {
  controller: PokedexController;
  mode: ScreenMode;
  onMode: (mode: ScreenMode) => void;
  muted: boolean;
  onMute: () => void;
  onClose: () => void;
}

/** Selects adjacent Pokémon and cycles screen modes using a four-way directional pad. */
export function DeviceControls({
  controller: c,
  mode,
  onMode,
  muted,
  onMute,
  onClose,
}: DeviceControlsProps) {
  const modes: ScreenMode[] = ['profile', 'stats', 'evolution', 'moves'];
  /** Moves to the previous available Pokémon in the current catalog filter. */
  function previous(): void {
    if (c.previousId !== undefined) c.selectPokemon(c.previousId);
  }
  /** Moves to the next available Pokémon in the current catalog filter. */
  function next(): void {
    if (c.nextId !== undefined) c.selectPokemon(c.nextId);
  }
  /** Selects the previous information page in a circular sequence. */
  function previousMode(): void {
    onMode(modes[(modes.indexOf(mode) + 3) % modes.length] ?? 'profile');
  }
  /** Selects the next information page in a circular sequence. */
  function nextMode(): void {
    onMode(modes[(modes.indexOf(mode) + 1) % modes.length] ?? 'profile');
  }
  return (
    <div className="physical-controls">
      <button
        type="button"
        className="sound-dial"
        onClick={onMute}
        aria-label="Mute device sounds"
        aria-pressed={muted}
        data-silent
      >
        <span aria-hidden="true">{muted ? '○' : '♪'}</span>
      </button>
      <div className="function-rockers">
        <button
          className="rocker rocker-red"
          type="button"
          onClick={onClose}
          aria-label="Close Pokédex"
          data-silent
        />
        <button
          className="rocker rocker-blue"
          type="button"
          onClick={c.toggleFavorite}
          aria-label="Save current Pokémon"
          disabled={!c.details}
        />
      </div>
      <div className="mini-lcd">
        <span>NO. {String(c.currentId ?? 0).padStart(4, '0')}</span>
        <strong>{mode.toUpperCase()}</strong>
        <i>MEMORY / {c.favorites.size}</i>
      </div>
      <fieldset className="d-pad" aria-label="Directional controls">
        <button
          type="button"
          className="d-pad-up"
          onClick={previousMode}
          aria-label="Previous information page"
        >
          ▲
        </button>
        <button
          type="button"
          className="d-pad-left"
          onClick={previous}
          aria-label="Previous Pokémon"
          disabled={c.previousId === undefined}
        >
          ◀
        </button>
        <span className="d-pad-center" aria-hidden="true" />
        <button
          type="button"
          className="d-pad-right"
          onClick={next}
          aria-label="Next Pokémon"
          disabled={c.nextId === undefined}
        >
          ▶
        </button>
        <button
          type="button"
          className="d-pad-down"
          onClick={nextMode}
          aria-label="Next information page"
        >
          ▼
        </button>
      </fieldset>
      <span className="control-label label-sound">SOUND</span>
      <span className="control-label label-power">CLOSE / SAVE</span>
      <span className="control-label label-navigate">NAVIGATE</span>
    </div>
  );
}
