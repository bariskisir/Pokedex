/** Synthesizes original mechanical clicks and electronic cues without remote audio assets. */
export type DeviceCue = 'open' | 'close' | 'button' | 'confirm';

export class DeviceAudio {
  private context: AudioContext | null = null;
  private readonly voices = new Set<AudioScheduledSourceNode>();
  private muted = false;

  /** Applies mute immediately, including any already scheduled startup sounds. */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stop();
  }

  /** Unlocks browser audio only from a deliberate user gesture and plays a bounded cue. */
  public async play(cue: DeviceCue): Promise<void> {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.muted || this.context.state !== 'running') return;
      const start = this.context.currentTime + 0.008;
      if (cue === 'open') {
        this.stop();
        this.click(start, 0.05, 1100);
        this.tone(start + 0.06, 0.28, 95, 145, 'sawtooth', 0.013);
        this.click(start + 0.58, 0.035, 1700);
        this.tone(start + 0.67, 0.1, 523.25, 523.25, 'triangle', 0.09);
        this.tone(start + 0.8, 0.1, 659.25, 659.25, 'triangle', 0.08);
        this.tone(start + 0.93, 0.23, 1046.5, 1046.5, 'sine', 0.07);
      } else if (cue === 'close') {
        this.stop();
        this.tone(start, 0.12, 600, 180, 'triangle', 0.065);
        this.tone(start + 0.16, 0.2, 130, 75, 'sawtooth', 0.013);
        this.click(start + 0.68, 0.065, 650);
      } else if (cue === 'confirm') {
        this.tone(start, 0.065, 660, 660, 'triangle', 0.055);
        this.tone(start + 0.08, 0.12, 880, 880, 'sine', 0.045);
      } else {
        this.click(start, 0.018, 2200);
        this.tone(start, 0.045, 920, 730, 'sine', 0.035);
      }
    } catch {
      /* An unavailable output device must never stop the mechanical interaction. */
    }
  }

  /** Stops every active oscillator or noise source when powering down or muting. */
  private stop(): void {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already-ended sources need no additional cleanup. */
      }
    }
    this.voices.clear();
  }

  /** Shapes a short oscillator envelope to avoid clicks at the ends of electronic tones. */
  private tone(
    start: number,
    duration: number,
    frequency: number,
    endFrequency: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.track(oscillator, gain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  /** Uses filtered noise with a sharp decay to suggest a latch or tactile switch. */
  private click(start: number, duration: number, frequency: number): void {
    const context = this.context;
    if (!context) return;
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(0.18, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    this.track(source, gain, filter);
    source.start(start);
    source.stop(start + duration);
  }

  /** Disconnects completed audio nodes so repeated interactions do not retain a growing graph. */
  private track(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    this.voices.add(source);
    /** Releases the exact source and effect nodes associated with this voice. */
    const release = (): void => {
      source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(source);
    };
    source.onended = release;
  }

  /** Releases the audio device when the application component is disposed. */
  public dispose(): void {
    this.stop();
    if (this.context) void this.context.close().catch(ignoreClosedContext);
    this.context = null;
  }
}

/** Ignores a context that the browser already closed during application shutdown. */
function ignoreClosedContext(): void {
  /* The audio device has already been released. */
}
