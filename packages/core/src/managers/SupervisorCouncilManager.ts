/**
 * SupervisorCouncilManager - Multi-LLM council for code review and decision making
 * Ported from opencode-autopilot with AIOS integration
 */

import type { Supervisor, SupervisorConfig, CouncilMessage, SupervisorSpecialty } from '../supervisors/BaseSupervisor.js';
import { createSupervisor, SupervisorRegistry } from '../supervisors/index.js';

export type ConsensusMode = 
  | 'simple-majority'
  | 'supermajority'
  | 'unanimous'
  | 'weighted'
  | 'ceo-override'
  | 'ceo-veto'
  | 'hybrid-ceo-majority'
  | 'ranked-choice';

export interface Vote {
  supervisor: string;
  approved: boolean;
  confidence: number;
  weight: number;
  comment: string;
}

export interface CouncilConfig {
  supervisors: SupervisorConfig[];
  debateRounds: number;
  consensusThreshold: number;
  enabled: boolean;
  weightedVoting: boolean;
  consensusMode: ConsensusMode;
  leadSupervisor?: string;
  fallbackSupervisors?: string[];
}

export interface DevelopmentTask {
  id: string;
  description: string;
  context: string;
  files: string[];
}

export interface CouncilDecision {
  approved: boolean;
  consensus: number;
  weightedConsensus: number;
  votes: Vote[];
  reasoning: string;
  dissent: string[];
}

interface ConsensusModeHandler {
  (votes: Vote[], config: CouncilConfig, leadVote?: Vote): { approved: boolean; reasoning: string };
}

export interface SupervisorAnalytics {
  totalVotes: number;
  approvals: number;
  rejections: number;
  approvalRate: number;
  avgConfidence: number;
  totalResponseTimeMs: number;
  avgResponseTimeMs: number;
  lastVoteAt: string | null;
}

export interface CouncilAnalytics {
  totalDebates: number;
  totalApproved: number;
  totalRejected: number;
  avgConsensus: number;
  supervisorStats: Record<string, SupervisorAnalytics>;
}

export interface DebateTemplate {
  id: string;
  name: string;
  description: string;
  requiredSpecialties: SupervisorSpecialty[];
  consensusMode: ConsensusMode;
  debateRounds: number;
  consensusThreshold: number;
  systemPrompt: string;
}

/**
 * Cross-review result from karpathy/llm-council pattern
 * Each supervisor anonymously ranks other supervisors' opinions
 */
export interface CrossReviewRanking {
  anonymousId: string;      // "Response A", "Response B", etc.
  rank: number;             // 1 = best
  reasoning?: string;
}

export interface CrossReviewResult {
  reviewer: string;           // Supervisor who performed this review
  rankings: CrossReviewRanking[];
  rawResponse: string;
}

export interface AggregateRankings {
  supervisorRankings: Map<string, number>;  // supervisor name -> average rank (lower = better)
  peerReviewBoosts: Map<string, number>;    // supervisor name -> weight adjustment factor
}

const BUILTIN_TEMPLATES: DebateTemplate[] = [
  {
    id: 'security-review',
    name: 'Security Review',
    description: 'Thorough security audit focusing on vulnerabilities, authentication, and data protection',
    requiredSpecialties: ['security', 'backend'],
    consensusMode: 'supermajority',
    debateRounds: 3,
    consensusThreshold: 0.75,
    systemPrompt: 'You are reviewing code for security vulnerabilities. Focus on: SQL injection, XSS, CSRF, authentication flaws, authorization bypasses, sensitive data exposure, and insecure dependencies.',
  },
  {
    id: 'performance-audit',
    name: 'Performance Audit',
    description: 'Analyze code for performance bottlenecks and optimization opportunities',
    requiredSpecialties: ['performance', 'backend', 'database'],
    consensusMode: 'simple-majority',
    debateRounds: 2,
    consensusThreshold: 0.6,
    systemPrompt: 'You are reviewing code for performance issues. Focus on: N+1 queries, missing indexes, memory leaks, unnecessary computations, caching opportunities, and algorithm complexity.',
  },
  {
    id: 'architecture-review',
    name: 'Architecture Review',
    description: 'Evaluate architectural decisions, patterns, and system design',
    requiredSpecialties: ['architecture', 'backend', 'frontend'],
    consensusMode: 'weighted',
    debateRounds: 3,
    consensusThreshold: 0.7,
    systemPrompt: 'You are reviewing architectural decisions. Focus on: separation of concerns, coupling/cohesion, scalability, maintainability, SOLID principles, and design patterns.',
  },
  {
    id: 'code-quality',
    name: 'Code Quality Review',
    description: 'Assess code readability, maintainability, and adherence to best practices',
    requiredSpecialties: ['code-quality', 'testing'],
    consensusMode: 'simple-majority',
    debateRounds: 2,
    consensusThreshold: 0.5,
    systemPrompt: 'You are reviewing code quality. Focus on: naming conventions, code duplication, function length, complexity, error handling, and test coverage.',
  },
  {
    id: 'api-design',
    name: 'API Design Review',
    description: 'Review API endpoints for RESTful design, consistency, and usability',
    requiredSpecialties: ['backend', 'architecture', 'documentation'],
    consensusMode: 'simple-majority',
    debateRounds: 2,
    consensusThreshold: 0.6,
    systemPrompt: 'You are reviewing API design. Focus on: RESTful conventions, endpoint naming, request/response structure, error responses, versioning, and documentation.',
  },
  {
    id: 'frontend-ux',
    name: 'Frontend & UX Review',
    description: 'Evaluate frontend code for accessibility, responsiveness, and user experience',
    requiredSpecialties: ['frontend', 'code-quality'],
    consensusMode: 'simple-majority',
    debateRounds: 2,
    consensusThreshold: 0.6,
    systemPrompt: 'You are reviewing frontend code. Focus on: accessibility (a11y), responsive design, component reusability, state management, performance, and user experience.',
  },
];

export class SupervisorCouncilManager {
  private static instance: SupervisorCouncilManager | null = null;
  
  private registry: SupervisorRegistry;
  private supervisorWeights: Map<string, number> = new Map();
  private supervisorSpecialties: Map<string, SupervisorSpecialty[]> = new Map();
  private supervisorAnalytics: Map<string, SupervisorAnalytics> = new Map();
  private councilAnalytics: CouncilAnalytics = {
    totalDebates: 0,
    totalApproved: 0,
    totalRejected: 0,
    avgConsensus: 0,
    supervisorStats: {},
  };
  private config: CouncilConfig;
  private fallbackIndex = 0;
  private customTemplates: Map<string, DebateTemplate> = new Map();

