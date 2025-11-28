/**
 * Simple in-memory cache with TTL (Time To Live)
 * Used to reduce database load for frequently accessed, rarely changing data
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns The cached value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + ttlMs,
    });
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key to delete
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set pattern - returns cached value or fetches and caches new value
   * @param key - Cache key
   * @param fetcher - Async function to fetch data if not cached
   * @param ttlMs - Time to live in milliseconds
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache keys constants
export const CACHE_KEYS = {
  PRODUCT_BRANDS: 'products:brands',
  PRODUCT_CATEGORIES: 'products:categories',
  PRODUCT_SEASONS: 'products:seasons',
} as const;

// Default TTL: 5 minutes
export const DEFAULT_TTL = 5 * 60 * 1000;
