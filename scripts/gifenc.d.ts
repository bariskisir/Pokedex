/** Describes the small GIF encoder surface used by the documentation recording script. */
declare module 'gifenc' {
  type Palette = number[][];
  interface Encoder {
    /** Appends an indexed frame with an explicit palette, duration, and repeat policy. */
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: { palette?: Palette; delay: number; repeat?: number },
    ): void;
    /** Appends the GIF trailer after the final frame. */
    finish(): void;
    /** Returns the completed binary GIF buffer. */
    bytes(): Uint8Array;
  }
  /** Creates an encoder for a new animated GIF stream. */
  export function GIFEncoder(): Encoder;
  /** Computes a palette from representative RGBA pixels. */
  export function quantize(data: Uint8Array, colors: number): Palette;
  /** Maps RGBA pixels into the selected global palette. */
  export function applyPalette(data: Uint8Array, palette: Palette): Uint8Array;
  const gifenc: {
    GIFEncoder: typeof GIFEncoder;
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
  };
  export default gifenc;
}