  // Keyword-to-specialty mapping for task analysis
  private static readonly SPECIALTY_KEYWORDS: Record<SupervisorSpecialty, string[]> = {
    'security': ['security', 'auth', 'authentication', 'authorization', 'xss', 'csrf', 'injection', 'sql injection', 'vulnerability', 'exploit', 'encryption', 'password', 'token', 'jwt', 'oauth', 'permissions', 'access control', 'sanitize', 'escape'],
    'performance': ['performance', 'latency', 'speed', 'optimization', 'optimize', 'cache', 'caching', 'memory', 'cpu', 'slow', 'fast', 'efficient', 'bottleneck', 'profiling', 'benchmark', 'scalability', 'load', 'throughput'],
    'architecture': ['architecture', 'design', 'pattern', 'structure', 'refactor', 'module', 'dependency', 'coupling', 'cohesion', 'solid', 'abstraction', 'interface', 'separation', 'microservice', 'monolith', 'layer', 'component'],
    'testing': ['test', 'testing', 'unit test', 'integration test', 'e2e', 'coverage', 'mock', 'stub', 'assertion', 'jest', 'mocha', 'pytest', 'tdd', 'bdd', 'fixture', 'spec'],
    'code-quality': ['code quality', 'clean code', 'readability', 'maintainability', 'lint', 'format', 'style', 'convention', 'naming', 'comment', 'documentation', 'complexity', 'duplication', 'smell', 'technical debt'],
    'frontend': ['frontend', 'ui', 'ux', 'react', 'vue', 'angular', 'css', 'html', 'dom', 'component', 'styling', 'responsive', 'accessibility', 'a11y', 'animation', 'layout', 'browser'],
    'backend': ['backend', 'api', 'rest', 'graphql', 'server', 'endpoint', 'route', 'controller', 'service', 'middleware', 'request', 'response', 'http', 'websocket'],
    'database': ['database', 'db', 'sql', 'nosql', 'query', 'schema', 'migration', 'orm', 'index', 'transaction', 'postgres', 'mysql', 'mongodb', 'redis', 'table', 'relation'],
    'devops': ['devops', 'ci', 'cd', 'pipeline', 'deploy', 'deployment', 'docker', 'kubernetes', 'k8s', 'container', 'infrastructure', 'terraform', 'ansible', 'aws', 'gcp', 'azure', 'monitoring', 'logging'],
    'documentation': ['documentation', 'docs', 'readme', 'guide', 'tutorial', 'example', 'api docs', 'jsdoc', 'typedoc', 'swagger', 'openapi'],
    'general': ['general', 'other', 'misc']
  };

  private consensusHandlers: Record<ConsensusMode, ConsensusModeHandler> = {
    'simple-majority': this.handleSimpleMajority.bind(this),
    'supermajority': this.handleSupermajority.bind(this),
    'unanimous': this.handleUnanimous.bind(this),
    'weighted': this.handleWeighted.bind(this),
    'ceo-override': this.handleCeoOverride.bind(this),
    'ceo-veto': this.handleCeoVeto.bind(this),
    'hybrid-ceo-majority': this.handleHybridCeoMajority.bind(this),
    'ranked-choice': this.handleRankedChoice.bind(this),
  };

  private constructor(config: CouncilConfig) {
    this.config = config;
    this.registry = new SupervisorRegistry();
  }

  static getInstance(config?: CouncilConfig): SupervisorCouncilManager {
    if (!SupervisorCouncilManager.instance) {
      SupervisorCouncilManager.instance = new SupervisorCouncilManager(config ?? {
        supervisors: [],
        debateRounds: 2,
        consensusThreshold: 0.7,
        enabled: true,
        weightedVoting: true,
        consensusMode: 'weighted',
      });
    }
    return SupervisorCouncilManager.instance;
  }

  static resetInstance(): void {
    SupervisorCouncilManager.instance = null;
  }

  addSupervisor(config: SupervisorConfig): Supervisor {
    const supervisor = this.registry.add(config);
    this.supervisorWeights.set(config.name, config.weight ?? 1.0);
    return supervisor;
  }

  removeSupervisor(name: string): boolean {
    this.supervisorWeights.delete(name);
    return this.registry.remove(name);
  }

  setSupervisorWeight(name: string, weight: number): void {
    this.supervisorWeights.set(name, Math.max(0, Math.min(2, weight)));
  }

  getSupervisorWeight(name: string): number {
    return this.supervisorWeights.get(name) ?? 1.0;
  }

  setSupervisorSpecialties(name: string, specialties: SupervisorSpecialty[]): void {
    this.supervisorSpecialties.set(name, specialties);
  }

  getSupervisorSpecialties(name: string): SupervisorSpecialty[] {
    return this.supervisorSpecialties.get(name) ?? ['general'];
  }

  analyzeTaskSpecialties(task: DevelopmentTask): SupervisorSpecialty[] {
    const text = `${task.description} ${task.context ?? ''} ${task.files?.join(' ') ?? ''}`.toLowerCase();
    const matched = new Set<SupervisorSpecialty>();

    for (const [specialty, keywords] of Object.entries(SupervisorCouncilManager.SPECIALTY_KEYWORDS)) {
      if (specialty === 'general') continue;
      for (const keyword of keywords as string[]) {
        if (text.includes(keyword.toLowerCase())) {
          matched.add(specialty as SupervisorSpecialty);
          break;
        }
      }
    }

    return matched.size > 0 ? Array.from(matched) : ['general'];
  }

