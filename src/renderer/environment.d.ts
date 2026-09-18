/** Declares the minimal native bridge exposed by Electron's isolated preload. */
export {};

declare global {
  interface Window {
    pokedex?: {
      /** Minimizes the application window. */
      minimize(): void;
      /** Closes the application window. */
      close(): void;
      /** Resizes the native window to the unfolded or closed hardware footprint. */
      setExpanded(expanded: boolean): Promise<void>;
    };
  }
}
