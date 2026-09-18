/** Assembles the folding Pokédex, physical controls, powered screens, and native-sized desktop shell. */
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { usePokedex } from '../hooks/usePokedex';
import { useDevice } from '../hooks/useDevice';
import { Catalog } from './Catalog';
import { PokemonProfile } from './PokemonProfile';
import { DeviceCover } from './device/DeviceCover';
import { DeviceHeader } from './device/DeviceHeader';
import { DeviceControls, type ScreenMode } from './device/DeviceControls';
import { ScreenTabs } from './device/ScreenTabs';

/** Renders a closed physical device whose lid powers up two independent embedded displays. */
export function App() {
  const controller = usePokedex();
  const device = useDevice();
  const [mode, setMode] = useState<ScreenMode>('profile');
  const frame = useRef<HTMLDivElement>(null);
  const previousPhase = useRef(device.phase);
  const ready = device.phase === 'open';

  /** Moves keyboard focus onto the visible face at the end of a mechanical transition. */
  useEffect(
    function focusActiveSurface() {
      if (device.phase === 'open')
        frame.current
          ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
          ?.focus({ preventScroll: true });
      if (device.phase === 'closed' && previousPhase.current === 'closing')
        frame.current
          ?.querySelector<HTMLButtonElement>('.cover-face')
          ?.focus({ preventScroll: true });
      previousPhase.current = device.phase;
    },
    [device.phase],
  );

  /** Plays a tactile cue for enabled controls while excluding the dedicated sound and lid switches. */
  function handleButton(event: MouseEvent<HTMLDivElement>): void {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button');
    if (button && !button.disabled && !button.hasAttribute('data-silent')) device.click();
  }

  /** Returns the main display to its identity page after selecting another catalog entry. */
  function selectPokemon(id: number): void {
    controller.selectPokemon(id);
    setMode('profile');
  }

  const catalogController = { ...controller, selectPokemon };
  const dimensions = {
    '--device-scale': device.scale,
    width: device.width * device.scale,
    height: 608 * device.scale,
  } as CSSProperties;

  return (
    <div className={`device-scene${window.pokedex ? ' device-scene-native' : ''}`}>
      {!window.pokedex && (
        <div className="scene-caption" aria-hidden="true">
          <span>POCKET-SIZED WONDER.</span>
          <small>A familiar device. A whole world to discover.</small>
        </div>
      )}
      <div className="device-viewport" style={dimensions}>
        <div
          ref={frame}
          className="pokedex-device"
          data-phase={device.phase}
          onClickCapture={handleButton}
        >
          <div className="main-shell">
            <DeviceHeader
              phase={device.phase}
              loading={
                controller.detailLoading || controller.indexLoading || controller.filterLoading
              }
              error={Boolean(
                controller.detailError || controller.indexError || controller.filterError,
              )}
            />
            <main
              id="device-interior"
              className="left-interior"
              inert={!ready}
              aria-hidden={!ready}
            >
              <div className="screen-bezel">
                <div className="bezel-leds" aria-hidden="true">
                  <i />
                  <i />
                </div>
                <div className="screen-glass" data-powered={ready}>
                  <ScreenTabs mode={mode} onMode={setMode} />
                  <PokemonProfile
                    controller={controller}
                    mode={mode}
                    active={ready}
                    muted={device.muted}
                  />
                  <div className="boot-screen" aria-hidden="true">
                    <span className="boot-symbol">◉</span>
                    <strong>POKÉDEX</strong>
                    <span>INITIALIZING FIELD SYSTEM</span>
                    <div className="boot-progress">
                      <i />
                    </div>
                    <small>NATIONAL ARCHIVE / ALL GENERATIONS</small>
                  </div>
                </div>
                <div className="bezel-bottom" aria-hidden="true">
                  <span className="screen-indicator" />
                  <span className="bezel-model">DEX / 01</span>
                  <span className="speaker-grille">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
              <DeviceControls
                controller={controller}
                mode={mode}
                onMode={setMode}
                muted={device.muted}
                onMute={device.toggleMuted}
                onClose={device.close}
              />
            </main>
            <span className="shell-screw screw-bottom-left" aria-hidden="true" />
            <span className="shell-screw screw-bottom-right" aria-hidden="true" />
          </div>
          <DeviceCover phase={device.phase} onOpen={device.open}>
            <div className="catalog-bezel">
              <Catalog controller={catalogController} />
            </div>
            <div className="lid-trim" aria-hidden="true">
              <span className="speaker-grille">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="gold-indicator" />
            </div>
            <button
              type="button"
              className="lid-close"
              onClick={device.close}
              aria-label="Fold cover closed"
              data-silent
            >
              ◀ FOLD TO CLOSE
            </button>
          </DeviceCover>
          <div className="hinge" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
      <p className="device-hint" role="status">
        {device.phase === 'closed'
          ? 'Your next adventure is one click away.'
          : device.phase === 'opening'
            ? 'Opening Pokédex…'
            : device.phase === 'closing'
              ? 'Entering standby…'
              : controller.notice === 'Ready for your next discovery.'
                ? 'D-pad to explore · red switch to close'
                : controller.notice}
      </p>
    </div>
  );
}