  async selectOptimalTeam(task: DevelopmentTask, options?: {
    minTeamSize?: number;
    maxTeamSize?: number;
    includeHistoricalPerformance?: boolean;
    diversityBonus?: boolean;
  }): Promise<Supervisor[]> {
    const taskSpecialties = this.analyzeTaskSpecialties(task);
    const fileSpecialties = this.inferSpecialtiesFromFiles(task.files);
    const allSpecialties = [...new Set([...taskSpecialties, ...fileSpecialties])];
    const complexity = this.estimateTaskComplexity(task);
    const available = await this.getAvailableSupervisors();

    if (available.length === 0) return [];

    const minSize = options?.minTeamSize ?? Math.min(2, available.length);
    const maxSize = options?.maxTeamSize ?? Math.min(5, available.length);
    const useHistory = options?.includeHistoricalPerformance ?? true;
    const diversityBonus = options?.diversityBonus ?? true;

    const scored = available.map(supervisor => {
      const supervisorSpecs = this.getSupervisorSpecialties(supervisor.name);
      
      let specialtyScore = allSpecialties.filter(ts => 
        supervisorSpecs.includes(ts) || supervisorSpecs.includes('general')
      ).length;
      
      if (supervisorSpecs.includes('general') && specialtyScore === 0) {
        specialtyScore = 0.5;
      }

      let performanceScore = 1.0;
      if (useHistory) {
        const analytics = this.supervisorAnalytics.get(supervisor.name);
        if (analytics && analytics.totalVotes >= 3) {
          const confidenceBonus = analytics.avgConfidence * 0.3;
          const consistencyBonus = Math.min(analytics.totalVotes / 20, 0.3);
          performanceScore = 1 + confidenceBonus + consistencyBonus;
        }
      }

      let complexityMatch = 1.0;
      if (complexity >= 0.7) {
        const hasArchitecture = supervisorSpecs.includes('architecture');
        const hasSecurity = supervisorSpecs.includes('security');
        if (hasArchitecture || hasSecurity) {
          complexityMatch = 1.3;
        }
      }

      const weight = this.getSupervisorWeight(supervisor.name);
      const totalScore = specialtyScore * weight * performanceScore * complexityMatch;
      
      return { supervisor, score: totalScore, specialties: supervisorSpecs };
    });

    scored.sort((a, b) => b.score - a.score);

    const hasMatches = scored.some(s => s.score > 0);
    if (!hasMatches) return available.slice(0, maxSize);

    let selectedTeam: typeof scored = [];
    const coveredSpecialties = new Set<SupervisorSpecialty>();

    for (const candidate of scored) {
      if (selectedTeam.length >= maxSize) break;
      
      let diversityScore = 0;
      if (diversityBonus) {
        for (const spec of candidate.specialties) {
          if (!coveredSpecialties.has(spec)) {
            diversityScore += 0.2;
          }
        }
      }

      const adjustedScore = candidate.score + diversityScore;
      const topScore = selectedTeam.length > 0 ? selectedTeam[0].score : candidate.score;
      
      if (selectedTeam.length < minSize || adjustedScore >= topScore * 0.4) {
        selectedTeam.push(candidate);
        candidate.specialties.forEach(s => coveredSpecialties.add(s));
      }
    }

    return selectedTeam.map(s => s.supervisor);
  }

  private inferSpecialtiesFromFiles(files: string[]): SupervisorSpecialty[] {
    const specialties = new Set<SupervisorSpecialty>();
    
    const filePatterns: Array<{ pattern: RegExp; specialty: SupervisorSpecialty }> = [
      { pattern: /\.(tsx?|jsx?)$/i, specialty: 'frontend' },
      { pattern: /\.(css|scss|less|styled)$/i, specialty: 'frontend' },
      { pattern: /\.(vue|svelte)$/i, specialty: 'frontend' },
      { pattern: /components?[\/\\]/i, specialty: 'frontend' },
      { pattern: /auth[\/\\]|authentication|authorization/i, specialty: 'security' },
      { pattern: /\.sql$|migrations?[\/\\]|schema/i, specialty: 'database' },
      { pattern: /prisma|drizzle|knex|sequelize/i, specialty: 'database' },
      { pattern: /routes?[\/\\]|controllers?[\/\\]|api[\/\\]/i, specialty: 'backend' },
      { pattern: /\.test\.|\.spec\.|__tests__|cypress|playwright/i, specialty: 'testing' },
      { pattern: /docker|kubernetes|k8s|\.ya?ml$|ci[\/\\]|\.github[\/\\]/i, specialty: 'devops' },
      { pattern: /readme|docs?[\/\\]|\.md$/i, specialty: 'documentation' },
      { pattern: /perf|benchmark|cache|optimize/i, specialty: 'performance' },
    ];

    for (const file of files) {
      for (const { pattern, specialty } of filePatterns) {
        if (pattern.test(file)) {
          specialties.add(specialty);
        }
      }
    }

    return Array.from(specialties);
  }

  private estimateTaskComplexity(task: DevelopmentTask): number {
    let complexity = 0;

    const fileCount = task.files.length;
    if (fileCount > 10) complexity += 0.3;
    else if (fileCount > 5) complexity += 0.2;
    else if (fileCount > 2) complexity += 0.1;

    const textLength = (task.description + (task.context || '')).length;
    if (textLength > 2000) complexity += 0.2;
    else if (textLength > 1000) complexity += 0.1;

    const complexKeywords = ['refactor', 'architecture', 'security', 'migration', 'breaking', 'performance', 'scale', 'distributed'];
    const text = (task.description + ' ' + (task.context || '')).toLowerCase();
    const keywordMatches = complexKeywords.filter(k => text.includes(k)).length;
    complexity += keywordMatches * 0.1;

    return Math.min(1, complexity);
  }

  async debateWithAutoSelect(task: DevelopmentTask): Promise<CouncilDecision & { selectedTeam: string[] }> {
    const team = await this.selectOptimalTeam(task);
    const teamNames = team.map(s => s.name);

    if (team.length === 0) {
      return {
        approved: true,
        consensus: 1.0,
        weightedConsensus: 1.0,
        votes: [],
        reasoning: 'No supervisors available - auto-approving',
        dissent: [],
        selectedTeam: [],
      };
    }

    const decision = await this.debateWithTeam(task, team);
    return { ...decision, selectedTeam: teamNames };
  }

