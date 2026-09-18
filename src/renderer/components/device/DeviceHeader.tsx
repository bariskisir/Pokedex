/** Presents the blue sensor, status LEDs, and small native controls above the folding cover. */
import type { DevicePhase } from '../../hooks/useDevice';

/** Renders a draggable molded sensor housing that remains exposed when the device is closed. */
export function DeviceHeader({
  phase,
  loading,
  error,
}: {
  phase: DevicePhase;
  loading: boolean;
  error: boolean;
}) {
  const status =
    phase === 'closed' || phase === 'closing'
      ? 'standby'
      : phase === 'opening'
        ? 'booting'
        : error
          ? 'error'
          : loading
            ? 'loading'
            : 'ready';
  /** Minimizes the compact desktop window through the isolated native bridge. */
  function minimize(): void {
    window.pokedex?.minimize();
  }
  /** Exits the desktop application through the isolated native bridge. */
  function exit(): void {
    window.pokedex?.close();
  }
  return (
    <header className="sensor-housing" data-status={status}>
      <div className="sensor-ring">
        <span className="sensor-lens" aria-hidden="true">
          <i />
        </span>
      </div>
      <div className="status-lights" aria-hidden="true">
        <i className="led led-red" />
        <i className="led led-amber" />
        <i className="led led-green" />
      </div>
      <span className="housing-label">
        POKÉDEX<span>PORTABLE RESEARCH SYSTEM</span>
      </span>
      {window.pokedex && (
        <div className="native-controls">
          <button type="button" aria-label="Minimize window" onClick={minimize} data-silent>
            −
          </button>
          <button type="button" aria-label="Close window" onClick={exit} data-silent>
            ×
          </button>
        </div>
      )}
      <span className="housing-seam" aria-hidden="true" />
    </header>
  );
}
