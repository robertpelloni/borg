import { EventEmitter } from 'events';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
}

interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
  cleanupInterval?: number;
}

export class CacheService<T = unknown> extends EventEmitter {
  private static instances: Map<string, CacheService> = new Map();
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    super();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000;
    
    if (options.cleanupInterval) {
      this.startCleanup(options.cleanupInterval);
    }
  }

  static getInstance<T>(namespace: string, options?: CacheOptions): CacheService<T> {
    if (!CacheService.instances.has(namespace)) {
      CacheService.instances.set(namespace, new CacheService<T>(options));
    }
    return CacheService.instances.get(namespace) as CacheService<T>;
  }

  set(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttl || this.defaultTTL),
      accessedAt: now
    });
    
    this.emit('set', { key, ttl: ttl || this.defaultTTL });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.emit('miss', { key });
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.emit('expired', { key });
      return undefined;
    }

    entry.accessedAt = Date.now();
    this.emit('hit', { key });
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit('delete', { key });
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.emit('clear', { entriesCleared: size });
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.emit('evict', { key: oldestKey });
    }
  }

  private startCleanup(interval: number): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.emit('cleanup', { entriesRemoved: cleaned });
      }
    }, interval);
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

export async function cached<T>(
  cache: CacheService<T>,
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const existing = cache.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const value = await fn();
  cache.set(key, value, ttl);
  return value;
}
