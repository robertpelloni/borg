/**
 * AIOS Services Module
 * Central exports for all AIOS services
 */

// Core Services
export { CodeExecutorService, getCodeExecutorService } from './CodeExecutorService.js';
export type { ExecutionOptions, ExecutionResult, ToolCallCallback } from './CodeExecutorService.js';

export { SavedScriptService, getSavedScriptService } from './SavedScriptService.js';
export type { CreateScriptInput, UpdateScriptInput, ScriptSearchOptions } from './SavedScriptService.js';

export { PolicyService } from './PolicyService.js';
export type { PolicyTemplate, PolicyEvaluationResult, PolicyContext } from './PolicyService.js';

export { ToolSearchService } from './ToolSearchService.js';
export type { SearchOptions, SearchResult, ToolDefinition } from './ToolSearchService.js';

// Infrastructure Services
export { TelemetryService } from './TelemetryService.js';
export { MetricsService } from './MetricsService.js';
export { AuditService } from './AuditService.js';
export { CacheService } from './CacheService.js';
export { HealthService } from './HealthService.js';
export { ConnectionPool } from './ConnectionPoolService.js';

// Specialized Services
export { RepoMapService } from './RepoMapService.js';
export { VectorStore } from './VectorStore.js';
export { TrafficObserver } from './TrafficObserver.js';
export { SystemDoctor } from './SystemDoctor.js';
export { DockerService } from './DockerService.js';

// AI/Orchestration Services (from jules-autopilot integration)
export { DebateEngineService, getDebateEngineService } from './DebateEngineService.js';
export type { 
  Participant, 
  DebateConfig, 
  DebateTurn, 
  DebateRound, 
  DebateResult,
  ConferenceResult,
} from './DebateEngineService.js';

export { CodeReviewService, getCodeReviewService } from './CodeReviewService.js';
export type {
  ReviewPersona,
  ReviewRequest,
  ReviewIssue,
  ReviewResult,
} from './CodeReviewService.js';

export { MemoryCompactionService, getMemoryCompactionService } from './MemoryCompactionService.js';
export type {
  Activity,
  MemoryFile,
  CompactionConfig,
  HandoffDocument,
} from './MemoryCompactionService.js';

export { AgentTemplateService, getAgentTemplateService } from './AgentTemplateService.js';
export type {
  AgentTemplate,
  AgentCategory,
} from './AgentTemplateService.js';

export { ToolAnalyticsService, getToolAnalyticsService } from './ToolAnalyticsService.js';
export type {
  ToolInvocation,
  ToolStats,
  AgentStats,
  SessionStats,
  UsageTrend,
  ErrorPattern,
  AnalyticsQuery,
} from './ToolAnalyticsService.js';
