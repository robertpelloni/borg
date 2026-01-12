export * from './CLIRegistry.js';
export * from './CLISessionManager.js';
export { 
  SmartPilotManager, 
  smartPilotManager,
  type SmartPilotState,
  type SmartPilotEvents,
  type SmartPilotConfig,
  type SmartPilotHooks,
} from './SmartPilotManager.js';
export { 
  VetoManager, 
  vetoManager,
  type VetoRequest,
  type VetoConfig,
  type VetoManagerEvents,
} from './VetoManager.js';
export { 
  DebateHistoryManager, 
  debateHistoryManager,
  type DebateRecord,
  type DebateHistoryConfig,
  type DebateAnalytics,
  type DebateHistoryEvents,
  type ConsensusMode,
  type TaskType,
} from './DebateHistoryManager.js';
export {
  DynamicSelectionManager,
  dynamicSelectionManager,
  type SupervisorProfile,
  type TeamTemplate,
  type TeamSelectionResult,
  type DynamicSelectionConfig,
  type DynamicSelectionEvents,
} from './DynamicSelectionManager.js';
