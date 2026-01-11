import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { CLIRegistry, CLIType, CLITool } from './CLIRegistry.js';

export type SessionStatus = 'idle' | 'starting' | 'running' | 'paused' | 'stopped' | 'error' | 'completed';
export type SessionHealthStatus = 'healthy' | 'degraded' | 'unresponsive' | 'crashed';

export interface SessionLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface SessionHealth {
  status: SessionHealthStatus;
  lastCheck: number;
  consecutiveFailures: number;
  restartCount: number;
  lastRestartAt?: number;
  errorMessage?: string;
}

export interface ManagedSession {
  id: string;
  cliType: CLIType;
  status: SessionStatus;
  port: number;
  workingDirectory: string;
  process?: ChildProcess;
  pid?: number;
  startedAt: number;
  lastActivity: number;
  logs: SessionLogEntry[];
  health: SessionHealth;
  tags: string[];
  templateName?: string;
  env: Record<string, string>;
  currentTask?: string;
  metadata: Record<string, unknown>;
}

export interface SessionConfig {
  cliType: CLIType;
  workingDirectory: string;
  port?: number;
  tags?: string[];
  templateName?: string;
  env?: Record<string, string>;
  autoRestart?: boolean;
  maxRestarts?: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  maxFailures: number;
}

export interface CrashRecoveryConfig {
  enabled: boolean;
  maxRestartAttempts: number;
  restartDelayMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface SessionPersistenceConfig {
  enabled: boolean;
  filePath: string;
  autoSaveIntervalMs: number;
  autoResumeOnStart: boolean;
}

export interface BulkSessionRequest {
  count: number;
  template?: string;
  tags?: string[];
  staggerDelayMs?: number;
  cliType?: CLIType;
  workingDirectory?: string;
}

export interface BulkSessionResponse {
  sessions: ManagedSession[];
  failed: Array<{ index: number; error: string }>;
}

export interface CLISessionManagerEvents {
  'session:created': (session: ManagedSession) => void;
  'session:started': (session: ManagedSession) => void;
  'session:stopped': (session: ManagedSession) => void;
  'session:error': (session: ManagedSession, error: Error) => void;
  'session:health': (session: ManagedSession, health: SessionHealth) => void;
  'session:restarted': (session: ManagedSession) => void;
  'session:log': (sessionId: string, entry: SessionLogEntry) => void;
  'bulk:started': (response: BulkSessionResponse) => void;
  'bulk:stopped': (count: number) => void;
}

export class CLISessionManager extends EventEmitter {
  private sessions: Map<string, ManagedSession> = new Map();
  private cliRegistry: CLIRegistry;
  private healthCheckInterval?: NodeJS.Timeout;
  private persistenceInterval?: NodeJS.Timeout;
  private nextPort: number = 4000;
  
  private healthConfig: HealthCheckConfig = {
    enabled: true,
    intervalMs: 30000,
    timeoutMs: 5000,
    maxFailures: 3,
  };
  
  private recoveryConfig: CrashRecoveryConfig = {
    enabled: true,
    maxRestartAttempts: 3,
    restartDelayMs: 1000,
    backoffMultiplier: 2,
    maxBackoffMs: 30000,
  };
  
  private persistenceConfig: SessionPersistenceConfig = {
    enabled: false,
    filePath: './data/sessions.json',
    autoSaveIntervalMs: 60000,
    autoResumeOnStart: false,
  };

  constructor(cliRegistry?: CLIRegistry) {
    super();
    this.cliRegistry = cliRegistry || new CLIRegistry();
  }

  async initialize(): Promise<void> {
    await this.cliRegistry.detectAll();
    
    if (this.healthConfig.enabled) {
      this.startHealthMonitoring();
    }
    
    if (this.persistenceConfig.enabled) {
      this.startPersistence();
      if (this.persistenceConfig.autoResumeOnStart) {
        await this.loadAndResumeSessions();
      }
    }
  }

