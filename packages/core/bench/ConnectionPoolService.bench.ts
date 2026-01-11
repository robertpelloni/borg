import { bench, describe } from 'vitest';
import { ConnectionPool } from '../src/services/ConnectionPoolService.js';

interface MockConnection {
  id: number;
}

describe('ConnectionPool Benchmarks', () => {
  let connectionId = 0;
  
  const createPool = () => new ConnectionPool<MockConnection>(
    async () => ({ id: ++connectionId }),
    async () => {},
    async () => true,
    { minSize: 5, maxSize: 20, acquireTimeout: 5000 }
  );

  bench('acquire and release', async () => {
    const pool = createPool();
    await pool.initialize();
    const conn = await pool.acquire();
    pool.release(conn);
    await pool.drain();
  });

  bench('acquire multiple connections', async () => {
    const pool = createPool();
    await pool.initialize();
    const connections = await Promise.all([
      pool.acquire(),
      pool.acquire(),
      pool.acquire()
    ]);
    connections.forEach(c => pool.release(c));
    await pool.drain();
  });

  bench('getStats', async () => {
    const pool = createPool();
    await pool.initialize();
    pool.getStats();
    await pool.drain();
  });

  bench('initialize pool', async () => {
    const pool = createPool();
    await pool.initialize();
    await pool.drain();
  });
});
