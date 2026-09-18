/** Verifies resilient favorite persistence, corrupt-cache recovery, and cache expiry. */
import { expect, test, vi } from 'vitest';
import { Preferences, ResponseCache, type StoragePort } from '../../src/renderer/services/storage';

class MemoryStorage implements StoragePort {
  private readonly values = new Map<string, string>();
  /** Reads an in-memory value for deterministic persistence tests. */
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  /** Stores a serialized test value. */
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  /** Removes a test value. */
  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

/** Ignores invalid favorite values and survives corrupt browser storage. */
test('restores and validates favorite identifiers', function testFavorites() {
  const storage = new MemoryStorage();
  storage.setItem('pokedex:favorites:v1', '[25,906,-1,"bad",null,25]');
  const preferences = new Preferences(storage);
  expect([...preferences.favorites()]).toEqual([25, 906]);
  expect(preferences.saveFavorites(new Set([10001]))).toBe(true);
  expect([...new Preferences(storage).favorites()]).toEqual([10001]);
  storage.setItem('pokedex:favorites:v1', '{broken');
  expect(preferences.favorites().size).toBe(0);
  expect(new Preferences().saveFavorites(new Set([25]))).toBe(false);
});

/** Persists resources across instances and expires them after one day. */
test('persists cached resources and expires old responses', function testCacheLifetime() {
  const storage = new MemoryStorage();
  vi.useFakeTimers();
  try {
    const cache = new ResponseCache(storage);
    cache.set('pokemon/25', { id: 25 });
    expect(new ResponseCache(storage).get('pokemon/25')).toEqual({ id: 25 });
    vi.advanceTimersByTime(86_400_001);
    expect(cache.get('pokemon/25')).toBeUndefined();
    expect(new ResponseCache(storage).get('pokemon/25')).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

/** Evicts least-recently-used entries and tolerates malformed persisted data. */
test('bounds resource storage and recovers from corruption', function testCacheBounds() {
  const storage = new MemoryStorage();
  storage.setItem('pokedex:api:v1', 'null');
  const cache = new ResponseCache(storage);
  for (let id = 0; id < 101; id++) cache.set(String(id), { id });
  expect(cache.get('0')).toBeUndefined();
  expect(cache.get('100')).toEqual({ id: 100 });
  cache.set('oversized', 'x'.repeat(2_000_001));
  expect((storage.getItem('pokedex:api:v1') ?? '').length).toBeLessThanOrEqual(2_000_000);
});
