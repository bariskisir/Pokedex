/** Keeps unexpected rendering failures recoverable through a visible application message. */
import { Component, type ReactNode } from 'react';

/** Reloads the renderer when a user explicitly requests recovery. */
function reload(): void {
  window.location.reload();
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  public override state = { failed: false };

  /** Switches to the recovery screen when a descendant throws while rendering. */
  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  /** Presents a recoverable failure screen or the normal application tree. */
  public override render() {
    if (this.state.failed)
      return (
        <main className="fatal-error" role="alert">
          <h1>Unable to display Pokédex</h1>
          <p>Something unexpected happened. Reload the application to try again.</p>
          <button type="button" onClick={reload}>
            Reload application
          </button>
        </main>
      );
    return this.props.children;
  }
}
