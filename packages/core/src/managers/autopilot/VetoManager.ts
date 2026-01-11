import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface Vote {
  supervisor: string;
  approved: boolean;
  confidence: number;
  weight: number;
  comment: string;
}

export interface CouncilDecision {
  approved: boolean;
  consensus: number;
  weightedConsensus?: number;
  votes: Vote[];
  reasoning: string;
  dissent?: string[];
}

export interface VetoRequest {
  id: string;
  debateId: string;
  sessionId: string;
  decision: CouncilDecision;
  taskDescription: string;
  reason?: string;
  requestedAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  resolvedAt?: number;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface VetoConfig {
  enabled: boolean;
  defaultTimeoutMs: number;
  requireReason: boolean;
  notifyOnCreate: boolean;
  notifyOnResolve: boolean;
  autoExpire: boolean;
  persistPath?: string;
}

export interface VetoManagerEvents {
  'veto:created': (request: VetoRequest) => void;
  'veto:approved': (request: VetoRequest) => void;
  'veto:rejected': (request: VetoRequest) => void;
  'veto:expired': (request: VetoRequest) => void;
  'veto:reminder': (request: VetoRequest, remainingMs: number) => void;
}

export class VetoManager extends EventEmitter {
  private requests: Map<string, VetoRequest> = new Map();
  private config: VetoConfig;
  private expirationCheckerInterval?: NodeJS.Timeout;

  constructor(config?: Partial<VetoConfig>) {
    super();
    
    this.config = {
      enabled: true,
      defaultTimeoutMs: 5 * 60 * 1000,
      requireReason: false,
      notifyOnCreate: true,
      notifyOnResolve: true,
      autoExpire: true,
      ...config,
    };
    
    if (this.config.autoExpire) {
      this.startExpirationChecker();
    }
  }

  configure(config: Partial<VetoConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.expirationCheckerInterval) {
      clearInterval(this.expirationCheckerInterval);
    }
    
    if (this.config.autoExpire) {
      this.startExpirationChecker();
    }
  }

  getConfig(): VetoConfig {
    return { ...this.config };
  }

  createVetoRequest(
    debateId: string,
    sessionId: string,
    decision: CouncilDecision,
    taskDescription: string,
    timeoutMs?: number
  ): VetoRequest {
    const id = this.generateRequestId();
    const now = Date.now();
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
    
    const request: VetoRequest = {
      id,
      debateId,
      sessionId,
      decision,
      taskDescription,
      requestedAt: now,
      expiresAt: now + timeout,
      status: 'pending',
    };
    
    this.requests.set(id, request);
    
    if (this.config.notifyOnCreate) {
      this.emit('veto:created', request);
    }
    
    return request;
  }