  private async debateWithTeam(task: DevelopmentTask, team: Supervisor[]): Promise<CouncilDecision> {
    const startTime = Date.now();

    if (team.length === 0) {
      return {
        approved: true,
        consensus: 1.0,
        weightedConsensus: 1.0,
        votes: [],
        reasoning: 'No supervisors in team - auto-approving',
        dissent: [],
      };
    }

    const rounds = this.config.debateRounds || 2;
    const votes: Vote[] = [];

    const taskContext: CouncilMessage = {
      role: 'user',
      content: this.formatTaskForDebate(task),
    };

    const initialOpinions = await Promise.all(
      team.map(async (supervisor) => {
        try {
          const response = await supervisor.chat([taskContext]);
          return `**${supervisor.name}**: ${response}`;
        } catch {
          return `**${supervisor.name}**: [Unable to provide opinion]`;
        }
      })
    );

    let debateContext = taskContext.content + '\n\n**Initial Opinions:**\n' + initialOpinions.join('\n\n');

    for (let round = 2; round <= rounds; round++) {
      const roundOpinions = await Promise.all(
        team.map(async (supervisor) => {
          try {
            const message: CouncilMessage = {
              role: 'user',
              content: debateContext + '\n\nConsidering the above opinions, provide your refined assessment.',
            };
            const response = await supervisor.chat([message]);
            return `**${supervisor.name}**: ${response}`;
          } catch {
            return null;
          }
        })
      );
      const validOpinions = roundOpinions.filter((o): o is string => o !== null);
      debateContext += '\n\n**Round ' + round + ' Opinions:**\n' + validOpinions.join('\n\n');
    }

    // Stage 2: Anonymous Cross-Review (karpathy/llm-council pattern)
    const opinionMap = this.extractOpinionsFromDebateContext(debateContext, team);
    let peerReviewBoosts: Map<string, number> | null = null;

    if (opinionMap.size >= 2) {
      const crossReviews = await this.collectCrossReviews(team, opinionMap, task.description);
      const validReviews = crossReviews.filter(r => r.rankings.length > 0);

      if (validReviews.length > 0) {
        const { labelToSupervisor } = this.anonymizeOpinions(opinionMap);
        const aggregateRankings = this.calculateAggregateRankings(validReviews, labelToSupervisor);
        peerReviewBoosts = aggregateRankings.peerReviewBoosts;
        const reviewSummary = this.formatCrossReviewSummary(validReviews, aggregateRankings);
        debateContext += '\n\n**Anonymous Peer Reviews:**\n' + reviewSummary;
      }
    }

    const voteResults = await Promise.all(
      team.map(async (supervisor) => {
        try {
          const votePrompt: CouncilMessage = {
            role: 'user',
            content: debateContext +
              '\n\nBased on all discussions, provide your FINAL VOTE:\n' +
              '1. Vote: APPROVE or REJECT\n' +
              '2. Confidence: A number between 0.0 and 1.0\n' +
              '3. Brief reasoning (2-3 sentences)\n\n' +
              'Format:\nVOTE: [APPROVE/REJECT]\nCONFIDENCE: [0.0-1.0]\nREASONING: [your reasoning]',
          };
          const response = await supervisor.chat([votePrompt]);
          const approved = this.parseVote(response);
          const confidence = this.parseConfidence(response);
          const baseWeight = this.getSupervisorWeight(supervisor.name);
          const peerBoost = peerReviewBoosts?.get(supervisor.name) ?? 1;
          const weight = baseWeight * peerBoost;
          return { supervisor: supervisor.name, approved, confidence, weight, comment: response };
        } catch {
          return {
            supervisor: supervisor.name,
            approved: false,
            confidence: 0.5,
            weight: this.getSupervisorWeight(supervisor.name),
            comment: 'Failed to vote',
          };
        }
      })
    );

    votes.push(...voteResults);

    const approvals = votes.filter(v => v.approved).length;
    const consensus = votes.length > 0 ? approvals / votes.length : 0;
    const weightedConsensus = this.calculateWeightedConsensus(votes);
    const dissent = this.extractDissent(votes);

    const leadVote = this.config.leadSupervisor
      ? votes.find(v => v.supervisor === this.config.leadSupervisor)
      : undefined;

    const mode = this.config.consensusMode;
    const handler = this.consensusHandlers[mode];
    const { approved, reasoning: modeReasoning } = handler(votes, this.config, leadVote);

    const durationMs = Date.now() - startTime;
    console.log(`[Council] Team debate completed in ${durationMs}ms with ${votes.length} votes`);

    this.recordDebateAnalytics(votes, approved, consensus, durationMs);

    return {
      approved,
      consensus,
      weightedConsensus,
      votes,
      reasoning: this.generateConsensusReasoning(votes, approved, weightedConsensus, dissent, mode, modeReasoning),
      dissent,
    };
  }

  private anonymizeOpinions(
    opinions: Map<string, string>
  ): { anonymized: Map<string, string>; labelToSupervisor: Map<string, string> } {
    const anonymized = new Map<string, string>();
    const labelToSupervisor = new Map<string, string>();
    let index = 0;

    for (const [supervisor, opinion] of opinions) {
      const label = `Response ${String.fromCharCode(65 + index)}`;
      anonymized.set(label, opinion);
      labelToSupervisor.set(label, supervisor);
      index++;
    }

    return { anonymized, labelToSupervisor };
  }

