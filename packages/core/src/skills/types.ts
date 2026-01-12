export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  provider?: 'anthropic' | 'openai' | 'vibeship' | 'aios';
  category: string;
  path: string;
  metadata?: Record<string, unknown>;
  content: string;
  source?: 'local' | 'vibeship' | 'registry';
  tags?: string[];
}

export type SkillType = 'prompt' | 'script' | 'knowledge' | 'vibeship';

export interface Skill {
  definition: SkillDefinition;
  type: SkillType;
  content?: string;
  executablePath?: string;
  vibeship?: VibeshipSkillData;
}

export interface VibeshipSkillData {
  skill: VibeshipSkillYaml;
  validations?: VibeshipValidation[];
  sharpEdges?: VibeshipSharpEdge[];
  collaboration?: VibeshipCollaboration;
}

export interface VibeshipSkillYaml {
  id: string;
  name: string;
  category: string;
  description: string;
  identity?: {
    role?: string;
    personality?: string;
  };
  patterns?: {
    golden_rules?: VibeshipRule[];
    architecture_variants?: Record<string, unknown>;
    [key: string]: unknown;
  };
  anti_patterns?: VibeshipAntiPattern[];
  implementation_checklist?: Record<string, string[]>;
  handoffs?: VibeshipHandoff[];
  ecosystem?: {
    frameworks?: string[];
    libraries?: string[];
    models?: string[];
  };
  sources?: {
    papers?: string[];
    tutorials?: string[];
    documentation?: string[];
  };
}

export interface VibeshipRule {
  rule: string;
  reason: string;
}

export interface VibeshipAntiPattern {
  pattern: string;
  problem: string;
  solution: string;
  why_bad?: string;
  what_to_do_instead?: string;
  name?: string;
}

export interface VibeshipHandoff {
  skill: string;
  trigger: string;
  context?: string;
}

export interface VibeshipValidation {
  id: string;
  name: string;
  severity: 'error' | 'warning' | 'info' | 'critical';
  type: 'regex' | 'conceptual' | 'ast';
  pattern?: string | string[];
  message: string;
  fix_action: string;
  applies_to?: string[];
  file_patterns?: string[];
  indicators?: string[];
}

export interface VibeshipSharpEdge {
  id: string;
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  situation: string;
  why: string;
  solution: string;
  symptoms?: string[];
  detection_pattern?: string;
}

export interface VibeshipCollaboration {
  receives_from?: {
    skill: string;
    context: string;
    receives: string[];
    provides: string;
  }[];
  delegation_triggers?: {
    trigger: string;
    delegate_to: string;
    pattern: 'sequential' | 'parallel';
    context: string;
  }[];
  common_combinations?: {
    name: string;
    skills: string[];
    workflow: string;
  }[];
}

export interface SkillSourceConfig {
  type: 'directory' | 'registry' | 'remote';
  path: string;
  format: 'yaml' | 'json' | 'markdown';
  enabled: boolean;
  priority: number;
}

export interface UnifiedSkillConfig {
  sources: SkillSourceConfig[];
  cacheEnabled: boolean;
  cacheTTL: number;
}
