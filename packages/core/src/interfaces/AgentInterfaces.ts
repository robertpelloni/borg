export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  inputSchema?: any;
  metadata?: Record<string, any>;
}

export type AgentMessageType = 'request' | 'response' | 'event' | 'error' | 'handshake';

export interface AgentMessage {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  type: AgentMessageType;
  content: any;
  timestamp: number;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface IAgentRegistry {
  register(agent: AgentProfile): void;
  unregister(agentId: string): void;
  getAgent(agentId: string): AgentProfile | undefined;
  listAgents(): AgentProfile[];
  findAgentsByCapability(capability: string): AgentProfile[];
}

export interface IAgentCommunicator {
  send(message: AgentMessage): Promise<void>;
  onMessage(handler: (message: AgentMessage) => void): void;
}
