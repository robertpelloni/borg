import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export type ConsensusMode = 
  | 'simple-majority'
  | 'supermajority'
  | 'unanimous'
  | 'weighted'
  | 'ceo-override'
  | 'ceo-veto'
  | 'hybrid-ceo-majority'
  | 'ranked-choice';

export type TaskType = 
  | 'security-audit'
  | 'ui-design'
  | 'api-design'
  | 'performance'
  | 'refactoring'
  | 'bug-fix'
  | 'testing'
  | 'documentation'
  | 'architecture'
  | 'code-review'
  | 'general';

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

export interface DebateRecord {
  id: string;
  sessionId: string;
  taskDescription: string;
  taskType: TaskType;
  decision: CouncilDecision;
  team: string[];
  leadSupervisor?: string;
  consensusMode: ConsensusMode;
  debateRounds: number;
  timestamp: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface DebateHistoryConfig {
  maxRecords: number;
  persistPath?: string;
  autoSaveIntervalMs: number;
  pruneOlderThanMs?: number;
}

export interface DebateAnalytics {
  totalDebates: number;
  approvalRate: number;
  avgConsensus: number;
  avgDurationMs: number;
  byTaskType: Record<TaskType, { count: number; approvalRate: number }>;
  byConsensusMode: Record<ConsensusMode, { count: number; approvalRate: number }>;
  bySupervisor: Record<string, { votes: number; approvals: number; avgConfidence: number }>;
  timeSeriesDaily: Array<{ date: string; debates: number; approvals: number }>;
}

export interface DebateHistoryEvents {
  'record:added': (record: DebateRecord) => void;
  'record:deleted': (recordId: string) => void;
  'history:pruned': (count: number) => void;
  'history:saved': () => void;
  'history:loaded': (count: number) => void;
}

export class DebateHistoryManager extends EventEmitter {
  private records: Map<string, DebateRecord> = new Map();
  private config: DebateHistoryConfig;
  private autoSaveInterval?: NodeJS.Timeout;

  constructor(config?: Partial<DebateHistoryConfig>) {
    super();
    
    this.config = {
      maxRecords: 10000,
      autoSaveIntervalMs: 60000,
      ...config,
    };
    
    if (this.config.persistPath && this.config.autoSaveIntervalMs > 0) {
      this.startAutoSave();
    }
  }

  configure(config: Partial<DebateHistoryConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    if (this.config.persistPath && this.config.autoSaveIntervalMs > 0) {
      this.startAutoSave();
    }
  }

  addRecord(record: DebateRecord): void {
    if (this.records.size >= this.config.maxRecords) {
      this.pruneOldest(1);
    }
    
    this.records.set(record.id, record);
    this.emit('record:added', record);
  }

  createRecord(
    sessionId: string,
    taskDescription: string,
    taskType: TaskType,
    decision: CouncilDecision,
    team: string[],
    consensusMode: ConsensusMode,
    debateRounds: number,
    durationMs: number,
    leadSupervisor?: string,
    metadata?: Record<string, unknown>
  ): DebateRecord {
    const record: DebateRecord = {
      id: this.generateRecordId(),
      sessionId,
      taskDescription,
      taskType,
      decision,
      team,
      leadSupervisor,
      consensusMode,
      debateRounds,
      timestamp: Date.now(),
      durationMs,
      metadata,
    };
    
    this.addRecord(record);
    return record;
  }

  getRecord(recordId: string): DebateRecord | undefined {
    return this.records.get(recordId);
  }

  getAllRecords(): DebateRecord[] {
    return Array.from(this.records.values());
  }

  getRecordsBySession(sessionId: string): DebateRecord[] {
    return this.getAllRecords().filter(r => r.sessionId === sessionId);
  }

  getRecordsByTaskType(taskType: TaskType): DebateRecord[] {
    return this.getAllRecords().filter(r => r.taskType === taskType);
  }

  getRecordsByConsensusMode(mode: ConsensusMode): DebateRecord[] {
    return this.getAllRecords().filter(r => r.consensusMode === mode);
  }

  getRecordsByDateRange(startTime: number, endTime: number): DebateRecord[] {
    return this.getAllRecords().filter(r => r.timestamp >= startTime && r.timestamp <= endTime);
  }

