/** Coordinates the physical lid, power sequence, sound preference, and compact desktop footprint. */
import { useEffect, useRef, useState } from 'react';
import { DeviceAudio } from '../services/device-audio';
import { browserStorage } from '../services/storage';

export type DevicePhase = 'closed' | 'opening' | 'open' | 'closing';
const SOUND_KEY = 'pokedex:muted:v1';

/** Measures the available canvas for a uniformly scaled physical device. */
function readViewport(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Restores the sound preference without making local storage a startup requirement. */
function loadMuted(): boolean {
  try {
    return browserStorage()?.getItem(SOUND_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Provides a guarded mechanical state machine whose transitions cannot overlap. */
export function useDevice() {
  const [phase, setPhase] = useState<DevicePhase>('closed');
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(loadMuted);
  const phaseRef = useRef<DevicePhase>('closed');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef(new DeviceAudio());
  const alive = useRef(true);
  const [viewport, setViewport] = useState(readViewport);

  /** Tracks desktop resizing and releases timers and audio on unmount. */
  useEffect(function manageLifecycle() {
    alive.current = true;
    /** Updates device scale after a native window or browser viewport resize. */
    function resize(): void {
      setViewport(readViewport());
    }
    window.addEventListener('resize', resize);
    const sound = audio.current;
    /** Stops unfinished transitions and closes the owned audio context. */
    return function cleanup() {
      alive.current = false;
      window.removeEventListener('resize', resize);
      if (timer.current) clearTimeout(timer.current);
      sound.dispose();
    };
  }, []);

  /** Keeps scheduled sound effects consistent with the persisted mute preference. */
  useEffect(
    function updateAudioPreference() {
      audio.current.setMuted(muted);
    },
    [muted],
  );

  /** Updates React and the synchronous guard together before another input can arrive. */
  function transition(next: DevicePhase): void {
    phaseRef.current = next;
    setPhase(next);
  }

  /** Opens the native footprint before rotating the lid and running the power-on sequence. */
  async function open(): Promise<void> {
    if (phaseRef.current !== 'closed') return;
    phaseRef.current = 'opening';
    void audio.current.play('open');
    try {
      await window.pokedex?.setExpanded(true);
    } catch {
      /* Browser layout still opens if native resizing is unavailable. */
    }
    if (!alive.current) return;
    setExpanded(true);
    transition('opening');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /** Completes startup and exposes the now-powered screens to keyboard navigation. */
    function finishOpening(): void {
      transition('open');
    }
    timer.current = setTimeout(finishOpening, reduced ? 40 : 1150);
  }

  /** Powers down immediately, folds the lid, and then contracts the native window. */
  function close(): void {
    if (phaseRef.current !== 'open') return;
    transition('closing');
    void audio.current.play('close');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /** Restores the closed-device footprint after the physical lid reaches its latch. */
    function finishClosing(): void {
      transition('closed');
      setExpanded(false);
      void window.pokedex?.setExpanded(false).catch(ignoreResizeFailure);
    }
    timer.current = setTimeout(finishClosing, reduced ? 40 : 850);
  }

  /** Toggles all device audio and saves the preference for the next launch. */
  function toggleMuted(): void {
    const next = !muted;
    audio.current.setMuted(next);
    setMuted(next);
    if (!next) void audio.current.play('confirm');
    try {
      browserStorage()?.setItem(SOUND_KEY, String(next));
    } catch {
      /* Session mute still works when storage is unavailable. */
    }
  }

  /** Provides quiet tactile feedback for physical keys and on-screen controls. */
  function click(): void {
    if (phaseRef.current === 'open') void audio.current.play('button');
  }

  const width = expanded ? 756 : 386;
  const scale = Math.min(1, (viewport.width - 32) / width, (viewport.height - 48) / 608);
  return {
    phase,
    expanded,
    muted,
    scale: Math.max(0.2, scale),
    width,
    open,
    close,
    toggleMuted,
    click,
  };
}

/** Keeps the browser interaction usable if the native window is already closing. */
function ignoreResizeFailure(): void {
  /* No native resize is needed after the host has closed. */
}
