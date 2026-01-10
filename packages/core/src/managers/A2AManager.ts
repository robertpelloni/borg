import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapability[];
  skills: AgentSkill[];
  authentication?: AuthenticationInfo;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

export interface AgentCapability {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AuthenticationInfo {
  schemes: string[];
  credentials?: string;
}

export type TaskState = 
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface Task {
  id: string;
  sessionId: string;
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
  metadata?: Record<string, unknown>;
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp: string;
}

export interface Message {
  role: 'user' | 'agent';
  parts: MessagePart[];
  metadata?: Record<string, unknown>;
}

export type MessagePart = 
  | TextPart 
  | FilePart 
  | DataPart;

export interface TextPart {
  type: 'text';
  text: string;
}

export interface FilePart {
  type: 'file';
  file: FileContent;
}

export interface DataPart {
  type: 'data';
  data: Record<string, unknown>;
}

export interface FileContent {
  name?: string;
  mimeType?: string;
  bytes?: string;
  uri?: string;
}

export interface Artifact {
  name: string;
  description?: string;
  parts: MessagePart[];
  index?: number;
  append?: boolean;
  lastChunk?: boolean;
}

export interface TaskSendParams {
  id: string;
  sessionId?: string;
  message: Message;
  acceptedOutputModes?: string[];
  pushNotification?: PushNotificationConfig;
  metadata?: Record<string, unknown>;
}

export interface PushNotificationConfig {
  url: string;
  token?: string;
}

export interface TaskQueryParams {
  id: string;
  historyLength?: number;
}

export interface A2AError {
  code: number;
  message: string;
  data?: unknown;
}

interface RegisteredAgent {
  card: AgentCard;
  endpoint: string;
  lastSeen: Date;
  healthy: boolean;
}

interface A2ASession {
  id: string;
  agentUrl: string;
  tasks: Map<string, Task>;
  createdAt: Date;
  lastActivity: Date;
}

export class A2AManager extends EventEmitter {
  private static instance: A2AManager;
  private registeredAgents: Map<string, RegisteredAgent> = new Map();
  private sessions: Map<string, A2ASession> = new Map();
  private localAgentCard: AgentCard;
  private serverPort: number;

  private constructor() {
    super();
    this.serverPort = parseInt(process.env.A2A_PORT || '3001');
    this.localAgentCard = this.createLocalAgentCard();
  }

  public static getInstance(): A2AManager {
    if (!A2AManager.instance) {
      A2AManager.instance = new A2AManager();
    }
    return A2AManager.instance;
  }

  private createLocalAgentCard(): AgentCard {
    return {
      name: 'AIOS Meta-Orchestrator',
      description: 'Universal hub for MCP tools, agents, and services',
      url: `http://localhost:${this.serverPort}`,
      version: '0.3.0',
      capabilities: [{
        streaming: true,
        pushNotifications: true,
        stateTransitionHistory: true
      }],
      skills: [
        {
          id: 'orchestrate',
          name: 'Task Orchestration',
          description: 'Route and orchestrate tasks across multiple AI agents and tools',
          tags: ['orchestration', 'routing', 'mcp'],
          inputModes: ['text', 'file'],
          outputModes: ['text', 'file', 'data']
        },
        {
          id: 'code',
          name: 'Code Operations',
          description: 'Execute code analysis, generation, and transformation',
          tags: ['code', 'programming'],
          inputModes: ['text', 'file'],
          outputModes: ['text', 'file']
        },
        {
          id: 'memory',
          name: 'Memory Management',
          description: 'Store and retrieve contextual information',
          tags: ['memory', 'context', 'knowledge'],
          inputModes: ['text', 'data'],
          outputModes: ['text', 'data']
        }
      ],
      defaultInputModes: ['text'],
      defaultOutputModes: ['text']
    };
  }

  getAgentCard(): AgentCard {
    return this.localAgentCard;
  }

  async discoverAgent(url: string): Promise<AgentCard | null> {
    try {
      const wellKnownUrl = url.endsWith('/') 
        ? `${url}.well-known/agent.json` 
        : `${url}/.well-known/agent.json`;
      
      const response = await fetch(wellKnownUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.warn(`[A2A] Failed to discover agent at ${url}: ${response.status}`);
        return null;
      }

      const card = await response.json() as AgentCard;
      
      this.registeredAgents.set(url, {
        card,
        endpoint: url,
        lastSeen: new Date(),
        healthy: true
      });

      this.emit('agent:discovered', { url, card });
      return card;
    } catch (err) {
      console.error(`[A2A] Error discovering agent at ${url}:`, err);
      return null;
    }
  }

  async registerAgent(url: string, card: AgentCard): Promise<void> {
    this.registeredAgents.set(url, {
      card,
      endpoint: url,
      lastSeen: new Date(),
      healthy: true
    });
    this.emit('agent:registered', { url, card });
  }

  unregisterAgent(url: string): boolean {
    const removed = this.registeredAgents.delete(url);
    if (removed) {
      this.emit('agent:unregistered', { url });
    }
    return removed;
  }

  getRegisteredAgents(): RegisteredAgent[] {
    return Array.from(this.registeredAgents.values());
  }

