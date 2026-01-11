import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPool, ConnectionPoolManager } from '../../src/services/ConnectionPoolService.js';

interface MockConnection {
  id: number;
  isValid: boolean;
}

describe('ConnectionPool', () => {
  let pool: ConnectionPool<MockConnection>;
  let connectionId = 0;

  const factory = vi.fn(async (): Promise<MockConnection> => ({
    id: ++connectionId,
    isValid: true
  }));

  const destroyer = vi.fn(async (_conn: MockConnection): Promise<void> => {});

  const validator = vi.fn(async (conn: MockConnection): Promise<boolean> => conn.isValid);

  beforeEach(() => {
    connectionId = 0;
    factory.mockClear();
    destroyer.mockClear();
    validator.mockClear();

    pool = new ConnectionPool<MockConnection>(
      factory,
      destroyer,
      validator,
      { minSize: 2, maxSize: 5, acquireTimeout: 1000, idleTimeout: 5000, maxLifetime: 60000 }
    );
  });

  afterEach(async () => {
    await pool.drain();
  });

  describe('initialization', () => {
    it('should create minimum connections on init', async () => {
      await pool.initialize();
      
      const stats = pool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.available).toBe(2);
      expect(stats.inUse).toBe(0);
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe('acquire', () => {
    it('should acquire available connection', async () => {
      await pool.initialize();
      
      const conn = await pool.acquire();
      
      expect(conn).toBeDefined();
      expect(conn.id).toBeGreaterThan(0);
      expect(pool.getStats().inUse).toBe(1);
    });

    it('should create new connection if none available and under max', async () => {
      await pool.initialize();
      
      await pool.acquire();
      await pool.acquire();
      const conn3 = await pool.acquire();
      
      expect(conn3).toBeDefined();
      expect(pool.getStats().total).toBe(3);
      expect(factory).toHaveBeenCalledTimes(3);
    });

    it('should wait when pool exhausted', async () => {
      const smallPool = new ConnectionPool<MockConnection>(
        factory,
        destroyer,
        validator,
        { minSize: 1, maxSize: 1, acquireTimeout: 500 }
      );
      
      await smallPool.initialize();
      
      const conn1 = await smallPool.acquire();
      const acquirePromise = smallPool.acquire();
      
      setTimeout(() => smallPool.release(conn1), 50);
      
      const conn2 = await acquirePromise;
      expect(conn2).toBeDefined();
      
      await smallPool.drain();
    });

    it('should timeout if no connection available', async () => {
      const smallPool = new ConnectionPool<MockConnection>(
        factory,
        destroyer,
        validator,
        { minSize: 1, maxSize: 1, acquireTimeout: 50 }
      );
      
      await smallPool.initialize();
      await smallPool.acquire();
      
      await expect(smallPool.acquire()).rejects.toThrow('Connection acquire timeout');
      
      await smallPool.drain();
    });

    it('should remove and recreate invalid connections', async () => {
      await pool.initialize();
      
      const conn = await pool.acquire();
      conn.isValid = false;
      pool.release(conn);
      
      const newConn = await pool.acquire();
      expect(newConn.isValid).toBe(true);
    });
  });

  describe('release', () => {
    it('should release connection back to pool', async () => {
      await pool.initialize();
      
      const conn = await pool.acquire();
      expect(pool.getStats().inUse).toBe(1);
      
      pool.release(conn);
      expect(pool.getStats().inUse).toBe(0);
      expect(pool.getStats().available).toBe(2);
    });

    it('should service waiting requests on release', async () => {
      const smallPool = new ConnectionPool<MockConnection>(
        factory,
        destroyer,
        validator,
        { minSize: 1, maxSize: 1, acquireTimeout: 1000 }
      );
      
      await smallPool.initialize();
      const conn1 = await smallPool.acquire();
      
      let resolved = false;
      const waitingPromise = smallPool.acquire().then(conn => {
        resolved = true;
        return conn;
      });
      
      expect(resolved).toBe(false);
      
      smallPool.release(conn1);
      
      await waitingPromise;
      expect(resolved).toBe(true);
      
      await smallPool.drain();
    });
  });

  describe('events', () => {
    it('should emit connectionCreated on new connection', async () => {
      const handler = vi.fn();
      pool.on('connectionCreated', handler);
      
      await pool.initialize();
      
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should emit connectionAcquired on acquire', async () => {
      const handler = vi.fn();
      pool.on('connectionAcquired', handler);
      
      await pool.initialize();
      await pool.acquire();
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit connectionReleased on release', async () => {
      const handler = vi.fn();
      pool.on('connectionReleased', handler);
      
      await pool.initialize();
      const conn = await pool.acquire();
      pool.release(conn);
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      await pool.initialize();
      
      const conn1 = await pool.acquire();
      await pool.acquire();
      
      const stats = pool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.inUse).toBe(2);
      expect(stats.available).toBe(0);
      expect(stats.waiting).toBe(0);
      
      pool.release(conn1);
      
      const stats2 = pool.getStats();
      expect(stats2.inUse).toBe(1);
      expect(stats2.available).toBe(1);
    });
  });

  describe('drain', () => {
    it('should close all connections', async () => {
      await pool.initialize();
      await pool.acquire();
      
      await pool.drain();
      
      expect(pool.getStats().total).toBe(0);
      expect(destroyer).toHaveBeenCalled();
    });

    it('should reject waiting requests', async () => {
      const smallPool = new ConnectionPool<MockConnection>(
        factory,
        destroyer,
        validator,
        { minSize: 1, maxSize: 1, acquireTimeout: 5000 }
      );
      
      await smallPool.initialize();
      await smallPool.acquire();
      
      const waitingPromise = smallPool.acquire();
      
      await smallPool.drain();
      
      await expect(waitingPromise).rejects.toThrow('Pool is draining');
    });
  });
});

describe('ConnectionPoolManager', () => {
  afterEach(async () => {
    await ConnectionPoolManager.drainAll();
  });

  it('should register and retrieve pools', async () => {
    const pool = new ConnectionPool<{ id: number }>(
      async () => ({ id: 1 }),
      async () => {},
      async () => true
    );
    
    ConnectionPoolManager.register('test-pool', pool);
    
    const retrieved = ConnectionPoolManager.get<{ id: number }>('test-pool');
    expect(retrieved).toBe(pool);
  });

  it('should return undefined for unregistered pool', () => {
    const pool = ConnectionPoolManager.get('nonexistent');
    expect(pool).toBeUndefined();
  });

  it('should get all pool stats', async () => {
    const pool1 = new ConnectionPool<{ id: number }>(
      async () => ({ id: 1 }),
      async () => {},
      async () => true,
      { minSize: 1, maxSize: 2 }
    );
    
    const pool2 = new ConnectionPool<{ id: number }>(
      async () => ({ id: 2 }),
      async () => {},
      async () => true,
      { minSize: 2, maxSize: 4 }
    );
    
    await pool1.initialize();
    await pool2.initialize();
    
    ConnectionPoolManager.register('pool1', pool1);
    ConnectionPoolManager.register('pool2', pool2);
    
    const allStats = ConnectionPoolManager.getAllStats();
    
    expect(allStats).toHaveProperty('pool1');
    expect(allStats).toHaveProperty('pool2');
    expect(allStats.pool1.total).toBe(1);
    expect(allStats.pool2.total).toBe(2);
  });

  it('should drain all pools', async () => {
    const destroyer = vi.fn(async () => {});
    
    const pool = new ConnectionPool<{ id: number }>(
      async () => ({ id: 1 }),
      destroyer,
      async () => true,
      { minSize: 2, maxSize: 5 }
    );
    
    await pool.initialize();
    ConnectionPoolManager.register('drain-test', pool);
    
    await ConnectionPoolManager.drainAll();
    
    expect(destroyer).toHaveBeenCalled();
    expect(ConnectionPoolManager.get('drain-test')).toBeUndefined();
  });
});
