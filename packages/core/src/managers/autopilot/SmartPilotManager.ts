import { EventEmitter } from 'events';

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

export interface DevelopmentTask {
  id: string;
  description: string;
  context: string;
  files: string[];
  timestamp?: number;
  taskType?: string;
}

export interface SmartPilotHooks {
  preDebate?: string;
  postDebate?: string;
  preGuidance?: string;
  postGuidance?: string;
  onError?: string;
}

export interface SmartPilotConfig {
  enabled: boolean;
  pollIntervalMs: number;
  autoApproveThreshold: number;
  requireUnanimous: boolean;
  maxAutoApprovals: number;
  hooks?: SmartPilotHooks;
}

export interface SmartPilotState {
  enabled: boolean;
  running: boolean;
  autoApprovalCount: number;
  lastPollTime: number;
  lastDecision?: CouncilDecision;
  lastTask?: DevelopmentTask;
  paused: boolean;
  pauseReason?: string;
}

export interface SmartPilotEvents {
  'pilot:started': () => void;
  'pilot:stopped': () => void;
  'pilot:paused': (reason: string) => void;
  'pilot:resumed': () => void;
  'pilot:auto-approved': (task: DevelopmentTask, decision: CouncilDecision) => void;
  'pilot:requires-manual': (task: DevelopmentTask, decision: CouncilDecision, reason: string) => void;
  'pilot:hook-executed': (hookName: keyof SmartPilotHooks, result: unknown) => void;
  'pilot:hook-failed': (hookName: keyof SmartPilotHooks, error: Error) => void;
  'pilot:max-approvals-reached': () => void;
}

type DebateFunction = (task: DevelopmentTask) => Promise<CouncilDecision>;
type TaskQueueFunction = () => Promise<DevelopmentTask | null>;
type ExecuteTaskFunction = (task: DevelopmentTask) => Promise<void>;

export class SmartPilotManager extends EventEmitter {
  private config: SmartPilotConfig;
  private state: SmartPilotState;
  private pollInterval?: NodeJS.Timeout;
  
  private debateFn?: DebateFunction;
  private getNextTaskFn?: TaskQueueFunction;
  private executeTaskFn?: ExecuteTaskFunction;

  constructor(config?: Partial<SmartPilotConfig>) {
    super();
    
    this.config = {
      enabled: false,
      pollIntervalMs: 5000,
      autoApproveThreshold: 0.8,
      requireUnanimous: false,
      maxAutoApprovals: 100,
      ...config,
    };
    
    this.state = {
      enabled: this.config.enabled,
      running: false,
      autoApprovalCount: 0,
      lastPollTime: 0,
      paused: false,
    };
  }

  configure(config: Partial<SmartPilotConfig>): void {
    this.config = { ...this.config, ...config };
    this.state.enabled = this.config.enabled;
  }

  getConfig(): SmartPilotConfig {
    return { ...this.config };
  }

  getState(): SmartPilotState {
    return { ...this.state };
  }

  setDebateFunction(fn: DebateFunction): void {
    this.debateFn = fn;
  }

  setTaskQueueFunction(fn: TaskQueueFunction): void {
    this.getNextTaskFn = fn;
  }

  setExecuteFunction(fn: ExecuteTaskFunction): void {
    this.executeTaskFn = fn;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('SmartPilot is not enabled');
    }
    
    if (this.state.running) {
      return;
    }
    
    if (!this.debateFn || !this.getNextTaskFn || !this.executeTaskFn) {
      throw new Error('SmartPilot requires debate, task queue, and execute functions');
    }
    
    this.state.running = true;
    this.state.paused = false;
    this.state.autoApprovalCount = 0;
    
    this.pollInterval = setInterval(() => {
      this.poll();
    }, this.config.pollIntervalMs);
    
    this.emit('pilot:started');
    
