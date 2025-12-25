import { EventEmitter } from 'events';
import { AgentMessage } from '../interfaces/AgentInterfaces.js';

export class AgentMessageBroker extends EventEmitter {
  private subscribers: Map<string, (msg: AgentMessage) => void> = new Map();
  private mailboxes: Map<string, AgentMessage[]> = new Map();

  async route(message: AgentMessage): Promise<void> {
    console.log(`[Broker] Routing ${message.type} from ${message.sourceAgentId} to ${message.targetAgentId}`);
    
    // 1. Deliver to active subscriber (real-time)
    const handler = this.subscribers.get(message.targetAgentId);
    if (handler) {
      handler(message);
    }

    // 2. Store in mailbox (persistence)
    if (!this.mailboxes.has(message.targetAgentId)) {
        this.mailboxes.set(message.targetAgentId, []);
    }
    this.mailboxes.get(message.targetAgentId)?.push(message);
    
    // 3. Emit globally for monitoring/logging
    this.emit('traffic', message);
  }

  subscribe(agentId: string, handler: (msg: AgentMessage) => void) {
    this.subscribers.set(agentId, handler);
  }

  unsubscribe(agentId: string) {
    this.subscribers.delete(agentId);
  }

  getMessages(agentId: string): AgentMessage[] {
      const messages = this.mailboxes.get(agentId) || [];
      this.mailboxes.set(agentId, []); // Clear after reading? Or allow peek?
      // For now, consume on read.
      return messages;
  }

  peekMessages(agentId: string): AgentMessage[] {
      return this.mailboxes.get(agentId) || [];
  }
}
