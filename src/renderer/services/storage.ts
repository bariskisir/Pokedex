/** Provides resilient local persistence for favorites and bounded API response caching. */
export interface StoragePort {
  /** Reads a stored value, returning null when the key does not exist. */
  getItem(key: string): string | null;
  /** Persists a serialized value under the provided key. */
  setItem(key: string, value: string): void;
  /** Removes a stored value when it expires or becomes invalid. */
  removeItem(key: string): void;
}

/** Resolves browser storage without failing when persistence is unavailable. */
export function browserStorage(): StoragePort | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export class Preferences {
  private readonly storage: StoragePort | undefined;

  /** Accepts a storage adapter so preferences remain usable in restricted environments. */
  public constructor(storage?: StoragePort) {
    this.storage = storage;
  }

  /** Restores only positive integer Pokémon identifiers from saved favorites. */
  public favorites(): Set<number> {
    try {
      const raw: unknown = JSON.parse(this.storage?.getItem('pokedex:favorites:v1') ?? '[]');
      const favorites = new Set<number>();
      if (Array.isArray(raw))
        for (const id of raw)
          if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) favorites.add(id);
      return favorites;
    } catch {
      return new Set();
    }
  }

  /** Saves favorites and reports whether persistence succeeded. */
  public saveFavorites(favorites: ReadonlySet<number>): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem('pokedex:favorites:v1', JSON.stringify([...favorites]));
      return true;
    } catch {
      return false;
    }
  }
}

interface CacheEntry {
  expires: number;
  value: unknown;
}
const CACHE_KEY = 'pokedex:api:v1';
const MAX_ENTRIES = 100;
const MAX_BYTES = 2_000_000;

export class ResponseCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly storage: StoragePort | undefined;

  /** Restores a bounded cache while ignoring corrupt or expired stored entries. */
  public constructor(storage?: StoragePort) {
    this.storage = storage;
    try {
      const raw: unknown = JSON.parse(storage?.getItem(CACHE_KEY) ?? '[]');
      if (!Array.isArray(raw)) return;
      for (const pair of raw.slice(-MAX_ENTRIES)) {
        if (!Array.isArray(pair) || typeof pair[0] !== 'string') continue;
        const entry: unknown = pair[1];
        if (
          typeof entry === 'object' &&
          entry !== null &&
          'expires' in entry &&
          typeof entry.expires === 'number' &&
          entry.expires > Date.now() &&
          'value' in entry
        )
          this.entries.set(pair[0], { expires: entry.expires, value: entry.value });
      }
    } catch {
      /* An unavailable cache must never prevent browsing. */
    }
  }

  /** Returns a fresh cached response and promotes it to the most recent position. */
  public get(key: string): unknown {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires <= Date.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Stores a validated response with a one-day lifetime and bounded disk usage. */
  public set(key: string, value: unknown): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + 86_400_000 });
    while (this.entries.size > MAX_ENTRIES) this.evictOldest();
    let serialized = JSON.stringify([...this.entries]);
    while (serialized.length > MAX_BYTES && this.entries.size > 0) {
      this.evictOldest();
      serialized = JSON.stringify([...this.entries]);
    }
    try {
      this.storage?.setItem(CACHE_KEY, serialized);
    } catch {
      /* Keep the in-memory cache if disk storage is full. */
    }
  }

  /** Evicts the least recently used response. */
  private evictOldest(): void {
    const oldest = this.entries.keys().next().value;
    if (oldest !== undefined) this.entries.delete(oldest);
  }
}