  findAgentBySkill(skillId: string): RegisteredAgent | undefined {
    const agents = Array.from(this.registeredAgents.values());
    for (const agent of agents) {
      if (agent.card.skills.some(s => s.id === skillId)) {
        return agent;
      }
    }
    return undefined;
  }

  findAgentsByTag(tag: string): RegisteredAgent[] {
    const matches: RegisteredAgent[] = [];
    const agents = Array.from(this.registeredAgents.values());
    for (const agent of agents) {
      if (agent.card.skills.some(s => s.tags?.includes(tag))) {
        matches.push(agent);
      }
    }
    return matches;
  }

  async createSession(agentUrl: string): Promise<string> {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      id: sessionId,
      agentUrl,
      tasks: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    });
    this.emit('session:created', { sessionId, agentUrl });
    return sessionId;
  }

  async sendTask(agentUrl: string, params: TaskSendParams): Promise<Task> {
    const agent = this.registeredAgents.get(agentUrl);
    if (!agent) {
      throw new Error(`Agent not registered: ${agentUrl}`);
    }

    const taskEndpoint = `${agentUrl}/tasks/send`;
    
    try {
      const response = await fetch(taskEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/send',
          params,
          id: randomUUID()
        })
      });

      if (!response.ok) {
        throw new Error(`Task send failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      const task = result.result as Task;
      
      const session = this.sessions.get(params.sessionId || '');
      if (session) {
        session.tasks.set(task.id, task);
        session.lastActivity = new Date();
      }

      this.emit('task:sent', { agentUrl, task });
      return task;
    } catch (err) {
      this.emit('task:error', { agentUrl, params, error: err });
      throw err;
    }
  }

  async queryTask(agentUrl: string, params: TaskQueryParams): Promise<Task> {
    const taskEndpoint = `${agentUrl}/tasks/get`;
    
    const response = await fetch(taskEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/get',
        params,
        id: randomUUID()
      })
    });

    if (!response.ok) {
      throw new Error(`Task query failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result as Task;
  }

  async cancelTask(agentUrl: string, taskId: string): Promise<Task> {
    const taskEndpoint = `${agentUrl}/tasks/cancel`;
    
    const response = await fetch(taskEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/cancel',
        params: { id: taskId },
        id: randomUUID()
      })
    });

    if (!response.ok) {
      throw new Error(`Task cancel failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    this.emit('task:canceled', { agentUrl, taskId });
    return result.result as Task;
  }

  async *streamTask(agentUrl: string, params: TaskSendParams): AsyncGenerator<Task | Artifact> {
    const agent = this.registeredAgents.get(agentUrl);
    if (!agent?.card.capabilities[0]?.streaming) {
      throw new Error('Agent does not support streaming');
    }

    const taskEndpoint = `${agentUrl}/tasks/sendSubscribe`;
    
    const response = await fetch(taskEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/sendSubscribe',
        params,
        id: randomUUID()
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream task failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.result) {
              yield data.result;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async handleIncomingTask(params: TaskSendParams): Promise<Task> {
    const taskId = params.id || randomUUID();
    const sessionId = params.sessionId || randomUUID();

    const task: Task = {
      id: taskId,
      sessionId,
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString()
      },
      history: [params.message],
      artifacts: [],
      metadata: params.metadata
    };

    this.emit('task:received', { task });

    task.status = {
      state: 'working',
      timestamp: new Date().toISOString()
    };
    this.emit('task:working', { task });

    return task;
  }

  async completeTask(taskId: string, response: Message, artifacts?: Artifact[]): Promise<Task> {
    const task: Task = {
      id: taskId,
      sessionId: '',
      status: {
        state: 'completed',
        message: response,
        timestamp: new Date().toISOString()
      },
      artifacts
    };

    this.emit('task:completed', { task });
    return task;
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const entries = Array.from(this.registeredAgents.entries());
    
    for (const [url, agent] of entries) {
      try {
        const response = await fetch(`${url}/.well-known/agent.json`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        const healthy = response.ok;
        agent.healthy = healthy;
        agent.lastSeen = new Date();
        results.set(url, healthy);
      } catch {
        agent.healthy = false;
        results.set(url, false);
      }
    }

    this.emit('health:checked', { results: Object.fromEntries(results) });
    return results;
  }

  getSessionInfo(sessionId: string): A2ASession | undefined {
    return this.sessions.get(sessionId);
  }

  closeSession(sessionId: string): boolean {
    const removed = this.sessions.delete(sessionId);
    if (removed) {
      this.emit('session:closed', { sessionId });
    }
    return removed;
  }

  getStats(): {
    registeredAgents: number;
    healthyAgents: number;
    activeSessions: number;
    totalTasks: number;
  } {
    let totalTasks = 0;
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      totalTasks += session.tasks.size;
    }

    return {
      registeredAgents: this.registeredAgents.size,
      healthyAgents: Array.from(this.registeredAgents.values()).filter(a => a.healthy).length,
      activeSessions: this.sessions.size,
      totalTasks
    };
  }
}

export default A2AManager;
