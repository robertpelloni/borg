/**
 * DynamicSelectionManager - Intelligent supervisor team selection based on task type
 * 
 * Ported from opencode-autopilot. Analyzes task descriptions and selects optimal
 * supervisor teams based on their specialties and strengths.
 */

import { EventEmitter } from 'events';

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
  model?: string;
  strengths: TaskType[];
  weaknesses: TaskType[];
  weight: number;
  specialty?: string;
  description?: string;
}

export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  taskTypes: TaskType[];
  supervisors: string[];
  leadSupervisor?: string;
  consensusMode?: string;
  minSupervisors?: number;
  maxSupervisors?: number;
}

export interface TeamSelectionResult {
  team: string[];
  leadSupervisor?: string;
  taskType: TaskType;
  templateUsed?: string;
  reasoning: string;
  scores: Record<string, number>;
}

export interface DynamicSelectionConfig {
  enabled: boolean;
  minTeamSize: number;
  maxTeamSize: number;
  preferSpecialists: boolean;
  autoDetectTaskType: boolean;
  defaultLeadSupervisor?: string;
}

export interface DynamicSelectionEvents {
  'team:selected': (result: TeamSelectionResult) => void;
  'taskType:detected': (taskType: TaskType, keywords: string[]) => void;
  'profile:added': (profile: SupervisorProfile) => void;
  'template:added': (template: TeamTemplate) => void;
}

// Task type detection keywords
const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  'security-audit': [
    'security', 'auth', 'authentication', 'authorization', 'xss', 'csrf',
    'injection', 'sql injection', 'vulnerability', 'exploit', 'encryption',
    'password', 'token', 'jwt', 'oauth', 'permissions', 'access control',
    'sanitize', 'escape', 'audit', 'penetration', 'owasp'
  ],
  'performance': [
    'performance', 'latency', 'speed', 'optimization', 'optimize', 'cache',
    'caching', 'memory', 'cpu', 'slow', 'fast', 'efficient', 'bottleneck',
    'profiling', 'benchmark', 'scalability', 'load', 'throughput', 'concurrent'
  ],
  'architecture': [
    'architecture', 'design', 'pattern', 'structure', 'refactor', 'module',
    'dependency', 'coupling', 'cohesion', 'solid', 'abstraction', 'interface',
    'separation', 'microservice', 'monolith', 'layer', 'component', 'system'
  ],
  'testing': [
    'test', 'testing', 'unit test', 'integration test', 'e2e', 'coverage',
    'mock', 'stub', 'assertion', 'jest', 'mocha', 'pytest', 'tdd', 'bdd',
    'fixture', 'spec', 'regression'
  ],
  'code-review': [
    'code quality', 'clean code', 'readability', 'maintainability', 'lint',
    'format', 'style', 'convention', 'naming', 'comment', 'documentation',
    'complexity', 'duplication', 'smell', 'technical debt', 'review'
  ],
  'ui-design': [
    'frontend', 'ui', 'ux', 'react', 'vue', 'angular', 'css', 'html', 'dom',
    'component', 'styling', 'responsive', 'accessibility', 'a11y', 'animation',
    'layout', 'browser', 'design'
  ],
  'api-design': [
    'backend', 'api', 'rest', 'graphql', 'server', 'endpoint', 'route',
    'controller', 'service', 'middleware', 'request', 'response', 'http',
    'websocket', 'schema'
  ],
  'refactoring': [
    'refactor', 'refactoring', 'restructure', 'cleanup', 'improve', 'simplify',
    'extract', 'inline', 'rename', 'move', 'decompose', 'modernize'
  ],
  'bug-fix': [
    'bug', 'fix', 'error', 'issue', 'broken', 'crash', 'failure', 'exception',
    'wrong', 'incorrect', 'not working', 'regression', 'debug'
  ],
  'documentation': [
    'documentation', 'docs', 'readme', 'guide', 'tutorial', 'example',
    'api docs', 'jsdoc', 'typedoc', 'swagger', 'openapi', 'comment'
  ],
  'general': ['general', 'other', 'misc', 'task']
};

export class DynamicSelectionManager extends EventEmitter {
  private config: DynamicSelectionConfig;
  private profiles: Map<string, SupervisorProfile> = new Map();
  private templates: Map<string, TeamTemplate> = new Map();

  constructor(config?: Partial<DynamicSelectionConfig>) {
    super();
    
    this.config = {
      enabled: true,
      minTeamSize: 2,
      maxTeamSize: 5,
      preferSpecialists: true,
      autoDetectTaskType: true,
      ...config,
    };
    
    // Initialize default templates
    this.initializeDefaultTemplates();
  }

  configure(config: Partial<DynamicSelectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): DynamicSelectionConfig {
    return { ...this.config };
  }

  // === Profile Management ===

