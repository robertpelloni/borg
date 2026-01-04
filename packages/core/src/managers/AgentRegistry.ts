import { EventEmitter } from 'events';
import { IAgentRegistry, AgentProfile } from '../interfaces/AgentInterfaces.js';

export class AgentRegistry extends EventEmitter implements IAgentRegistry {
  private agents: Map<string, AgentProfile> = new Map();

  constructor() {
    super();
  }

  register(agent: AgentProfile): void {
    if (this.agents.has(agent.id)) {
      console.warn(`[AgentRegistry] Overwriting existing agent: ${agent.id}`);
    }
    this.agents.set(agent.id, agent);
    this.emit('agent-registered', agent);
    console.log(`[AgentRegistry] Registered agent: ${agent.name} (${agent.id})`);
  }

  unregister(agentId: string): void {
    if (this.agents.has(agentId)) {
      const agent = this.agents.get(agentId);
      this.agents.delete(agentId);
      this.emit('agent-unregistered', agent);
      console.log(`[AgentRegistry] Unregistered agent: ${agentId}`);
    }
  }

  getAgent(agentId: string): AgentProfile | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): AgentProfile[] {
    return Array.from(this.agents.values());
  }

  findAgentsByCapability(capability: string): AgentProfile[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.capabilities.includes(capability)
    );
  }

  clear(): void {
    this.agents.clear();
    this.emit('cleared');
  }
}