  async createSession(config: SessionConfig): Promise<ManagedSession> {
    const id = this.generateSessionId();
    const port = config.port || this.allocatePort();
    
    const session: ManagedSession = {
      id,
      cliType: config.cliType,
      status: 'idle',
      port,
      workingDirectory: path.resolve(config.workingDirectory),
      startedAt: Date.now(),
      lastActivity: Date.now(),
      logs: [],
      health: {
        status: 'healthy',
        lastCheck: Date.now(),
        consecutiveFailures: 0,
        restartCount: 0,
      },
      tags: config.tags || [],
      templateName: config.templateName,
      env: config.env || {},
      metadata: {},
    };
    
    this.sessions.set(id, session);
    this.emit('session:created', session);
    this.addLog(id, 'info', `Session created with CLI type: ${config.cliType}`);
    
    return session;
  }

  async startSession(sessionId: string): Promise<ManagedSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.status === 'running') {
      return session;
    }
    
    const tool = this.cliRegistry.getTool(session.cliType);
    if (!tool || !tool.available) {
      throw new Error(`CLI tool not available: ${session.cliType}`);
    }
    
    session.status = 'starting';
    this.addLog(sessionId, 'info', `Starting session on port ${session.port}`);
    
    try {
      const serveCmd = this.cliRegistry.getServeCommand(session.cliType, session.port);
      if (!serveCmd) {
        throw new Error(`Cannot get serve command for: ${session.cliType}`);
      }
      
      const env = {
        ...process.env,
        ...session.env,
        PORT: String(session.port),
      };
      
      const proc = spawn(serveCmd.command, serveCmd.args, {
        cwd: session.workingDirectory,
        env,
        shell: true,
        windowsHide: true,
      });
      
      session.process = proc;
      session.pid = proc.pid;
      session.status = 'running';
      session.lastActivity = Date.now();
      
      proc.stdout?.on('data', (data: Buffer) => {
        this.addLog(sessionId, 'info', data.toString().trim(), 'stdout');
      });
      
      proc.stderr?.on('data', (data: Buffer) => {
        this.addLog(sessionId, 'error', data.toString().trim(), 'stderr');
      });
      
      proc.on('close', (code: number | null) => {
        this.handleProcessExit(sessionId, code);
      });
      
      proc.on('error', (error: Error) => {
        this.handleProcessError(sessionId, error);
      });
      
      this.emit('session:started', session);
      this.addLog(sessionId, 'info', `Session started with PID: ${proc.pid}`);
      
      return session;
    } catch (error) {
      session.status = 'error';
      session.health.status = 'crashed';
      session.health.errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('session:error', session, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.process && session.status === 'running') {
      this.addLog(sessionId, 'info', 'Stopping session');
      
      session.process.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
        
        session.process?.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    
    session.status = 'stopped';
    session.process = undefined;
    session.pid = undefined;
    session.lastActivity = Date.now();
    
    this.emit('session:stopped', session);
    this.addLog(sessionId, 'info', 'Session stopped');
  }

  async restartSession(sessionId: string): Promise<ManagedSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    await this.stopSession(sessionId);
    
    const delay = this.calculateRestartDelay(session.health.restartCount);
    await this.sleep(delay);
    
    session.health.restartCount++;
    session.health.lastRestartAt = Date.now();
    
    const result = await this.startSession(sessionId);
    this.emit('session:restarted', result);
    
    return result;
  }

  async removeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    if (session.status === 'running') {
      await this.stopSession(sessionId);
    }
    
