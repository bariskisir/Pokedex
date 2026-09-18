/** Builds the two physical faces of the hinged lid and its embossed outer casing. */
import type { ReactNode } from 'react';
import type { DevicePhase } from '../../hooks/useDevice';

/** Makes the entire closed cover accessible while enabling inner controls only after startup. */
export function DeviceCover({
  phase,
  onOpen,
  children,
}: {
  phase: DevicePhase;
  onOpen: () => void;
  children: ReactNode;
}) {
  const closed = phase === 'closed';
  return (
    <div className="device-lid">
      <button
        type="button"
        className="cover-face"
        aria-label="Open Pokédex"
        aria-expanded={!closed}
        aria-controls="device-interior"
        onClick={onOpen}
        tabIndex={closed ? 0 : -1}
        aria-hidden={!closed}
        data-silent
      >
        <span className="cover-inset" aria-hidden="true">
          <span className="cover-brand">POKÉDEX</span>
          <span className="cover-model">HANDHELD ENCYCLOPEDIA</span>
          <span className="cover-emblem">
            <span />
          </span>
          <span className="cover-ribs">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="cover-serial">MODEL 01 / NATIONAL EDITION</span>
        </span>
        <span className="cover-prompt">
          PRESS TO OPEN <span aria-hidden="true">↗</span>
        </span>
      </button>
      <div className="lid-interior" inert={phase !== 'open'} aria-hidden={phase !== 'open'}>
        {children}
      </div>
    </div>
  );
}
