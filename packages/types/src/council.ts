/**
 * Council Types - Multi-Model AI Council for Code Review
 * Migrated from opencode-autopilot
 */

// ============================================================================
// Core Message Types
// ============================================================================

export interface CouncilMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// Supervisor Configuration
// ============================================================================

export type SupervisorProvider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'gemini'
  | 'xai' 
  | 'grok'
  | 'moonshot' 
  | 'kimi'
  | 'deepseek' 
  | 'qwen' 
  | 'custom';

export interface SupervisorConfig {
  name: string;
  provider: SupervisorProvider;
  apiKey?: string;
  model?: string;
  temperature?: number;
  baseURL?: string;
  systemPrompt?: string;
  weight?: number;
}

export interface Supervisor {
  name: string;
  provider: string;
  chat(messages: CouncilMessage[]): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// Consensus Modes
// ============================================================================

export type ConsensusMode = 
  | 'simple-majority'      // >50% approval
  | 'supermajority'        // >66% approval  
  | 'unanimous'            // 100% approval
  | 'weighted'             // Weighted by supervisor weight × confidence
  | 'ceo-override'         // Lead supervisor can override (head honcho)
  | 'ceo-veto'             // Lead supervisor can only veto, not force approve
  | 'hybrid-ceo-majority'  // CEO decides ties, majority otherwise
  | 'ranked-choice';       // Supervisors rank options, highest ranked wins

// ============================================================================
// Council Configuration
// ============================================================================

export interface CouncilConfig {
  supervisors: SupervisorConfig[];
  debateRounds?: number;
  consensusThreshold?: number;
  enabled?: boolean;
  smartPilot?: boolean;
  weightedVoting?: boolean;
  consensusMode?: ConsensusMode;
  leadSupervisor?: string;  // Name of the CEO/head honcho supervisor
  fallbackSupervisors?: string[];  // Ordered fallback chain
}

// ============================================================================
// Voting & Decisions
// ============================================================================

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

export interface Guidance {
  approved: boolean;
  feedback: string;
  suggestedNextSteps: string[];
}

// ============================================================================
// Task Types & Supervisor Profiles
// ============================================================================

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

export interface SupervisorProfile {
  name: string;
  provider: string;
  strengths: TaskType[];
  weaknesses?: TaskType[];
  specializations?: string[];
  preferredForLeadOn?: TaskType[];
}

export interface TeamTemplate {
  name: string;
  description: string;
  taskTypes: TaskType[];
  supervisors: string[];
  leadSupervisor?: string;
  consensusMode?: ConsensusMode;
  minSupervisors?: number;
}

export interface TeamSelectionResult {
  team: string[];
  leadSupervisor?: string;
  consensusMode: ConsensusMode;
  reasoning: string;
  taskType: TaskType;
  confidence: number;
}

// ============================================================================
// Session Types
// ============================================================================

export type CLIType = 'opencode' | 'claude' | 'aider' | 'cursor' | 'continue' | 'cody' | 'copilot' | 'custom';

export interface CLITool {
  type: CLIType;
  name: string;
  command: string;
  args: string[];
  healthEndpoint?: string;
  detectCommand?: string;
  available?: boolean;
  version?: string;
  capabilities?: string[];
}

export type SessionStatus = 'idle' | 'starting' | 'running' | 'paused' | 'stopped' | 'error' | 'completed';

export interface CouncilLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface CouncilSession {
  id: string;
  status: SessionStatus;
  startedAt: number;
  lastActivity?: number;
  currentTask?: string;
  logs: CouncilLogEntry[];
  port?: number;
  workingDirectory?: string;
  templateName?: string;
  tags?: string[];
  cliType?: CLIType;
}

export interface PersistedCouncilSession {
  id: string;
  status: SessionStatus;
  startedAt: number;
  lastActivity?: number;
  currentTask?: string;
  port: number;
  workingDirectory?: string;
  templateName?: string;
  tags?: string[];
  cliType?: CLIType;
  metadata?: Record<string, unknown>;
}

export interface SessionTemplate {
  name: string;
  description?: string;
  supervisors: SupervisorConfig[];
  councilConfig?: Partial<CouncilConfig>;
  autoStart?: boolean;
  tags?: string[];
  cliType?: CLIType;
}

// ============================================================================
// Health & Recovery
// ============================================================================

export type SessionHealthStatus = 'healthy' | 'degraded' | 'unresponsive' | 'crashed';

export interface SessionHealth {
  status: SessionHealthStatus;
  lastCheck: number;
  consecutiveFailures: number;
  restartCount: number;
  lastRestartAt?: number;
  errorMessage?: string;
}

export interface CouncilHealthCheckConfig {
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

export interface LogRotationConfig {
  maxLogsPerSession: number;
  maxLogAgeMs: number;
  pruneIntervalMs: number;
}

export interface SessionPersistenceConfig {
  enabled: boolean;
  filePath: string;
  autoSaveIntervalMs: number;
  autoResumeOnStart: boolean;
  maxPersistedSessions: number;
}

// ============================================================================
// Development Task
// ============================================================================

export interface DevelopmentTask {
  id: string;
  description: string;
  context: string;
  files: string[];
  timestamp?: number;
  taskType?: TaskType;
}

// ============================================================================
// Smart Pilot Configuration
// ============================================================================

export interface SmartPilotConfig {
  enabled: boolean;
  pollIntervalMs: number;
  autoApproveThreshold: number;
  requireUnanimous: boolean;
  maxAutoApprovals: number;
  hooks?: SmartPilotHooks;
}

export interface SmartPilotHooks {
  preDebate?: string;
  postDebate?: string;
  preGuidance?: string;
  postGuidance?: string;
  onError?: string;
}

// ============================================================================
// Debate History
// ============================================================================

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
}

// ============================================================================
// Veto System
// ============================================================================

export interface VetoRequest {
  id: string;
  debateId: string;
  sessionId: string;
  decision: CouncilDecision;
  reason?: string;
  requestedAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  resolvedAt?: number;
  resolvedBy?: string;
}

// ============================================================================
// WebSocket Events
// ============================================================================

export interface CouncilWebSocketMessage {
  type: 
    | 'session_update' 
    | 'council_decision' 
    | 'log' 
    | 'error' 
    | 'bulk_update' 
    | 'supervisor_fallback'
    | 'health_update'
    | 'veto_pending'
    | 'debate_progress'
    | 'smart_pilot_status';
  payload: unknown;
  timestamp: number;
}

// ============================================================================
// Bulk Operations
// ============================================================================

export interface BulkSessionRequest {
  count: number;
  template?: string;
  tags?: string[];
  staggerDelayMs?: number;
}

export interface BulkSessionResponse {
  sessions: CouncilSession[];
  failed: Array<{ index: number; error: string }>;
}

// ============================================================================
// API Response
// ============================================================================

export interface CouncilApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
