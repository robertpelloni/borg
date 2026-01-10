import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

type AuditEventType = 
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'secret.access'
  | 'secret.rotate'
  | 'secret.create'
  | 'secret.delete'
  | 'tool.execute'
  | 'tool.blocked'
  | 'config.change'
  | 'admin.action';

interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  actor: string;
  resource?: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked';
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

interface AuditServiceOptions {
  logDir: string;
  retentionDays?: number;
  maxFileSize?: number;
}

export class AuditService extends EventEmitter {
  private static instance: AuditService;
  private logDir: string;
  private retentionDays: number;
  private maxFileSize: number;
  private currentLogFile: string;
  private buffer: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor(options: AuditServiceOptions) {
    super();
    this.logDir = options.logDir;
    this.retentionDays = options.retentionDays || 90;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024;
    this.currentLogFile = this.getLogFileName();
    
    this.ensureLogDir();
    this.startFlushTimer();
  }

  static getInstance(options?: AuditServiceOptions): AuditService {
    if (!AuditService.instance) {
      if (!options) {
        options = { logDir: path.join(process.cwd(), 'data', 'audit') };
      }
      AuditService.instance = new AuditService(options);
    }
    return AuditService.instance;
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `audit-${date}.jsonl`);
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const fullEvent: AuditEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...event
    };

    this.buffer.push(fullEvent);
    this.emit('event', fullEvent);

    if (this.buffer.length >= 100) {
      this.flush();
    }
  }

  logAuth(actor: string, action: 'login' | 'logout' | 'failed', metadata?: Record<string, unknown>): void {
    this.log({
      type: `auth.${action}` as AuditEventType,
      actor,
      action,
      outcome: action === 'failed' ? 'failure' : 'success',
      metadata
    });
  }

  logSecretAccess(actor: string, secretKey: string, action: 'access' | 'rotate' | 'create' | 'delete'): void {
    this.log({
      type: `secret.${action}` as AuditEventType,
      actor,
      resource: secretKey,
      action,
      outcome: 'success'
    });
  }

  logToolExecution(actor: string, toolName: string, outcome: 'success' | 'failure' | 'blocked', metadata?: Record<string, unknown>): void {
    this.log({
      type: outcome === 'blocked' ? 'tool.blocked' : 'tool.execute',
      actor,
      resource: toolName,
      action: 'execute',
      outcome,
      metadata
    });
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), 5000);
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const newLogFile = this.getLogFileName();
    if (newLogFile !== this.currentLogFile) {
      this.currentLogFile = newLogFile;
    }

    const lines = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(this.currentLogFile, lines);
    this.buffer = [];
  }

  async query(options: { 
    startTime?: number; 
    endTime?: number; 
    type?: AuditEventType;
    actor?: string;
    limit?: number 
  }): Promise<AuditEvent[]> {
    const results: AuditEvent[] = [];
    const files = fs.readdirSync(this.logDir).filter(f => f.startsWith('audit-'));
    
    for (const file of files.reverse()) {
      const content = fs.readFileSync(path.join(this.logDir, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines.reverse()) {
        try {
          const event: AuditEvent = JSON.parse(line);
          
          if (options.startTime && event.timestamp < options.startTime) continue;
          if (options.endTime && event.timestamp > options.endTime) continue;
          if (options.type && event.type !== options.type) continue;
          if (options.actor && event.actor !== options.actor) continue;
          
          results.push(event);
          
          if (options.limit && results.length >= options.limit) {
            return results;
          }
        } catch {
        }
      }
    }
    
    return results;
  }

  async cleanup(): Promise<number> {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(this.logDir).filter(f => f.startsWith('audit-'));
    let removed = 0;

    for (const file of files) {
      const match = file.match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (match) {
        const fileDate = new Date(match[1]).getTime();
        if (fileDate < cutoff) {
          fs.unlinkSync(path.join(this.logDir, file));
          removed++;
        }
      }
    }

    return removed;
  }

  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
