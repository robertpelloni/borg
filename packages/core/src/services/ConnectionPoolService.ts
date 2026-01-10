import { EventEmitter } from 'events';

interface PooledConnection<T> {
  id: string;
  connection: T;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

interface PoolConfig {
  minSize: number;
  maxSize: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
}

const DEFAULT_CONFIG: PoolConfig = {
  minSize: 2,
  maxSize: 10,
  acquireTimeout: 30000,
  idleTimeout: 60000,
  maxLifetime: 3600000
};

export class ConnectionPool<T> extends EventEmitter {
  private pool: PooledConnection<T>[] = [];
  private waitQueue: Array<{ resolve: (conn: T) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }> = [];
  private config: PoolConfig;
  private factory: () => Promise<T>;
  private destroyer: (conn: T) => Promise<void>;
  private validator: (conn: T) => Promise<boolean>;
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private idCounter = 0;

  constructor(
    factory: () => Promise<T>,
    destroyer: (conn: T) => Promise<void>,
    validator: (conn: T) => Promise<boolean>,
    config: Partial<PoolConfig> = {}
  ) {
    super();
    this.factory = factory;
    this.destroyer = destroyer;
    this.validator = validator;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    const createPromises = [];
    for (let i = 0; i < this.config.minSize; i++) {
      createPromises.push(this.createConnection());
    }
    await Promise.all(createPromises);
    this.startMaintenance();
  }

  private async createConnection(): Promise<PooledConnection<T>> {
    const connection = await this.factory();
    const pooled: PooledConnection<T> = {
      id: `conn_${++this.idCounter}`,
      connection,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      inUse: false
    };
    this.pool.push(pooled);
    this.emit('connectionCreated', { id: pooled.id });
    return pooled;
  }

  async acquire(): Promise<T> {
    const available = this.pool.find(p => !p.inUse);
    
    if (available) {
      const isValid = await this.validator(available.connection);
      if (isValid) {
        available.inUse = true;
        available.lastUsedAt = Date.now();
        this.emit('connectionAcquired', { id: available.id });
        return available.connection;
      } else {
        await this.removeConnection(available);
      }
    }

    if (this.pool.length < this.config.maxSize) {
      const newConn = await this.createConnection();
      newConn.inUse = true;
      this.emit('connectionAcquired', { id: newConn.id });
      return newConn.connection;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (idx !== -1) {
          this.waitQueue.splice(idx, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitQueue.push({ resolve, reject, timeout });
    });
  }

  release(connection: T): void {
    const pooled = this.pool.find(p => p.connection === connection);
    if (!pooled) return;

    pooled.inUse = false;
    pooled.lastUsedAt = Date.now();
    this.emit('connectionReleased', { id: pooled.id });

    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      clearTimeout(waiter.timeout);
      pooled.inUse = true;
      waiter.resolve(pooled.connection);
    }
  }

  private async removeConnection(pooled: PooledConnection<T>): Promise<void> {
    const idx = this.pool.indexOf(pooled);
    if (idx !== -1) {
      this.pool.splice(idx, 1);
      try {
        await this.destroyer(pooled.connection);
      } catch {
      }
      this.emit('connectionDestroyed', { id: pooled.id });
    }
  }

  private startMaintenance(): void {
    this.maintenanceTimer = setInterval(async () => {
      const now = Date.now();

      for (const pooled of [...this.pool]) {
        if (pooled.inUse) continue;

        const isExpired = now - pooled.createdAt > this.config.maxLifetime;
        const isIdle = now - pooled.lastUsedAt > this.config.idleTimeout && this.pool.length > this.config.minSize;

        if (isExpired || isIdle) {
          await this.removeConnection(pooled);
        }
      }

      while (this.pool.length < this.config.minSize) {
        try {
          await this.createConnection();
        } catch {
          break;
        }
      }
    }, 30000);
  }

  getStats(): { total: number; available: number; inUse: number; waiting: number } {
    return {
      total: this.pool.length,
      available: this.pool.filter(p => !p.inUse).length,
      inUse: this.pool.filter(p => p.inUse).length,
      waiting: this.waitQueue.length
    };
  }

  async drain(): Promise<void> {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }

    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Pool is draining'));
    }
    this.waitQueue = [];

    for (const pooled of this.pool) {
      try {
        await this.destroyer(pooled.connection);
      } catch {
      }
    }
    this.pool = [];
    this.emit('drained');
  }
}

export class ConnectionPoolManager {
  private static pools: Map<string, ConnectionPool<unknown>> = new Map();

  static register<T>(name: string, pool: ConnectionPool<T>): void {
    ConnectionPoolManager.pools.set(name, pool as ConnectionPool<unknown>);
  }

  static get<T>(name: string): ConnectionPool<T> | undefined {
    return ConnectionPoolManager.pools.get(name) as ConnectionPool<T> | undefined;
  }

  static getAllStats(): Record<string, ReturnType<ConnectionPool<unknown>['getStats']>> {
    const stats: Record<string, ReturnType<ConnectionPool<unknown>['getStats']>> = {};
    for (const [name, pool] of ConnectionPoolManager.pools) {
      stats[name] = pool.getStats();
    }
    return stats;
  }

  static async drainAll(): Promise<void> {
    for (const pool of ConnectionPoolManager.pools.values()) {
      await pool.drain();
    }
    ConnectionPoolManager.pools.clear();
  }
}