  approveVeto(requestId: string, approvedBy: string, reason?: string): VetoRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Veto request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Veto request already resolved: ${request.status}`);
    }
    
    if (this.config.requireReason && !reason) {
      throw new Error('Reason is required for veto approval');
    }
    
    request.status = 'approved';
    request.resolvedAt = Date.now();
    request.resolvedBy = approvedBy;
    request.reason = reason;
    
    if (this.config.notifyOnResolve) {
      this.emit('veto:approved', request);
    }
    
    return request;
  }

  rejectVeto(requestId: string, rejectedBy: string, reason?: string): VetoRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Veto request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Veto request already resolved: ${request.status}`);
    }
    
    if (this.config.requireReason && !reason) {
      throw new Error('Reason is required for veto rejection');
    }
    
    request.status = 'rejected';
    request.resolvedAt = Date.now();
    request.resolvedBy = rejectedBy;
    request.reason = reason;
    
    if (this.config.notifyOnResolve) {
      this.emit('veto:rejected', request);
    }
    
    return request;
  }

  getRequest(requestId: string): VetoRequest | undefined {
    return this.requests.get(requestId);
  }

  getPendingRequests(): VetoRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'pending');
  }

  getRequestsBySession(sessionId: string): VetoRequest[] {
    return Array.from(this.requests.values()).filter(r => r.sessionId === sessionId);
  }

  getRequestsByDebate(debateId: string): VetoRequest[] {
    return Array.from(this.requests.values()).filter(r => r.debateId === debateId);
  }

  getAllRequests(): VetoRequest[] {
    return Array.from(this.requests.values());
  }

  getRequestsByStatus(status: VetoRequest['status']): VetoRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === status);
  }

  deleteRequest(requestId: string): boolean {
    return this.requests.delete(requestId);
  }

  clearExpired(): number {
    let count = 0;
    for (const [id, request] of this.requests) {
      if (request.status === 'expired') {
        this.requests.delete(id);
        count++;
      }
    }
    return count;
  }

  clearAll(): void {
    this.requests.clear();
  }

  async waitForResolution(requestId: string, pollIntervalMs = 1000): Promise<VetoRequest> {
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const request = this.requests.get(requestId);
        if (!request) {
          reject(new Error(`Veto request not found: ${requestId}`));
          return;
        }
        
        if (request.status !== 'pending') {
          resolve(request);
          return;
        }
        
        setTimeout(checkStatus, pollIntervalMs);
      };
      
      checkStatus();
    });
  }

  getRemainingTime(requestId: string): number {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return 0;
    }
    return Math.max(0, request.expiresAt - Date.now());
  }

  extendTimeout(requestId: string, additionalMs: number): VetoRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Veto request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Cannot extend timeout for resolved request: ${request.status}`);
    }
    
    request.expiresAt += additionalMs;
    return request;
  }

  getStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    avgResolutionTimeMs: number;
  } {
    const all = this.getAllRequests();
    const resolved = all.filter(r => r.resolvedAt);
    
    let totalResolutionTime = 0;
    for (const r of resolved) {
      totalResolutionTime += (r.resolvedAt! - r.requestedAt);
    }
    
    return {
      total: all.length,
      pending: all.filter(r => r.status === 'pending').length,
      approved: all.filter(r => r.status === 'approved').length,
      rejected: all.filter(r => r.status === 'rejected').length,
      expired: all.filter(r => r.status === 'expired').length,
      avgResolutionTimeMs: resolved.length > 0 ? totalResolutionTime / resolved.length : 0,
    };
  }

  async save(): Promise<void> {
    if (!this.config.persistPath) {
      throw new Error('Persistence path not configured');
    }
    
    const data = Array.from(this.requests.values());
    const dir = path.dirname(this.config.persistPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.config.persistPath, JSON.stringify(data, null, 2));
  }

  async load(): Promise<void> {
    if (!this.config.persistPath || !fs.existsSync(this.config.persistPath)) {
      return;
    }
    
    try {
      const data = fs.readFileSync(this.config.persistPath, 'utf-8');
      const requests = JSON.parse(data) as VetoRequest[];
      
      this.requests.clear();
      for (const request of requests) {
        this.requests.set(request.id, request);
      }
    } catch (error) {
      console.error('Failed to load veto requests:', error);
    }
  }

  shutdown(): void {
    if (this.expirationCheckerInterval) {
      clearInterval(this.expirationCheckerInterval);
    }
  }

  private generateRequestId(): string {
    return `veto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private startExpirationChecker(): void {
    this.expirationCheckerInterval = setInterval(() => {
      this.checkExpirations();
    }, 10000);
  }

  private checkExpirations(): void {
    const now = Date.now();
    
    for (const request of this.requests.values()) {
      if (request.status !== 'pending') continue;
      
      if (now >= request.expiresAt) {
        request.status = 'expired';
        request.resolvedAt = now;
        this.emit('veto:expired', request);
      } else {
        const remaining = request.expiresAt - now;
        if (remaining <= 60000 && remaining > 50000) {
          this.emit('veto:reminder', request, remaining);
        }
      }
    }
  }
}

export const vetoManager = new VetoManager();
