import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export interface TrafficLog {
    id: string;
    timestamp: number;
    type: 'request' | 'response' | 'error';
    tool?: string;
    server?: string;
    args?: any;
    result?: any;
    error?: any;
    cost?: number;
    tokens?: number;
}

export class LogManager extends EventEmitter {
    private db: Database.Database;

    constructor(logDir?: string) {
        super();
        const dir = logDir || path.join(process.cwd(), 'logs');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const dbPath = path.join(dir, 'traffic.db');
        this.db = new Database(dbPath);
        this.initDb();
    }

    private initDb() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                timestamp INTEGER,
                type TEXT,
                tool TEXT,
                server TEXT,
                args TEXT,
                result TEXT,
                error TEXT,
                cost REAL,
                tokens INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_type ON logs(type);
            CREATE INDEX IF NOT EXISTS idx_tool ON logs(tool);
        `);
    }

    public log(entry: Omit<TrafficLog, 'id' | 'timestamp'>) {
        const fullEntry: TrafficLog = {
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            ...entry
        };
        
        // Emit to subscribers (Socket.io)
        this.emit('log', fullEntry);

        // Persist to DB
        this.insertLog(fullEntry);
    }

    private insertLog(entry: TrafficLog) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO logs (id, timestamp, type, tool, server, args, result, error, cost, tokens)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                entry.id,
                entry.timestamp,
                entry.type,
                entry.tool || null,
                entry.server || null,
                entry.args ? JSON.stringify(entry.args) : null,
                entry.result ? JSON.stringify(entry.result) : null,
                entry.error ? JSON.stringify(entry.error) : null,
                entry.cost || 0,
                entry.tokens || 0
            );
        } catch (e) {
            console.error('[LogManager] Failed to write log:', e);
        }
    }

    public async getLogs(filter: { 
        limit?: number, 
        type?: string, 
        tool?: string,
        startTime?: number,
        endTime?: number
    } = {}): Promise<TrafficLog[]> {
        let query = 'SELECT * FROM logs WHERE 1=1';
        const params: any[] = [];

        if (filter.type) {
            query += ' AND type = ?';
            params.push(filter.type);
        }
        if (filter.tool) {
            query += ' AND tool = ?';
            params.push(filter.tool);
        }
        if (filter.startTime) {
            query += ' AND timestamp >= ?';
            params.push(filter.startTime);
        }
        if (filter.endTime) {
            query += ' AND timestamp <= ?';
            params.push(filter.endTime);
        }

        query += ' ORDER BY timestamp DESC';

        if (filter.limit) {
            query += ' LIMIT ?';
            params.push(filter.limit);
        }

        try {
            const stmt = this.db.prepare(query);
            const rows = stmt.all(...params) as any[];
            
            return rows.map(row => ({
                id: row.id,
                timestamp: row.timestamp,
                type: row.type,
                tool: row.tool,
                server: row.server,
                args: row.args ? JSON.parse(row.args) : undefined,
                result: row.result ? JSON.parse(row.result) : undefined,
                error: row.error ? JSON.parse(row.error) : undefined,
                cost: row.cost,
                tokens: row.tokens
            }));
        } catch (e) {
            console.error('[LogManager] Failed to query logs:', e);
            return [];
        }
    }

    public close() {
        try {
            this.db.close();
        } catch (e) {
            console.error('[LogManager] Failed to close DB:', e);
        }
    }

    public calculateCost(model: string, inputTokens: number, outputTokens: number): number {
        // Placeholder pricing (approximate)
        const prices: Record<string, { in: number, out: number }> = {
            'gpt-4-turbo': { in: 0.01, out: 0.03 }, // per 1k
            'gpt-3.5-turbo': { in: 0.0005, out: 0.0015 },
            'claude-3-opus': { in: 0.015, out: 0.075 },
            'claude-3-sonnet': { in: 0.003, out: 0.015 }
        };

        const price = prices[model] || prices['gpt-3.5-turbo'];
        return (inputTokens / 1000 * price.in) + (outputTokens / 1000 * price.out);
    }
}
