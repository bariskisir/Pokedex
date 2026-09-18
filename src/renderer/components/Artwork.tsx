/** Displays artwork variants and manages user-initiated Pokémon audio playback. */
import { useEffect, useRef, useState } from 'react';
import type { Pokemon } from '../api/schemas';
import { artworkUrl, displayName } from '../domain/pokemon';

interface ArtworkProps {
  pokemon: Pokemon;
  notify: (message: string) => void;
  active: boolean;
  muted: boolean;
}

/** Renders image fallbacks and releases active audio when the selected profile changes. */
export function Artwork({ pokemon, notify, active, muted }: ArtworkProps) {
  const [shiny, setShiny] = useState(false);
  const [failedUrl, setFailedUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAttempt = useRef(0);
  const imageUrl = artworkUrl(pokemon, shiny);
  const cryUrl = pokemon.cries?.latest ?? pokemon.cries?.legacy;

  /** Stops playback and detaches callbacks whenever this profile is replaced. */
  useEffect(function manageAudio() {
    /** Releases media resources without updating an unmounted component. */
    return function cleanup() {
      const audio = audioRef.current;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      audioRef.current = null;
      playbackAttempt.current++;
    };
  }, []);

  /** Silences an active cry immediately when the lid closes or all device audio is muted. */
  useEffect(
    function synchronizePower() {
      if (!active || muted) {
        playbackAttempt.current++;
        audioRef.current?.pause();
        setPlaying(false);
      }
    },
    [active, muted],
  );

  /** Toggles shiny mode while retaining the standard-image fallback. */
  function toggleShiny(): void {
    setShiny(!shiny);
  }
  /** Replaces an unavailable remote image with the bundled Poké Ball asset once. */
  function handleImageError(): void {
    setFailedUrl(imageUrl);
  }
  /** Restores the idle state after playback completes. */
  function handleEnded(): void {
    setPlaying(false);
  }
  /** Reports audio decoding or network errors without failing the profile. */
  function handleAudioError(): void {
    setPlaying(false);
    notify('This Pokémon cry is unavailable. Please try again later.');
  }
  /** Starts or stops a cry only after a user gesture. */
  async function toggleCry(): Promise<void> {
    if (!cryUrl || !active || muted) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = audioRef.current ?? new Audio(cryUrl);
    audioRef.current = audio;
    audio.onended = handleEnded;
    audio.onerror = handleAudioError;
    audio.volume = 0.5;
    audio.currentTime = 0;
    const attempt = ++playbackAttempt.current;
    try {
      await audio.play();
      if (audioRef.current === audio && attempt === playbackAttempt.current) setPlaying(true);
    } catch {
      if (audioRef.current === audio && attempt === playbackAttempt.current) handleAudioError();
    }
  }
  return (
    <div className="artwork-stage">
      <span className="artwork-ring" aria-hidden="true" />
      <img
        src={failedUrl === imageUrl ? './pokeball.png' : imageUrl}
        onError={failedUrl === imageUrl ? undefined : handleImageError}
        alt={`${shiny ? 'Shiny ' : ''}${displayName(pokemon.name)}`}
        width={250}
        height={250}
      />
      <div className="artwork-actions">
        <button type="button" onClick={toggleShiny} aria-pressed={shiny}>
          ✧ Shiny
        </button>
        <button
          type="button"
          onClick={toggleCry}
          disabled={!cryUrl || muted}
          title={muted ? 'Unmute the device to play cries' : 'Play Pokémon cry'}
        >
          {playing ? '■ Stop cry' : '♪ Play cry'}
        </button>
      </div>
    </div>
  );
}
