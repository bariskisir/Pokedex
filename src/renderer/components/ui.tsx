/** Provides reusable accessible type badges and shared display conventions. */
import { displayName } from '../domain/pokemon';

interface TypeBadgeProps {
  name: string;
  multiplier?: number;
  onSelect: (name: string) => void;
}

/** Renders a keyboard-accessible type filter with an optional defensive multiplier. */
export function TypeBadge({ name, multiplier, onSelect }: TypeBadgeProps) {
  /** Selects the badge's type without leaking DOM events to the controller. */
  function handleClick(): void {
    onSelect(name);
  }
  return (
    <button className="type-badge" data-type={name} type="button" onClick={handleClick}>
      {displayName(name)}
      {multiplier !== undefined && ` ×${multiplier}`}
    </button>
  );
}