    await this.poll();
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    
    this.state.running = false;
    this.emit('pilot:stopped');
  }

  pause(reason: string): void {
    this.state.paused = true;
    this.state.pauseReason = reason;
    this.emit('pilot:paused', reason);
  }

  resume(): void {
    this.state.paused = false;
    this.state.pauseReason = undefined;
    this.emit('pilot:resumed');
  }

  resetApprovalCount(): void {
    this.state.autoApprovalCount = 0;
  }

  private async poll(): Promise<void> {
    if (!this.state.running || this.state.paused) {
      return;
    }
    
    if (this.state.autoApprovalCount >= this.config.maxAutoApprovals) {
      this.pause('Maximum auto-approvals reached');
      this.emit('pilot:max-approvals-reached');
      return;
    }
    
    this.state.lastPollTime = Date.now();
    
    try {
      const task = await this.getNextTaskFn!();
      if (!task) {
        return;
      }
      
      this.state.lastTask = task;
      
      await this.executeHook('preDebate', task);
      
      const decision = await this.debateFn!(task);
      this.state.lastDecision = decision;
      
      await this.executeHook('postDebate', { task, decision });
      
      if (this.shouldAutoApprove(decision)) {
        await this.executeHook('preGuidance', { task, decision });
        
        await this.executeTaskFn!(task);
        this.state.autoApprovalCount++;
        
        await this.executeHook('postGuidance', { task, decision });
        
        this.emit('pilot:auto-approved', task, decision);
      } else {
        const reason = this.getManualApprovalReason(decision);
        this.emit('pilot:requires-manual', task, decision, reason);
      }
    } catch (error) {
      await this.executeHook('onError', error);
    }
  }

  private shouldAutoApprove(decision: CouncilDecision): boolean {
    if (!decision.approved) {
      return false;
    }
    
    const consensus = decision.weightedConsensus ?? decision.consensus;
    if (consensus < this.config.autoApproveThreshold) {
      return false;
    }
    
    if (this.config.requireUnanimous && decision.consensus < 1.0) {
      return false;
    }
    
    if (decision.dissent && decision.dissent.length > 0) {
      return false;
    }
    
    return true;
  }

  private getManualApprovalReason(decision: CouncilDecision): string {
    if (!decision.approved) {
      return 'Council rejected the task';
    }
    
    const consensus = decision.weightedConsensus ?? decision.consensus;
    if (consensus < this.config.autoApproveThreshold) {
      return `Consensus (${(consensus * 100).toFixed(1)}%) below threshold (${(this.config.autoApproveThreshold * 100).toFixed(1)}%)`;
    }
    
    if (this.config.requireUnanimous && decision.consensus < 1.0) {
      return 'Unanimous approval required but not achieved';
    }
    
    if (decision.dissent && decision.dissent.length > 0) {
      return `Strong dissent from ${decision.dissent.length} supervisor(s)`;
    }
    
    return 'Manual review required';
  }

  private async executeHook(hookName: keyof SmartPilotHooks, context: unknown): Promise<void> {
    const hook = this.config.hooks?.[hookName];
    if (!hook) {
      return;
    }
    
    try {
      const fn = new Function('context', hook);
      const result = await fn(context);
      this.emit('pilot:hook-executed', hookName, result);
    } catch (error) {
      this.emit('pilot:hook-failed', hookName, error instanceof Error ? error : new Error(String(error)));
    }
  }

  async evaluateTask(task: DevelopmentTask): Promise<{
    canAutoApprove: boolean;
    decision: CouncilDecision;
    reason?: string;
  }> {
    if (!this.debateFn) {
      throw new Error('Debate function not set');
    }
    
    const decision = await this.debateFn(task);
    const canAutoApprove = this.shouldAutoApprove(decision);
    
    return {
      canAutoApprove,
      decision,
      reason: canAutoApprove ? undefined : this.getManualApprovalReason(decision),
    };
  }

  isRunning(): boolean {
    return this.state.running;
  }

  isPaused(): boolean {
    return this.state.paused;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.state.enabled = enabled;
    
    if (!enabled && this.state.running) {
      this.stop();
    }
  }

  getAutoApprovalCount(): number {
    return this.state.autoApprovalCount;
  }

  getRemainingAutoApprovals(): number {
    return Math.max(0, this.config.maxAutoApprovals - this.state.autoApprovalCount);
  }
}

export const smartPilotManager = new SmartPilotManager();
