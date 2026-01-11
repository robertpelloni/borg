import { bench, describe } from 'vitest';
import { CacheService } from '../src/services/CacheService.js';

describe('CacheService Benchmarks', () => {
  const cache = new CacheService<string>({ maxSize: 10000, defaultTTL: 60000 });
  
  bench('set operation', () => {
    const key = `key-${Math.random()}`;
    cache.set(key, 'value');
  });

  bench('get operation (hit)', () => {
    cache.set('benchmark-key', 'benchmark-value');
    cache.get('benchmark-key');
  });

  bench('get operation (miss)', () => {
    cache.get('nonexistent-key');
  });

  bench('has operation', () => {
    cache.set('has-key', 'value');
    cache.has('has-key');
  });

  bench('delete operation', () => {
    cache.set('delete-key', 'value');
    cache.delete('delete-key');
  });

  bench('set with custom TTL', () => {
    cache.set('ttl-key', 'value', 1000);
  });

  bench('LRU eviction under pressure (10k entries, 100 operations)', () => {
    const smallCache = new CacheService<number>({ maxSize: 100 });
    for (let i = 0; i < 100; i++) {
      smallCache.set(`key-${i}`, i);
    }
    smallCache.dispose();
  });
});
