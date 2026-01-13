import { EventEmitter } from 'events';

export interface ArchitectConfig {
  reasoningModel: string;
  editingModel: string;
  maxReasoningTokens?: number;
  maxEditingTokens?: number;
  temperature?: number;
  autoApprove?: boolean;
}

export interface EditPlan {
  id: string;
  description: string;
  files: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
    reasoning: string;
  }>;
  steps: string[];
  risks: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface EditResult {
  planId: string;
  success: boolean;
  filesModified: string[];
  errors: string[];
  rollbackAvailable: boolean;
}

export interface ArchitectSession {
  id: string;
  task: string;
  plan: EditPlan | null;
  status: 'reasoning' | 'planning' | 'editing' | 'reviewing' | 'complete' | 'error';
  reasoningOutput: string;
  editOutput: string;
  startedAt: number;
  completedAt?: number;
}

export type ModelChatFn = (
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { maxTokens?: number; temperature?: number }
) => Promise<string>;

export class ArchitectMode extends EventEmitter {
  private config: Required<ArchitectConfig>;
  private chatFn: ModelChatFn | null = null;
  private sessions: Map<string, ArchitectSession> = new Map();
  private fileBackups: Map<string, Map<string, string>> = new Map();

  constructor(config: ArchitectConfig) {
    super();
    this.config = {
      reasoningModel: config.reasoningModel,
      editingModel: config.editingModel,
      maxReasoningTokens: config.maxReasoningTokens ?? 4000,
      maxEditingTokens: config.maxEditingTokens ?? 8000,
      temperature: config.temperature ?? 0.3,
      autoApprove: config.autoApprove ?? false,
    };
  }

  setChatFunction(fn: ModelChatFn): void {
    this.chatFn = fn;
  }

  async startSession(task: string): Promise<ArchitectSession> {
    if (!this.chatFn) {
      throw new Error('Chat function not set. Call setChatFunction first.');
    }

    const session: ArchitectSession = {
      id: `arch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      task,
      plan: null,
      status: 'reasoning',
      reasoningOutput: '',
      editOutput: '',
      startedAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.emit('sessionStarted', { sessionId: session.id, task });

    try {
      session.reasoningOutput = await this.reason(session, task);
      session.status = 'planning';
      
      session.plan = await this.createPlan(session, task, session.reasoningOutput);
      this.emit('planCreated', { sessionId: session.id, plan: session.plan });

      if (this.config.autoApprove) {
        await this.executeEdits(session.id);
      } else {
        session.status = 'reviewing';
      }

    } catch (error) {
      session.status = 'error';
      this.emit('error', { sessionId: session.id, error });
    }

    return session;
  }

  private async reason(session: ArchitectSession, task: string): Promise<string> {
    const systemPrompt = `You are an expert software architect. Your role is to analyze tasks and reason about the best approach BEFORE any code is written.

Think step by step:
1. What is the user trying to accomplish?
2. What files/components need to be modified?
3. What are the dependencies and potential side effects?
4. What is the safest order of operations?
5. What could go wrong and how to mitigate?

Be thorough but concise. Focus on architecture and design decisions.`;

    const response = await this.chatFn!(
      this.config.reasoningModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task: ${task}\n\nProvide your architectural analysis and reasoning.` },
      ],
      { maxTokens: this.config.maxReasoningTokens, temperature: this.config.temperature }
    );

    this.emit('reasoningComplete', { sessionId: session.id, reasoning: response });
    return response;
  }

  private async createPlan(
    session: ArchitectSession,
    task: string,
    reasoning: string
  ): Promise<EditPlan> {
    const systemPrompt = `Based on the architectural analysis, create a concrete edit plan.

Output a JSON object with this structure:
{
  "description": "Brief summary of changes",
  "files": [
    { "path": "path/to/file.ts", "action": "modify", "reasoning": "Why this change" }
  ],
  "steps": ["Step 1: ...", "Step 2: ..."],
  "risks": ["Risk 1", "Risk 2"],
  "estimatedComplexity": "low|medium|high"
}

Be specific about file paths and actions.`;

    const response = await this.chatFn!(
      this.config.reasoningModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task: ${task}\n\nArchitectural Analysis:\n${reasoning}\n\nCreate the edit plan as JSON.` },
      ],
      { maxTokens: this.config.maxReasoningTokens, temperature: 0.1 }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse edit plan from response');
    }

    const planData = JSON.parse(jsonMatch[0]);
    
    return {
      id: `plan_${Date.now()}`,
      description: planData.description ?? 'No description',
      files: planData.files ?? [],
      steps: planData.steps ?? [],
      risks: planData.risks ?? [],
      estimatedComplexity: planData.estimatedComplexity ?? 'medium',
    };
  }

  async executeEdits(sessionId: string): Promise<EditResult> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.plan) {
      throw new Error('Session or plan not found');
    }

    session.status = 'editing';
    this.emit('editingStarted', { sessionId });

    const result: EditResult = {
      planId: session.plan.id,
      success: true,
      filesModified: [],
      errors: [],
      rollbackAvailable: true,
    };

    this.fileBackups.set(sessionId, new Map());

    try {
      for (const file of session.plan.files) {
        const editPrompt = this.buildEditPrompt(session.task, session.reasoningOutput, file);

        const editResponse = await this.chatFn!(
          this.config.editingModel,
          [
            { role: 'system', content: 'You are a code editor. Generate only the code changes requested. Be precise and follow the plan exactly.' },
            { role: 'user', content: editPrompt },
          ],
          { maxTokens: this.config.maxEditingTokens, temperature: 0.1 }
        );

        session.editOutput += `\n\n=== ${file.path} ===\n${editResponse}`;
        result.filesModified.push(file.path);

        this.emit('fileEdited', { sessionId, path: file.path });
      }

      session.status = 'complete';
      session.completedAt = Date.now();
      this.emit('editingComplete', { sessionId, result });

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      session.status = 'error';
      this.emit('editingFailed', { sessionId, error });
    }

    return result;
  }

  private buildEditPrompt(
    task: string,
    reasoning: string,
    file: EditPlan['files'][0]
  ): string {
    return `Task: ${task}

Reasoning: ${reasoning}

File to ${file.action}: ${file.path}
Reason for change: ${file.reasoning}

Generate the ${file.action === 'create' ? 'complete file content' : 'specific changes needed'}.
If modifying, show the changes in a clear format (old -> new or unified diff style).`;
  }

  approvePlan(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'reviewing') {
      return false;
    }
    this.executeEdits(sessionId);
    return true;
  }

  rejectPlan(sessionId: string, feedback?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'complete';
    session.completedAt = Date.now();
    this.emit('planRejected', { sessionId, feedback });
    return true;
  }

  async revisePlan(sessionId: string, feedback: string): Promise<EditPlan | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.plan) return null;

    const revisedPlan = await this.createPlan(
      session,
      `${session.task}\n\nRevision feedback: ${feedback}`,
      session.reasoningOutput
    );

    session.plan = revisedPlan;
    session.status = 'reviewing';
    this.emit('planRevised', { sessionId, plan: revisedPlan });

    return revisedPlan;
  }

  getSession(sessionId: string): ArchitectSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  listSessions(): ArchitectSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): ArchitectSession[] {
    return this.listSessions().filter(s => 
      s.status !== 'complete' && s.status !== 'error'
    );
  }

  updateConfig(updates: Partial<ArchitectConfig>): void {
    Object.assign(this.config, updates);
  }

  getConfig(): ArchitectConfig {
    return { ...this.config };
  }
}
