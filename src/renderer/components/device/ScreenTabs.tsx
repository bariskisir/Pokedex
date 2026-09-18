/** Implements compact keyboard-navigable information tabs inside the primary LCD. */
import type { KeyboardEvent } from 'react';
import type { ScreenMode } from './DeviceControls';

const pages: { mode: ScreenMode; label: string }[] = [
  { mode: 'profile', label: 'INFO' },
  { mode: 'stats', label: 'STATS' },
  { mode: 'evolution', label: 'EVOLUTION' },
  { mode: 'moves', label: 'MOVES' },
];

/** Renders all display modes with roving focus and standard arrow-key navigation. */
export function ScreenTabs({
  mode,
  onMode,
}: {
  mode: ScreenMode;
  onMode: (mode: ScreenMode) => void;
}) {
  const buttons = [];
  for (const page of pages)
    buttons.push(
      <ScreenTab
        key={page.mode}
        mode={page.mode}
        label={page.label}
        selected={page.mode === mode}
        onMode={onMode}
      />,
    );
  return (
    <div className="screen-tabs" role="tablist" aria-label="Pokémon information pages">
      {buttons}
    </div>
  );
}

/** Selects and focuses a single information tab through pointer or keyboard input. */
function ScreenTab({
  mode,
  label,
  selected,
  onMode,
}: {
  mode: ScreenMode;
  label: string;
  selected: boolean;
  onMode: (mode: ScreenMode) => void;
}) {
  /** Switches the LCD to this tab's content. */
  function select(): void {
    onMode(mode);
  }
  /** Supports circular arrow navigation and direct first/last tab shortcuts. */
  function navigate(event: KeyboardEvent<HTMLButtonElement>): void {
    const tabs = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const index = tabs.indexOf(event.currentTarget);
    let target = index;
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[target]?.focus();
    tabs[target]?.click();
  }
  return (
    <button
      id={`tab-${mode}`}
      role="tab"
      type="button"
      aria-selected={selected}
      aria-controls={`panel-${mode}`}
      tabIndex={selected ? 0 : -1}
      onClick={select}
      onKeyDown={navigate}
    >
      {label}
    </button>
  );
}
