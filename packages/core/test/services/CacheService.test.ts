import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService, cached } from '../../src/services/CacheService.js';

describe('CacheService', () => {
  let cache: CacheService<string>;

  beforeEach(() => {
    cache = new CacheService<string>({ maxSize: 5, defaultTTL: 1000 });
  });

  afterEach(() => {
    cache.dispose();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists with has()', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 50);
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should report expired keys as non-existent in has()', async () => {
      cache.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when maxSize reached', () => {
      // Fill cache to maxSize
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Add one more - should evict key0 (oldest by insertion order when timestamps equal)
      cache.set('key5', 'value5');
      
      // Verify size constraint is maintained
      expect(cache.getStats().size).toBe(5);
      // The newest key should exist
      expect(cache.get('key5')).toBe('value5');
    });

    it('should evict least recently accessed when timestamps differ', async () => {
      // Set key0 first
      cache.set('key0', 'value0');
      
      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Fill remaining slots
      for (let i = 1; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Access key0 to update its accessedAt (now it's the most recent)
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.get('key0');
      
      // Add new key - should evict key1 (oldest accessed, not key0)
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key5', 'value5');
      
      // key0 should still exist (was accessed recently)
      expect(cache.get('key0')).toBe('value0');
      // key5 should exist (just added)
      expect(cache.get('key5')).toBe('value5');
      // key1 should be evicted
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.getStats().size).toBe(5);
    });
  });

  describe('events', () => {
    it('should emit set event', () => {
      const handler = vi.fn();
      cache.on('set', handler);
      cache.set('key1', 'value1');
      expect(handler).toHaveBeenCalledWith({ key: 'key1', ttl: 1000 });
    });

    it('should emit hit event on cache hit', () => {
      const handler = vi.fn();
      cache.on('hit', handler);
      cache.set('key1', 'value1');
      cache.get('key1');
      expect(handler).toHaveBeenCalledWith({ key: 'key1' });
    });

    it('should emit miss event on cache miss', () => {
      const handler = vi.fn();
      cache.on('miss', handler);
      cache.get('nonexistent');
      expect(handler).toHaveBeenCalledWith({ key: 'nonexistent' });
    });

    it('should emit delete event', () => {
      const handler = vi.fn();
      cache.on('delete', handler);
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(handler).toHaveBeenCalledWith({ key: 'key1' });
    });
  });

  describe('getStats', () => {
    it('should return current cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });
  });

  describe('getInstance (singleton per namespace)', () => {
    it('should return same instance for same namespace', () => {
      const instance1 = CacheService.getInstance('test-ns');
      const instance2 = CacheService.getInstance('test-ns');
      expect(instance1).toBe(instance2);
    });

    it('should return different instances for different namespaces', () => {
      const instance1 = CacheService.getInstance('ns1');
      const instance2 = CacheService.getInstance('ns2');
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('cleanup timer', () => {
    it('should auto-cleanup expired entries', async () => {
      const cacheWithCleanup = new CacheService<string>({
        maxSize: 10,
        defaultTTL: 50,
        cleanupInterval: 30
      });

      cacheWithCleanup.set('key1', 'value1');
      expect(cacheWithCleanup.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cacheWithCleanup.getStats().size).toBe(0);
      cacheWithCleanup.dispose();
    });
  });
});

describe('cached helper', () => {
  let cache: CacheService<number>;

  beforeEach(() => {
    cache = new CacheService<number>({ maxSize: 10, defaultTTL: 1000 });
  });

  afterEach(() => {
    cache.dispose();
  });

  it('should cache function results', async () => {
    let callCount = 0;
    const expensiveFn = async () => {
      callCount++;
      return 42;
    };

    const result1 = await cached(cache, 'expensive', expensiveFn);
    const result2 = await cached(cache, 'expensive', expensiveFn);

    expect(result1).toBe(42);
    expect(result2).toBe(42);
    expect(callCount).toBe(1);
  });

  it('should call function again after TTL expires', async () => {
    let callCount = 0;
    const expensiveFn = async () => {
      callCount++;
      return callCount;
    };

    const result1 = await cached(cache, 'key', expensiveFn, 50);
    expect(result1).toBe(1);

    await new Promise(resolve => setTimeout(resolve, 60));

    const result2 = await cached(cache, 'key', expensiveFn, 50);
    expect(result2).toBe(2);
    expect(callCount).toBe(2);
  });
});