  addProfile(profile: SupervisorProfile): void {
    this.profiles.set(profile.name, profile);
    this.emit('profile:added', profile);
  }

  removeProfile(name: string): boolean {
    return this.profiles.delete(name);
  }

  getProfile(name: string): SupervisorProfile | undefined {
    return this.profiles.get(name);
  }

  getAllProfiles(): SupervisorProfile[] {
    return Array.from(this.profiles.values());
  }

  // === Template Management ===

  addTemplate(template: TeamTemplate): void {
    this.templates.set(template.id, template);
    this.emit('template:added', template);
  }

  removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  getTemplate(id: string): TeamTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): TeamTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesForTaskType(taskType: TaskType): TeamTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.taskTypes.includes(taskType));
  }

  // === Task Type Detection ===

  detectTaskType(description: string): { taskType: TaskType; keywords: string[]; confidence: number } {
    const lowerDesc = description.toLowerCase();
    const scores: Record<TaskType, { score: number; keywords: string[] }> = {} as Record<TaskType, { score: number; keywords: string[] }>;
    
    for (const [taskType, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      const matchedKeywords: string[] = [];
      let score = 0;
      
      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword.toLowerCase())) {
          score++;
          matchedKeywords.push(keyword);
        }
      }
      
      scores[taskType as TaskType] = { score, keywords: matchedKeywords };
    }
    
    // Find best match
    let bestType: TaskType = 'general';
    let bestScore = 0;
    let bestKeywords: string[] = [];
    
    for (const [taskType, data] of Object.entries(scores)) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestType = taskType as TaskType;
        bestKeywords = data.keywords;
      }
    }
    
    // Calculate confidence based on keyword density
    const totalPossibleKeywords = TASK_TYPE_KEYWORDS[bestType].length;
    const confidence = totalPossibleKeywords > 0 ? bestScore / totalPossibleKeywords : 0;
    
    this.emit('taskType:detected', bestType, bestKeywords);
    
    return { taskType: bestType, keywords: bestKeywords, confidence };
  }

  // === Team Selection ===

  selectTeam(
    taskDescription: string,
    availableSupervisors: string[],
    preferredTaskType?: TaskType
  ): TeamSelectionResult {
    // Detect task type if not provided
    const detection = preferredTaskType 
      ? { taskType: preferredTaskType, keywords: [], confidence: 1.0 }
      : this.detectTaskType(taskDescription);
    
    const taskType = detection.taskType;
    
    // Check for matching template
    const matchingTemplates = this.getTemplatesForTaskType(taskType);
    const availableTemplate = matchingTemplates.find(t => 
      t.supervisors.some(s => availableSupervisors.includes(s))
    );
    
    if (availableTemplate) {
      return this.selectFromTemplate(availableTemplate, availableSupervisors, taskType);
    }
    
    // Dynamic selection based on profiles
    return this.selectDynamic(taskType, availableSupervisors, taskDescription);
  }

  private selectFromTemplate(
    template: TeamTemplate,
    availableSupervisors: string[],
    taskType: TaskType
  ): TeamSelectionResult {
    const team = template.supervisors.filter(s => availableSupervisors.includes(s));
    const scores: Record<string, number> = {};
    
    for (const supervisor of team) {
      scores[supervisor] = 1.0; // Template members get full score
    }
    
    // Ensure minimum team size
    if (team.length < this.config.minTeamSize) {
      const additional = availableSupervisors
        .filter(s => !team.includes(s))
        .slice(0, this.config.minTeamSize - team.length);
      
      for (const s of additional) {
        team.push(s);
        scores[s] = 0.5; // Additional members get lower score
      }
    }
    
    return {
      team: team.slice(0, this.config.maxTeamSize),
      leadSupervisor: template.leadSupervisor && availableSupervisors.includes(template.leadSupervisor)
        ? template.leadSupervisor
        : team[0],
      taskType,
      templateUsed: template.id,
      reasoning: `Selected from template "${template.name}" optimized for ${taskType} tasks`,
      scores,
    };
  }

  private selectDynamic(
    taskType: TaskType,
    availableSupervisors: string[],
    taskDescription: string
  ): TeamSelectionResult {
    const scores: Record<string, number> = {};
    
    // Score each available supervisor
    for (const supervisorName of availableSupervisors) {
      const profile = this.profiles.get(supervisorName);
      
      if (profile) {
        let score = profile.weight;
        
        // Boost for strengths
        if (profile.strengths.includes(taskType)) {
          score += 0.3;
        }
        
        // Penalty for weaknesses
        if (profile.weaknesses.includes(taskType)) {
          score -= 0.2;
        }
        
        scores[supervisorName] = Math.max(0, Math.min(2, score));
      } else {
        // No profile - use base score
        scores[supervisorName] = 1.0;
      }
    }
    
    // Sort by score and select team
    const sorted = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);
    
    const teamSize = Math.min(
      Math.max(this.config.minTeamSize, Math.ceil(sorted.length / 2)),
      this.config.maxTeamSize
    );
    
    const team = sorted.slice(0, teamSize).map(([name]) => name);
    
    // Select lead (highest scoring specialist or default)
    const leadSupervisor = this.config.defaultLeadSupervisor && team.includes(this.config.defaultLeadSupervisor)
      ? this.config.defaultLeadSupervisor
      : team[0];
    
    return {
      team,
      leadSupervisor,
      taskType,
      reasoning: `Dynamically selected ${team.length} supervisors for ${taskType} task based on profiles and strengths`,
      scores,
    };
  }

  // === Supervisor Strength Analysis ===

  analyzeSupervisorStrengths(supervisorName: string): {
    strengths: TaskType[];
    weaknesses: TaskType[];
    recommendedFor: TaskType[];
    notRecommendedFor: TaskType[];
  } {
    const profile = this.profiles.get(supervisorName);
    
    if (!profile) {
      return {
        strengths: [],
        weaknesses: [],
        recommendedFor: ['general'],
        notRecommendedFor: [],
      };
    }
    
    return {
      strengths: [...profile.strengths],
      weaknesses: [...profile.weaknesses],
      recommendedFor: profile.strengths.length > 0 ? profile.strengths : ['general'],
      notRecommendedFor: profile.weaknesses,
    };
  }

  getRecommendedSupervisors(taskType: TaskType): SupervisorProfile[] {
    return Array.from(this.profiles.values())
      .filter(p => p.strengths.includes(taskType))
      .sort((a, b) => b.weight - a.weight);
  }

  // === Default Templates ===

  private initializeDefaultTemplates(): void {
    const defaultTemplates: TeamTemplate[] = [
      {
        id: 'security-team',
        name: 'Security Audit Team',
        description: 'Specialized team for security audits and vulnerability assessments',
        taskTypes: ['security-audit'],
        supervisors: ['claude-security', 'gpt-security', 'gemini-security'],
        consensusMode: 'unanimous',
        minSupervisors: 2,
        maxSupervisors: 4,
      },
      {
        id: 'architecture-team',
        name: 'Architecture Review Team',
        description: 'Team for system design and architectural decisions',
        taskTypes: ['architecture', 'api-design'],
        supervisors: ['claude-architect', 'gpt-architect'],
        consensusMode: 'supermajority',
        minSupervisors: 2,
        maxSupervisors: 3,
      },
      {
        id: 'performance-team',
        name: 'Performance Optimization Team',
        description: 'Team for performance analysis and optimization',
        taskTypes: ['performance'],
        supervisors: ['claude-perf', 'gpt-perf'],
        consensusMode: 'weighted',
        minSupervisors: 2,
        maxSupervisors: 3,
      },
      {
        id: 'testing-team',
        name: 'Testing & QA Team',
        description: 'Team for test strategy and quality assurance',
        taskTypes: ['testing', 'code-review'],
        supervisors: ['claude-qa', 'gpt-qa'],
        consensusMode: 'simple-majority',
        minSupervisors: 2,
        maxSupervisors: 3,
      },
      {
        id: 'frontend-team',
        name: 'Frontend Development Team',
        description: 'Team for UI/UX design and frontend development',
        taskTypes: ['ui-design'],
        supervisors: ['claude-frontend', 'gpt-frontend'],
        consensusMode: 'simple-majority',
        minSupervisors: 2,
        maxSupervisors: 3,
      },
      {
        id: 'general-team',
        name: 'General Review Team',
        description: 'Default team for general code review and tasks',
        taskTypes: ['general', 'bug-fix', 'refactoring', 'documentation'],
        supervisors: ['claude', 'gpt', 'gemini'],
        consensusMode: 'weighted',
        minSupervisors: 2,
        maxSupervisors: 4,
      },
    ];
    
    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  // === Stats ===

  getStats(): {
    totalProfiles: number;
    totalTemplates: number;
    taskTypesCovered: TaskType[];
    profilesByStrength: Record<TaskType, number>;
  } {
    const profilesByStrength: Record<TaskType, number> = {} as Record<TaskType, number>;
    const taskTypesCovered = new Set<TaskType>();
    
    for (const profile of this.profiles.values()) {
      for (const strength of profile.strengths) {
        profilesByStrength[strength] = (profilesByStrength[strength] || 0) + 1;
        taskTypesCovered.add(strength);
      }
    }
    
    for (const template of this.templates.values()) {
      for (const taskType of template.taskTypes) {
        taskTypesCovered.add(taskType);
      }
    }
    
    return {
      totalProfiles: this.profiles.size,
      totalTemplates: this.templates.size,
      taskTypesCovered: Array.from(taskTypesCovered),
      profilesByStrength,
    };
  }
}

export const dynamicSelectionManager = new DynamicSelectionManager();