    this.sessions.delete(sessionId);
    this.addLog(sessionId, 'info', 'Session removed');
  }

  async bulkStartSessions(request: BulkSessionRequest): Promise<BulkSessionResponse> {
    const response: BulkSessionResponse = {
      sessions: [],
      failed: [],
    };
    
    const cliType = request.cliType || this.cliRegistry.getDefaultCLI();
    const workDir = request.workingDirectory || process.cwd();
    
    for (let i = 0; i < request.count; i++) {
      try {
        const session = await this.createSession({
          cliType,
          workingDirectory: workDir,
          tags: request.tags,
          templateName: request.template,
        });
        
        await this.startSession(session.id);
        response.sessions.push(session);
        
        if (request.staggerDelayMs && i < request.count - 1) {
          await this.sleep(request.staggerDelayMs);
        }
      } catch (error) {
        response.failed.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    this.emit('bulk:started', response);
    return response;
  }

  async bulkStopSessions(sessionIds?: string[]): Promise<number> {
    const ids = sessionIds || Array.from(this.sessions.keys());
    let stoppedCount = 0;
    
    await Promise.all(
      ids.map(async (id) => {
        try {
          await this.stopSession(id);
          stoppedCount++;
        } catch {
          // Ignore errors during bulk stop
        }
      })
    );
    
    this.emit('bulk:stopped', stoppedCount);
    return stoppedCount;
  }

  getSession(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ManagedSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionsByTag(tag: string): ManagedSession[] {
    return this.getAllSessions().filter(s => s.tags.includes(tag));
  }

  getSessionsByStatus(status: SessionStatus): ManagedSession[] {
    return this.getAllSessions().filter(s => s.status === status);
  }

  getSessionsByCLI(cliType: CLIType): ManagedSession[] {
    return this.getAllSessions().filter(s => s.cliType === cliType);
  }

  getRunningSessions(): ManagedSession[] {
    return this.getSessionsByStatus('running');
  }

  addTag(sessionId: string, tag: string): void {
    const session = this.sessions.get(sessionId);
    if (session && !session.tags.includes(tag)) {
      session.tags.push(tag);
    }
  }

  removeTag(sessionId: string, tag: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.tags = session.tags.filter(t => t !== tag);
    }
  }

  setSessionEnv(sessionId: string, key: string, value: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.env[key] = value;
    }
  }

  setCurrentTask(sessionId: string, task: string | undefined): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentTask = task;
      session.lastActivity = Date.now();
    }
  }

  getSessionLogs(sessionId: string, limit?: number): SessionLogEntry[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    if (limit) {
      return session.logs.slice(-limit);
    }
    return [...session.logs];
  }

  clearSessionLogs(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.logs = [];
    }
  }

  configureHealthCheck(config: Partial<HealthCheckConfig>): void {
    this.healthConfig = { ...this.healthConfig, ...config };
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.healthConfig.enabled) {
      this.startHealthMonitoring();
    }
  }

  configureRecovery(config: Partial<CrashRecoveryConfig>): void {
    this.recoveryConfig = { ...this.recoveryConfig, ...config };
  }

  configurePersistence(config: Partial<SessionPersistenceConfig>): void {
    this.persistenceConfig = { ...this.persistenceConfig, ...config };
    
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
    }
    
    if (this.persistenceConfig.enabled) {
      this.startPersistence();
    }
  }

  getStats(): {
    total: number;
    running: number;
    stopped: number;
    error: number;
    byCLI: Record<string, number>;
  } {
    const sessions = this.getAllSessions();
    const byCLI: Record<string, number> = {};
    
    for (const session of sessions) {
      byCLI[session.cliType] = (byCLI[session.cliType] || 0) + 1;
    }
    
    return {
      total: sessions.length,
      running: sessions.filter(s => s.status === 'running').length,
      stopped: sessions.filter(s => s.status === 'stopped').length,
      error: sessions.filter(s => s.status === 'error').length,
      byCLI,
    };
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
    }
    
    if (this.persistenceConfig.enabled) {
      await this.saveSessions();
    }
    
    await this.bulkStopSessions();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private allocatePort(): number {
    return this.nextPort++;
  }

  private addLog(sessionId: string, level: SessionLogEntry['level'], message: string, source?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const entry: SessionLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      source,
    };
    
    session.logs.push(entry);
    
    const maxLogs = 1000;
    if (session.logs.length > maxLogs) {
      session.logs = session.logs.slice(-maxLogs);
    }
    
    this.emit('session:log', sessionId, entry);
  }

  private handleProcessExit(sessionId: string, code: number | null): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    this.addLog(sessionId, 'info', `Process exited with code: ${code}`);
    
    if (session.status === 'running') {
      session.status = code === 0 ? 'completed' : 'error';
      session.health.status = code === 0 ? 'healthy' : 'crashed';
      
      if (code !== 0 && this.recoveryConfig.enabled) {
        this.attemptRecovery(sessionId);
      }
    }
    
    session.process = undefined;
    session.pid = undefined;
  }

  private handleProcessError(sessionId: string, error: Error): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.status = 'error';
    session.health.status = 'crashed';
    session.health.errorMessage = error.message;
    
    this.addLog(sessionId, 'error', `Process error: ${error.message}`);
    this.emit('session:error', session, error);
    
    if (this.recoveryConfig.enabled) {
      this.attemptRecovery(sessionId);
    }
  }

  private async attemptRecovery(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    if (session.health.restartCount >= this.recoveryConfig.maxRestartAttempts) {
      this.addLog(sessionId, 'error', `Max restart attempts (${this.recoveryConfig.maxRestartAttempts}) reached`);
      return;
    }
    
    this.addLog(sessionId, 'info', `Attempting recovery (attempt ${session.health.restartCount + 1}/${this.recoveryConfig.maxRestartAttempts})`);
    
    try {
      await this.restartSession(sessionId);
    } catch (error) {
      this.addLog(sessionId, 'error', `Recovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateRestartDelay(restartCount: number): number {
    const delay = this.recoveryConfig.restartDelayMs * Math.pow(this.recoveryConfig.backoffMultiplier, restartCount);
    return Math.min(delay, this.recoveryConfig.maxBackoffMs);
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkAllSessionsHealth();
    }, this.healthConfig.intervalMs);
  }

  private async checkAllSessionsHealth(): Promise<void> {
    const runningSessions = this.getRunningSessions();
    
    await Promise.all(
      runningSessions.map(session => this.checkSessionHealth(session.id))
    );
  }

  private async checkSessionHealth(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') return;
    
    const healthEndpoint = this.cliRegistry.getHealthEndpoint(session.cliType);
    const url = `http://localhost:${session.port}${healthEndpoint}`;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.healthConfig.timeoutMs);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok) {
        session.health.status = 'healthy';
        session.health.consecutiveFailures = 0;
        session.health.errorMessage = undefined;
      } else {
        this.recordHealthFailure(session, `HTTP ${response.status}`);
      }
    } catch (error) {
      this.recordHealthFailure(session, error instanceof Error ? error.message : 'Unknown error');
    }
    
    session.health.lastCheck = Date.now();
    this.emit('session:health', session, session.health);
  }

  private recordHealthFailure(session: ManagedSession, error: string): void {
    session.health.consecutiveFailures++;
    session.health.errorMessage = error;
    
    if (session.health.consecutiveFailures >= this.healthConfig.maxFailures) {
      session.health.status = 'unresponsive';
      
      if (this.recoveryConfig.enabled) {
        this.attemptRecovery(session.id);
      }
    } else {
      session.health.status = 'degraded';
    }
  }

  private startPersistence(): void {
    this.persistenceInterval = setInterval(() => {
      this.saveSessions();
    }, this.persistenceConfig.autoSaveIntervalMs);
  }

  private async saveSessions(): Promise<void> {
    const sessions = this.getAllSessions().map(s => ({
      id: s.id,
      cliType: s.cliType,
      status: s.status,
      port: s.port,
      workingDirectory: s.workingDirectory,
      startedAt: s.startedAt,
      tags: s.tags,
      templateName: s.templateName,
      env: s.env,
      metadata: s.metadata,
    }));
    
    const dir = path.dirname(this.persistenceConfig.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      this.persistenceConfig.filePath,
      JSON.stringify(sessions, null, 2)
    );
  }

  private async loadAndResumeSessions(): Promise<void> {
    if (!fs.existsSync(this.persistenceConfig.filePath)) {
      return;
    }
    
    try {
      const data = fs.readFileSync(this.persistenceConfig.filePath, 'utf-8');
      const sessions = JSON.parse(data) as Array<{
        id: string;
        cliType: CLIType;
        status: SessionStatus;
        port: number;
        workingDirectory: string;
        tags?: string[];
        templateName?: string;
        env?: Record<string, string>;
      }>;
      
      for (const saved of sessions) {
        if (saved.status === 'running') {
          try {
            const session = await this.createSession({
              cliType: saved.cliType,
              workingDirectory: saved.workingDirectory,
              port: saved.port,
              tags: saved.tags,
              templateName: saved.templateName,
              env: saved.env,
            });
            
            await this.startSession(session.id);
          } catch (error) {
            console.error(`Failed to resume session ${saved.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const cliSessionManager = new CLISessionManager();