  getRecentRecords(limit: number): DebateRecord[] {
    return this.getAllRecords()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  searchRecords(query: string): DebateRecord[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllRecords().filter(r => 
      r.taskDescription.toLowerCase().includes(lowerQuery) ||
      r.decision.reasoning.toLowerCase().includes(lowerQuery)
    );
  }

  deleteRecord(recordId: string): boolean {
    const deleted = this.records.delete(recordId);
    if (deleted) {
      this.emit('record:deleted', recordId);
    }
    return deleted;
  }

  clearAll(): void {
    this.records.clear();
  }

  pruneOldest(count: number): number {
    const sorted = this.getAllRecords().sort((a, b) => a.timestamp - b.timestamp);
    let pruned = 0;
    
    for (let i = 0; i < count && i < sorted.length; i++) {
      this.records.delete(sorted[i].id);
      pruned++;
    }
    
    if (pruned > 0) {
      this.emit('history:pruned', pruned);
    }
    
    return pruned;
  }

  pruneOlderThan(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const toDelete = this.getAllRecords().filter(r => r.timestamp < cutoff);
    
    for (const record of toDelete) {
      this.records.delete(record.id);
    }
    
    if (toDelete.length > 0) {
      this.emit('history:pruned', toDelete.length);
    }
    
    return toDelete.length;
  }

  getAnalytics(): DebateAnalytics {
    const records = this.getAllRecords();
    
    if (records.length === 0) {
      return this.emptyAnalytics();
    }
    
    const approvals = records.filter(r => r.decision.approved).length;
    const totalConsensus = records.reduce((sum, r) => sum + r.decision.consensus, 0);
    const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0);
    
    const byTaskType: DebateAnalytics['byTaskType'] = {} as DebateAnalytics['byTaskType'];
    const byConsensusMode: DebateAnalytics['byConsensusMode'] = {} as DebateAnalytics['byConsensusMode'];
    const bySupervisor: DebateAnalytics['bySupervisor'] = {};
    const dailyMap = new Map<string, { debates: number; approvals: number }>();
    
    for (const record of records) {
      if (!byTaskType[record.taskType]) {
        byTaskType[record.taskType] = { count: 0, approvalRate: 0 };
      }
      byTaskType[record.taskType].count++;
      if (record.decision.approved) {
        byTaskType[record.taskType].approvalRate++;
      }
      
      if (!byConsensusMode[record.consensusMode]) {
        byConsensusMode[record.consensusMode] = { count: 0, approvalRate: 0 };
      }
      byConsensusMode[record.consensusMode].count++;
      if (record.decision.approved) {
        byConsensusMode[record.consensusMode].approvalRate++;
      }
      
      for (const vote of record.decision.votes) {
        if (!bySupervisor[vote.supervisor]) {
          bySupervisor[vote.supervisor] = { votes: 0, approvals: 0, avgConfidence: 0 };
        }
        bySupervisor[vote.supervisor].votes++;
        if (vote.approved) {
          bySupervisor[vote.supervisor].approvals++;
        }
        bySupervisor[vote.supervisor].avgConfidence += vote.confidence;
      }
      
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { debates: 0, approvals: 0 });
      }
      const daily = dailyMap.get(date)!;
      daily.debates++;
      if (record.decision.approved) {
        daily.approvals++;
      }
    }
    
    for (const key of Object.keys(byTaskType) as TaskType[]) {
      byTaskType[key].approvalRate = byTaskType[key].approvalRate / byTaskType[key].count;
    }
    
    for (const key of Object.keys(byConsensusMode) as ConsensusMode[]) {
      byConsensusMode[key].approvalRate = byConsensusMode[key].approvalRate / byConsensusMode[key].count;
    }
    
    for (const supervisor of Object.keys(bySupervisor)) {
      bySupervisor[supervisor].avgConfidence /= bySupervisor[supervisor].votes;
    }
    
    const timeSeriesDaily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      totalDebates: records.length,
      approvalRate: approvals / records.length,
      avgConsensus: totalConsensus / records.length,
      avgDurationMs: totalDuration / records.length,
      byTaskType,
      byConsensusMode,
      bySupervisor,
      timeSeriesDaily,
    };
  }

  private emptyAnalytics(): DebateAnalytics {
    return {
      totalDebates: 0,
      approvalRate: 0,
      avgConsensus: 0,
      avgDurationMs: 0,
      byTaskType: {} as DebateAnalytics['byTaskType'],
      byConsensusMode: {} as DebateAnalytics['byConsensusMode'],
      bySupervisor: {},
      timeSeriesDaily: [],
    };
  }

  exportToJSON(): string {
    return JSON.stringify(this.getAllRecords(), null, 2);
  }

  exportToCSV(): string {
    const records = this.getAllRecords();
    if (records.length === 0) {
      return '';
    }
    
    const headers = [
      'id', 'sessionId', 'taskDescription', 'taskType', 'approved',
      'consensus', 'weightedConsensus', 'consensusMode', 'debateRounds',
      'timestamp', 'durationMs', 'team', 'leadSupervisor'
    ];
    
    const rows = records.map(r => [
      r.id,
      r.sessionId,
      `"${r.taskDescription.replace(/"/g, '""')}"`,
      r.taskType,
      r.decision.approved,
      r.decision.consensus,
      r.decision.weightedConsensus ?? '',
      r.consensusMode,
      r.debateRounds,
      r.timestamp,
      r.durationMs,
      `"${r.team.join(', ')}"`,
      r.leadSupervisor ?? ''
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  async save(): Promise<void> {
    if (!this.config.persistPath) {
      throw new Error('Persistence path not configured');
    }
    
    const dir = path.dirname(this.config.persistPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.config.persistPath, this.exportToJSON());
    this.emit('history:saved');
  }

  async load(): Promise<void> {
    if (!this.config.persistPath || !fs.existsSync(this.config.persistPath)) {
      return;
    }
    
    try {
      const data = fs.readFileSync(this.config.persistPath, 'utf-8');
      const records = JSON.parse(data) as DebateRecord[];
      
      this.records.clear();
      for (const record of records) {
        this.records.set(record.id, record);
      }
      
      this.emit('history:loaded', records.length);
    } catch (error) {
      console.error('Failed to load debate history:', error);
    }
  }

  getStats(): {
    totalRecords: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    memoryUsageEstimate: number;
  } {
    const records = this.getAllRecords();
    
    let oldest: number | null = null;
    let newest: number | null = null;
    
    for (const record of records) {
      if (oldest === null || record.timestamp < oldest) {
        oldest = record.timestamp;
      }
      if (newest === null || record.timestamp > newest) {
        newest = record.timestamp;
      }
    }
    
    const jsonSize = JSON.stringify(records).length;
    
    return {
      totalRecords: records.length,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      memoryUsageEstimate: jsonSize,
    };
  }

  shutdown(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }

  private generateRecordId(): string {
    return `debate_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.save().catch(err => console.error('Auto-save failed:', err));
    }, this.config.autoSaveIntervalMs);
  }
}

export const debateHistoryManager = new DebateHistoryManager();
