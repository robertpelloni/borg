export interface HookEvent {
  type: HookType;
  payload: any;
  timestamp: number;
}

export type HookType = 
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompact';

export interface HookDefinition {
  type: 'command' | 'validation' | 'notification';
  event: HookType;
  action: string; // Command to execute or endpoint to hit
  scope?: string[];
}

export interface AgentDefinition {
  name: string;
  description: string;
  instructions: string;
  tools?: string[];
  model?: string;
  tags?: string[];
}

export type { 
  SkillDefinition, 
  Skill, 
  SkillType,
  VibeshipSkillData,
  VibeshipSkillYaml,
  VibeshipValidation,
  VibeshipSharpEdge,
  VibeshipCollaboration,
  SkillSourceConfig,
  UnifiedSkillConfig
} from './skills/types.js';

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}
