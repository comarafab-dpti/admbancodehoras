interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry<unknown>>();
const metrics = { hits: 0, misses: 0, invalidations: 0 };

function purgeExpired(): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

export const queryCache = {
  get<T>(key: string): T | undefined {
    purgeExpired();
    const entry = entries.get(key);
    if (!entry) {
      metrics.misses += 1;
      if (import.meta.env.DEV) console.info(`[Cache] miss: ${key}`);
      return undefined;
    }
    metrics.hits += 1;
    if (import.meta.env.DEV) console.info(`[Cache] hit: ${key}`);
    return entry.value as T;
  },

  set<T>(key: string, value: T, ttlMs: number): void {
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  invalidate(keyPattern: string): void {
    let invalidated = 0;
    for (const key of entries.keys()) {
      if (key.startsWith(keyPattern)) {
        entries.delete(key);
        invalidated += 1;
      }
    }
    if (invalidated > 0) metrics.invalidations += invalidated;
    if (import.meta.env.DEV) console.info(`[Cache] invalidate: ${keyPattern} (${invalidated})`);
  },

  getMetrics() {
    return { ...metrics, size: entries.size };
  },

  clear(): void {
    entries.clear();
  },
};
