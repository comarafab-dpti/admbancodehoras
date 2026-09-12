interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry<unknown>>();

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
      if (import.meta.env.DEV) console.info(`[Cache] miss: ${key}`);
      return undefined;
    }
    if (import.meta.env.DEV) console.info(`[Cache] hit: ${key}`);
    return entry.value as T;
  },

  set<T>(key: string, value: T, ttlMs: number): void {
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  invalidate(keyPattern: string): void {
    for (const key of entries.keys()) {
      if (key.startsWith(keyPattern)) entries.delete(key);
    }
  },

  clear(): void {
    entries.clear();
  },
};
