/**
 * Lightweight in-memory cache for server-side API routes.
 * Module-level state persists across requests within the same
 * Node.js process on Hostinger — eliminates redundant
 * external API calls (Yahoo Finance, Vontobel, Neon).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function memGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function memSet<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function memDel(key: string): void {
  cache.delete(key);
}