  private extractOpinionsFromDebateContext(
    debateContext: string,
    supervisors: Supervisor[]
  ): Map<string, string> {
    const opinions = new Map<string, string>();

    for (const supervisor of supervisors) {
      const pattern = new RegExp(`\\*\\*${supervisor.name}\\*\\*:\\s*([\\s\\S]*?)(?=\\*\\*[^*]+\\*\\*:|$)`, 'g');
      const matches = [...debateContext.matchAll(pattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        opinions.set(supervisor.name, lastMatch[1].trim());
      }
    }

    return opinions;
  }

  private async collectCrossReviews(
    supervisors: Supervisor[],
    opinions: Map<string, string>,
    taskDescription: string
  ): Promise<CrossReviewResult[]> {
    const { anonymized, labelToSupervisor } = this.anonymizeOpinions(opinions);

    const responsesText = Array.from(anonymized.entries())
      .map(([label, opinion]) => `**${label}:**\n${opinion}`)
      .join('\n\n---\n\n');

    const crossReviewPrompt = `You are evaluating peer responses to this task:
${taskDescription}

Here are the anonymized responses from other reviewers:

${responsesText}

Your task:
1. Evaluate each response for accuracy, insight, and completeness
2. Identify strengths and weaknesses of each
3. Provide your final ranking

IMPORTANT: End your response with a clear ranking section in this exact format:

FINAL RANKING:
1. Response X (best)
2. Response Y
3. Response Z (worst)

Replace X, Y, Z with the actual letters (A, B, C, etc.)`;

    const results = await Promise.all(
      supervisors.map(async (supervisor) => {
        const selfLabel = Array.from(labelToSupervisor.entries())
          .find(([_, name]) => name === supervisor.name)?.[0];

        const filteredText = Array.from(anonymized.entries())
          .filter(([label]) => label !== selfLabel)
          .map(([label, opinion]) => `**${label}:**\n${opinion}`)
          .join('\n\n---\n\n');

        const personalizedPrompt = crossReviewPrompt.replace(responsesText, filteredText);

        try {
          const response = await supervisor.chat([{ role: 'user', content: personalizedPrompt }]);
          const rankings = this.parseRankings(response, labelToSupervisor);
          return { reviewer: supervisor.name, rankings, rawResponse: response };
        } catch {
          return { reviewer: supervisor.name, rankings: [], rawResponse: 'Failed to provide cross-review' };
        }
      })
    );

    return results;
  }

  private parseRankings(
    response: string,
    labelToSupervisor: Map<string, string>
  ): CrossReviewRanking[] {
    const rankings: CrossReviewRanking[] = [];
    const rankingSection = response.split(/FINAL RANKING:/i)[1];

    if (!rankingSection) return rankings;

    const rankPattern = /(\d+)\.\s*Response\s+([A-Z])/gi;
    let match;

    while ((match = rankPattern.exec(rankingSection)) !== null) {
      const rank = parseInt(match[1], 10);
      const letter = match[2].toUpperCase();
      const label = `Response ${letter}`;

      if (labelToSupervisor.has(label)) {
        rankings.push({ anonymousId: label, rank });
      }
    }

    return rankings;
  }

  private calculateAggregateRankings(
    crossReviews: CrossReviewResult[],
    labelToSupervisor: Map<string, string>
  ): AggregateRankings {
    const rankSums = new Map<string, number[]>();

    for (const review of crossReviews) {
      for (const ranking of review.rankings) {
        const supervisor = labelToSupervisor.get(ranking.anonymousId);
        if (supervisor) {
          const existing = rankSums.get(supervisor) ?? [];
          existing.push(ranking.rank);
          rankSums.set(supervisor, existing);
        }
      }
    }

    const supervisorRankings = new Map<string, number>();
    const peerReviewBoosts = new Map<string, number>();

    for (const [supervisor, ranks] of rankSums) {
      const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 999;
      supervisorRankings.set(supervisor, avgRank);

      const totalParticipants = labelToSupervisor.size;
      const midpoint = (totalParticipants + 1) / 2;
      const boost = 1 + (midpoint - avgRank) * 0.1;
      peerReviewBoosts.set(supervisor, Math.max(0.5, Math.min(1.5, boost)));
    }

    return { supervisorRankings, peerReviewBoosts };
  }

  private formatCrossReviewSummary(
    crossReviews: CrossReviewResult[],
    aggregateRankings: AggregateRankings
  ): string {
    const sorted = Array.from(aggregateRankings.supervisorRankings.entries())
      .sort((a, b) => a[1] - b[1]);

    let summary = '**Peer Review Leaderboard:**\n';
    for (let i = 0; i < sorted.length; i++) {
      const [supervisor, avgRank] = sorted[i];
      const boost = aggregateRankings.peerReviewBoosts.get(supervisor) ?? 1;
      summary += `${i + 1}. ${supervisor} (avg rank: ${avgRank.toFixed(2)}, vote weight boost: ${boost.toFixed(2)}x)\n`;
    }

    return summary;
  }

  setLeadSupervisor(name: string): void {
    this.config.leadSupervisor = name;
  }

  getLeadSupervisor(): string | undefined {
    return this.config.leadSupervisor;
  }

  setFallbackChain(supervisors: string[]): void {
    this.config.fallbackSupervisors = supervisors;
  }

  getFallbackChain(): string[] {
    return this.config.fallbackSupervisors ?? [];
  }

  setConsensusMode(mode: ConsensusMode): void {
    this.config.consensusMode = mode;
  }

  getConsensusMode(): ConsensusMode {
    return this.config.consensusMode ?? 'weighted';
  }

  async getAvailableSupervisors(): Promise<Supervisor[]> {
    return this.registry.getAvailable();
  }

  async getNextFallbackSupervisor(): Promise<Supervisor | null> {
    const fallbackChain = this.config.fallbackSupervisors ?? [];
    
    while (this.fallbackIndex < fallbackChain.length) {
      const name = fallbackChain[this.fallbackIndex];
      const supervisor = this.registry.get(name);
      this.fallbackIndex++;
      
      if (supervisor && await supervisor.isAvailable()) {
        return supervisor;
      }
    }
    
    this.fallbackIndex = 0;
    return null;
  }

  async chatWithFallback(messages: CouncilMessage[]): Promise<{ response: string; supervisor: string } | null> {
    if (this.config.leadSupervisor) {
      const lead = this.registry.get(this.config.leadSupervisor);
      if (lead && await lead.isAvailable()) {
        try {
          const response = await lead.chat(messages);
          return { response, supervisor: lead.name };
        } catch {
          // Fall through to fallback chain
        }
      }
    }

    let fallback = await this.getNextFallbackSupervisor();
    while (fallback) {
      try {
        const response = await fallback.chat(messages);
        return { response, supervisor: fallback.name };
      } catch {
        fallback = await this.getNextFallbackSupervisor();
      }
    }

    const available = await this.getAvailableSupervisors();
    for (const supervisor of available) {
      try {
        const response = await supervisor.chat(messages);
        return { response, supervisor: supervisor.name };
      } catch {
        continue;
      }
    }

    return null;
  }

  async debate(task: DevelopmentTask): Promise<CouncilDecision> {
    const startTime = Date.now();
    
    const available = await this.getAvailableSupervisors();
    
    if (available.length === 0) {
      return {
        approved: true,
        consensus: 1.0,
        weightedConsensus: 1.0,
        votes: [],
        reasoning: 'No supervisors available - auto-approving',
        dissent: [],
      };
    }

    const rounds = this.config.debateRounds || 2;
    const votes: Vote[] = [];

    const taskContext: CouncilMessage = {
      role: 'user',
      content: this.formatTaskForDebate(task),
    };

    const initialOpinions = await Promise.all(
      available.map(async (supervisor) => {
        try {
          const response = await supervisor.chat([taskContext]);
          return `**${supervisor.name}**: ${response}`;
        } catch {
          return `**${supervisor.name}**: [Unable to provide opinion]`;
        }
      })
    );

    let debateContext = taskContext.content + '\n\n**Initial Opinions:**\n' + initialOpinions.join('\n\n');
    
    for (let round = 2; round <= rounds; round++) {
      const roundOpinions = await Promise.all(
        available.map(async (supervisor) => {
          try {
            const message: CouncilMessage = {
              role: 'user',
              content: debateContext + '\n\nConsidering the above opinions, provide your refined assessment.',
            };
            
            const response = await supervisor.chat([message]);
            return `**${supervisor.name}**: ${response}`;
          } catch {
            return null;
          }
        })
      );
      
      const validOpinions = roundOpinions.filter((o): o is string => o !== null);
      debateContext += '\n\n**Round ' + round + ' Opinions:**\n' + validOpinions.join('\n\n');
    }

    // Stage 2: Anonymous Cross-Review (karpathy/llm-council pattern)
    const opinionMap = this.extractOpinionsFromDebateContext(debateContext, available);
    let peerReviewBoosts: Map<string, number> | null = null;

    if (opinionMap.size >= 2) {
      const crossReviews = await this.collectCrossReviews(available, opinionMap, task.description);
      const validReviews = crossReviews.filter(r => r.rankings.length > 0);

      if (validReviews.length > 0) {
        const { labelToSupervisor } = this.anonymizeOpinions(opinionMap);
        const aggregateRankings = this.calculateAggregateRankings(validReviews, labelToSupervisor);
        peerReviewBoosts = aggregateRankings.peerReviewBoosts;
        const reviewSummary = this.formatCrossReviewSummary(validReviews, aggregateRankings);
        debateContext += '\n\n**Anonymous Peer Reviews:**\n' + reviewSummary;
      }
    }

    const voteResults = await Promise.all(
      available.map(async (supervisor) => {
        try {
          const votePrompt: CouncilMessage = {
            role: 'user',
            content: debateContext + 
              '\n\nBased on all discussions, provide your FINAL VOTE:\n' +
              '1. Vote: APPROVE or REJECT\n' +
              '2. Confidence: A number between 0.0 and 1.0\n' +
              '3. Brief reasoning (2-3 sentences)\n\n' +
              'Format:\nVOTE: [APPROVE/REJECT]\nCONFIDENCE: [0.0-1.0]\nREASONING: [your reasoning]',
          };
          
          const response = await supervisor.chat([votePrompt]);
          const approved = this.parseVote(response);
          const confidence = this.parseConfidence(response);
          const baseWeight = this.getSupervisorWeight(supervisor.name);
          const peerBoost = peerReviewBoosts?.get(supervisor.name) ?? 1;
          const weight = baseWeight * peerBoost;
          
          return {
            supervisor: supervisor.name,
            approved,
            confidence,
            weight,
            comment: response,
          };
        } catch {
          return {
            supervisor: supervisor.name,
            approved: false,
            confidence: 0.5,
            weight: this.getSupervisorWeight(supervisor.name),
            comment: 'Failed to vote',
          };
        }
      })
    );

    votes.push(...voteResults);

    const approvals = votes.filter(v => v.approved).length;
    const consensus = votes.length > 0 ? approvals / votes.length : 0;
    const weightedConsensus = this.calculateWeightedConsensus(votes);
    const dissent = this.extractDissent(votes);

    const leadVote = this.config.leadSupervisor 
      ? votes.find(v => v.supervisor === this.config.leadSupervisor)
      : undefined;

    const mode = this.config.consensusMode;
    const handler = this.consensusHandlers[mode];
    const { approved, reasoning: modeReasoning } = handler(votes, this.config, leadVote);

    const durationMs = Date.now() - startTime;
    console.log(`[Council] Debate completed in ${durationMs}ms with ${votes.length} votes`);

    this.recordDebateAnalytics(votes, approved, consensus, durationMs);

    return {
      approved,
      consensus,
      weightedConsensus,
      votes,
      reasoning: this.generateConsensusReasoning(votes, approved, weightedConsensus, dissent, mode, modeReasoning),
      dissent,
    };
  }

  private handleSimpleMajority(votes: Vote[], config: CouncilConfig): { approved: boolean; reasoning: string } {
    const approvals = votes.filter(v => v.approved).length;
    const consensus = votes.length > 0 ? approvals / votes.length : 0;
    const threshold = config.consensusThreshold ?? 0.5;
    const approved = consensus >= threshold;
    return {
      approved,
      reasoning: `Simple majority: ${approvals}/${votes.length} (${(consensus * 100).toFixed(0)}%) approved (threshold: ${(threshold * 100).toFixed(0)}%)`,
    };
  }

  private handleSupermajority(votes: Vote[]): { approved: boolean; reasoning: string } {
    const approvals = votes.filter(v => v.approved).length;
    const threshold = votes.length * 0.667;
    const approved = approvals >= threshold;
    return {
      approved,
      reasoning: `Supermajority: ${approvals}/${votes.length} approved (need >=${Math.ceil(threshold)}, 66.7%)`,
    };
  }

  private handleUnanimous(votes: Vote[]): { approved: boolean; reasoning: string } {
    const approvals = votes.filter(v => v.approved).length;
    const approved = approvals === votes.length;
    return {
      approved,
      reasoning: `Unanimous: ${approvals}/${votes.length} approved (need ${votes.length}/${votes.length})`,
    };
  }

  private handleWeighted(votes: Vote[], config: CouncilConfig): { approved: boolean; reasoning: string } {
    const weightedConsensus = this.calculateWeightedConsensus(votes);
    const threshold = config.consensusThreshold ?? 0.5;
    const approved = weightedConsensus >= threshold;
    return {
      approved,
      reasoning: `Weighted consensus: ${(weightedConsensus * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
    };
  }

  private handleCeoOverride(votes: Vote[], config: CouncilConfig, leadVote?: Vote): { approved: boolean; reasoning: string } {
    if (!leadVote) {
      return this.handleWeighted(votes, config);
    }
    
    return {
      approved: leadVote.approved,
      reasoning: `CEO Override: ${config.leadSupervisor} ${leadVote.approved ? 'APPROVED' : 'REJECTED'} (confidence: ${leadVote.confidence.toFixed(2)})`,
    };
  }

  private handleCeoVeto(votes: Vote[], config: CouncilConfig, leadVote?: Vote): { approved: boolean; reasoning: string } {
    const approvals = votes.filter(v => v.approved).length;
    const majorityApproved = approvals > votes.length / 2;
    
    if (leadVote && !leadVote.approved && leadVote.confidence >= 0.7) {
      return {
        approved: false,
        reasoning: `CEO Veto: ${config.leadSupervisor} VETOED with high confidence (${leadVote.confidence.toFixed(2)}). Majority was ${majorityApproved ? 'in favor' : 'against'}.`,
      };
    }
    
    return {
      approved: majorityApproved,
      reasoning: `CEO Veto (not used): Majority ${majorityApproved ? 'approved' : 'rejected'} (${approvals}/${votes.length}). ${config.leadSupervisor || 'Lead'} did not veto.`,
    };
  }

  private handleHybridCeoMajority(votes: Vote[], config: CouncilConfig, leadVote?: Vote): { approved: boolean; reasoning: string } {
    const approvals = votes.filter(v => v.approved).length;
    const rejections = votes.length - approvals;
    
    if (approvals > rejections + 1) {
      return {
        approved: true,
        reasoning: `Hybrid CEO-Majority: Clear majority approved (${approvals}/${votes.length})`,
      };
    }
    
    if (rejections > approvals + 1) {
      return {
        approved: false,
        reasoning: `Hybrid CEO-Majority: Clear majority rejected (${rejections}/${votes.length} against)`,
      };
    }
    
    if (leadVote) {
      return {
        approved: leadVote.approved,
        reasoning: `Hybrid CEO-Majority: Tie/close vote (${approvals}-${rejections}), ${config.leadSupervisor} breaks tie: ${leadVote.approved ? 'APPROVED' : 'REJECTED'}`,
      };
    }
    
    return {
      approved: approvals >= rejections,
      reasoning: `Hybrid CEO-Majority: Tie/close vote (${approvals}-${rejections}), no CEO to break tie, defaulting to ${approvals >= rejections ? 'approve' : 'reject'}`,
    };
  }

  private handleRankedChoice(votes: Vote[]): { approved: boolean; reasoning: string } {
    let approveScore = 0;
    let rejectScore = 0;
    
    for (const vote of votes) {
      const score = vote.weight * vote.confidence;
      if (vote.approved) {
        approveScore += score;
      } else {
        rejectScore += score;
      }
    }
    
    const approved = approveScore >= rejectScore;
    return {
      approved,
      reasoning: `Ranked Choice: Approve score ${approveScore.toFixed(2)} vs Reject score ${rejectScore.toFixed(2)}`,
    };
  }

  private calculateWeightedConsensus(votes: Vote[]): number {
    if (votes.length === 0) return 0;

    let weightedApprovals = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      const effectiveWeight = vote.weight * vote.confidence;
      totalWeight += vote.weight;
      if (vote.approved) {
        weightedApprovals += effectiveWeight;
      }
    }

    return totalWeight > 0 ? weightedApprovals / totalWeight : 0;
  }

  private extractDissent(votes: Vote[]): string[] {
    const dissent: string[] = [];
    
    for (const vote of votes) {
      if (!vote.approved && vote.confidence > 0.7) {
        const shortComment = vote.comment.length > 300 
          ? vote.comment.substring(0, 300) + '...' 
          : vote.comment;
        dissent.push(`${vote.supervisor} (confidence: ${vote.confidence.toFixed(2)}): ${shortComment}`);
      }
    }
    
    return dissent;
  }

  private recordDebateAnalytics(votes: Vote[], approved: boolean, consensus: number, durationMs: number): void {
    const perSupervisorTime = votes.length > 0 ? durationMs / votes.length : 0;
    const now = new Date().toISOString();

    for (const vote of votes) {
      let stats = this.supervisorAnalytics.get(vote.supervisor);
      if (!stats) {
        stats = {
          totalVotes: 0,
          approvals: 0,
          rejections: 0,
          approvalRate: 0,
          avgConfidence: 0,
          totalResponseTimeMs: 0,
          avgResponseTimeMs: 0,
          lastVoteAt: null,
        };
      }

      stats.totalVotes += 1;
      if (vote.approved) {
        stats.approvals += 1;
      } else {
        stats.rejections += 1;
      }
      stats.approvalRate = stats.approvals / stats.totalVotes;
      stats.avgConfidence = ((stats.avgConfidence * (stats.totalVotes - 1)) + vote.confidence) / stats.totalVotes;
      stats.totalResponseTimeMs += perSupervisorTime;
      stats.avgResponseTimeMs = stats.totalResponseTimeMs / stats.totalVotes;
      stats.lastVoteAt = now;

      this.supervisorAnalytics.set(vote.supervisor, stats);
    }

    this.councilAnalytics.totalDebates += 1;
    if (approved) {
      this.councilAnalytics.totalApproved += 1;
    } else {
      this.councilAnalytics.totalRejected += 1;
    }
    const prevAvg = this.councilAnalytics.avgConsensus;
    const totalDebates = this.councilAnalytics.totalDebates;
    this.councilAnalytics.avgConsensus = ((prevAvg * (totalDebates - 1)) + consensus) / totalDebates;

    this.councilAnalytics.supervisorStats = Object.fromEntries(this.supervisorAnalytics);
  }

  getAnalytics(): CouncilAnalytics {
    return {
      ...this.councilAnalytics,
      supervisorStats: Object.fromEntries(this.supervisorAnalytics),
    };
  }

  getSupervisorAnalytics(name: string): SupervisorAnalytics | null {
    return this.supervisorAnalytics.get(name) ?? null;
  }

  resetAnalytics(): void {
    this.supervisorAnalytics.clear();
    this.councilAnalytics = {
      totalDebates: 0,
      totalApproved: 0,
      totalRejected: 0,
      avgConsensus: 0,
      supervisorStats: {},
    };
  }

  getTemplates(): DebateTemplate[] {
    return [...BUILTIN_TEMPLATES, ...this.customTemplates.values()];
  }

  getTemplate(id: string): DebateTemplate | null {
    const builtin = BUILTIN_TEMPLATES.find(t => t.id === id);
    if (builtin) return builtin;
    return this.customTemplates.get(id) ?? null;
  }

  addCustomTemplate(template: DebateTemplate): void {
    if (BUILTIN_TEMPLATES.some(t => t.id === template.id)) {
      throw new Error(`Cannot override builtin template: ${template.id}`);
    }
    this.customTemplates.set(template.id, template);
  }

  removeCustomTemplate(id: string): boolean {
    return this.customTemplates.delete(id);
  }

  async debateWithTemplate(task: DevelopmentTask, templateId: string): Promise<CouncilDecision & { templateUsed: string }> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const originalConfig = { ...this.config };

    this.config.consensusMode = template.consensusMode;
    this.config.debateRounds = template.debateRounds;
    this.config.consensusThreshold = template.consensusThreshold;

    const taskWithPrompt: DevelopmentTask = {
      ...task,
      context: `${template.systemPrompt}\n\n${task.context ?? ''}`,
    };

    const available = await this.getAvailableSupervisors();
    const team = available.filter(s => {
      const specs = this.getSupervisorSpecialties(s.name);
      return template.requiredSpecialties.some(rs => specs.includes(rs) || specs.includes('general'));
    });

    const finalTeam = team.length > 0 ? team : available;

    let decision: CouncilDecision;
    if (finalTeam.length === available.length) {
      decision = await this.debate(taskWithPrompt);
    } else {
      decision = await this.debateWithTeam(taskWithPrompt, finalTeam);
    }

    this.config = originalConfig;

    return { ...decision, templateUsed: template.id };
  }

  private parseConfidence(response: string): number {
    const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
    if (confidenceMatch) {
      const value = parseFloat(confidenceMatch[1]);
      if (!isNaN(value)) {
        return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value));
      }
    }

    const altMatch = response.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
    if (altMatch) {
      const value = parseFloat(altMatch[1]);
      if (!isNaN(value)) {
        return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value));
      }
    }

    return 0.7;
  }

  private formatTaskForDebate(task: DevelopmentTask): string {
    return `
# Development Task Review

**Task ID**: ${task.id}
**Description**: ${task.description}

**Context**: 
${task.context}

**Files Affected**: 
${task.files.join('\n')}

**Your Role**: 
As a supervisor, review this development task and provide your expert opinion on:
1. Code quality and best practices
2. Potential issues or risks
3. Suggestions for improvement
4. Whether this task should be approved to proceed

Be thorough but concise in your analysis.
`.trim();
  }

  private parseVote(response: string): boolean {
    const normalized = response.toUpperCase();
    
    if (normalized.includes('VOTE: APPROVE') || normalized.includes('VOTE:APPROVE')) {
      return true;
    }
    if (normalized.includes('VOTE: REJECT') || normalized.includes('VOTE:REJECT')) {
      return false;
    }
    
    const approveMatch = /\b(APPROVE|APPROVED|ACCEPT|ACCEPTED|LGTM)\b/.test(normalized);
    const rejectMatch = /\b(REJECT|REJECTED|DENY|DENIED)\b/.test(normalized);
    
    if (approveMatch && !rejectMatch) return true;
    if (rejectMatch && !approveMatch) return false;
    
    return false;
  }

  private generateConsensusReasoning(
    votes: Vote[], 
    approved: boolean,
    weightedConsensus: number,
    dissent: string[],
    mode: ConsensusMode,
    modeReasoning: string
  ): string {
    const approvals = votes.filter(v => v.approved).length;
    const avgConfidence = votes.length > 0 
      ? votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length 
      : 0;
    
    let reasoning = `After ${votes.length} supervisor votes using **${mode}** mode, `;
    
    if (approved) {
      reasoning += `the council has reached consensus to APPROVE this task.`;
    } else {
      reasoning += `the council has decided to REJECT this task.`;
    }

    reasoning += `\n\n**Consensus Mode Decision:**\n${modeReasoning}`;

    reasoning += `\n\n**Voting Summary:**`;
    reasoning += `\n- Simple consensus: ${approvals}/${votes.length} approved (${(approvals/votes.length*100).toFixed(0)}%)`;
    reasoning += `\n- Weighted consensus: ${(weightedConsensus * 100).toFixed(1)}%`;
    reasoning += `\n- Average confidence: ${(avgConfidence * 100).toFixed(1)}%`;
    
    if (this.config.leadSupervisor) {
      const leadVote = votes.find(v => v.supervisor === this.config.leadSupervisor);
      if (leadVote) {
        reasoning += `\n- Lead supervisor (${this.config.leadSupervisor}): ${leadVote.approved ? 'APPROVED' : 'REJECTED'} (confidence: ${leadVote.confidence.toFixed(2)})`;
      }
    }
    
    if (dissent.length > 0) {
      reasoning += `\n\n**Strong Dissenting Opinions (${dissent.length}):**`;
      for (const d of dissent) {
        reasoning += `\n- ${d}`;
      }
    }

    reasoning += '\n\n**Individual Votes:**';
    
    for (const vote of votes) {
      const status = vote.approved ? 'APPROVED' : 'REJECTED';
      const isLead = vote.supervisor === this.config.leadSupervisor ? ' [LEAD]' : '';
      const comment = vote.comment.length > 150 ? vote.comment.substring(0, 150) + '...' : vote.comment;
      reasoning += `\n- ${status} ${vote.supervisor}${isLead} (weight: ${vote.weight.toFixed(1)}, confidence: ${vote.confidence.toFixed(2)}): ${comment}`;
    }
    
    return reasoning;
  }

  getSupervisors(): Supervisor[] {
    return this.registry.getAll();
  }

  getSupervisor(name: string): Supervisor | undefined {
    return this.registry.get(name);
  }

  clearSupervisors(): void {
    this.registry.clear();
    this.supervisorWeights.clear();
  }

  setDebateRounds(rounds: number): void {
    this.config.debateRounds = rounds;
  }

  setConsensusThreshold(threshold: number): void {
    this.config.consensusThreshold = threshold;
  }

  setWeightedVoting(enabled: boolean): void {
    this.config.weightedVoting = enabled;
    const currentMode = this.config.consensusMode ?? 'weighted';
    if (!enabled && (currentMode === 'weighted' || !this.config.consensusMode)) {
      this.config.consensusMode = 'simple-majority';
    } else if (enabled && currentMode === 'simple-majority') {
      this.config.consensusMode = 'weighted';
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): CouncilConfig {
    return { ...this.config };
  }

  getStatus(): {
    enabled: boolean;
    supervisorCount: number;
    availableSupervisors: string[];
    consensusMode: ConsensusMode;
    leadSupervisor?: string;
  } {
    return {
      enabled: this.config.enabled,
      supervisorCount: this.registry.size(),
      availableSupervisors: this.registry.getAll().map(s => s.name),
      consensusMode: this.config.consensusMode,
      leadSupervisor: this.config.leadSupervisor,
    };
  }
}
