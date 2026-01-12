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

export { WorkflowService, getWorkflowService } from './WorkflowService.js';
export type {
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  WorkflowStatus,
  ExecutionStatus,
  StepType,
} from './WorkflowService.js';

export { NotificationService, getNotificationService } from './NotificationService.js';
export type {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  EventType,
  NotificationTemplate,
  NotificationChannelConfig,
  EventSubscription,
  Notification,
  NotificationBatch,
  NotificationStats,
} from './NotificationService.js';

export { BudgetService, getBudgetService } from './BudgetService.js';
export type {
  BudgetScope,
  BudgetPeriod,
  BudgetStatus as BudgetStatusType,
  AlertLevel,
  CostEntry,
  Budget,
  BudgetAlert,
  CostSummary,
  ModelPricing,
} from './BudgetService.js';

export { IntegrationService, getIntegrationService } from './IntegrationService.js';
export type {
  IntegrationType,
  AuthType,
  IntegrationStatus,
  Integration,
  IntegrationTemplate,
  OAuthConfig,
  WebhookEvent,
} from './IntegrationService.js';
