import { EventEmitter } from 'events';
import { AgentMessage } from '../interfaces/AgentInterfaces.js';
import { MemoryManager } from './MemoryManager.js';

export class AgentMessageBroker extends EventEmitter {
  private subscribers: Map<string, (msg: AgentMessage) => void> = new Map();
  private mailboxes: Map<string, AgentMessage[]> = new Map();
  private memoryManager?: MemoryManager;

  setMemoryManager(memoryManager: MemoryManager) {
      this.memoryManager = memoryManager;
  }

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

    // 4. Ingest into Memory (Async)
    if (this.memoryManager) {
        this.ingestToMemory(message).catch(err => console.error(`[Broker] Memory ingestion failed: ${err}`));
    }
  }

  private async ingestToMemory(message: AgentMessage) {
      if (!this.memoryManager) return;
      
      // Only ingest meaningful content
      if (!message.content || message.content.length < 10) return;

      // We treat this as a "Session" between two agents
      // Or we can have a specific "ingestMessage" method.
      // For now, let's use ingestInteraction-like logic or just raw remember if it's important.
      // Actually, let's use the compactor via a new method in MemoryManager or reuse ingestSession logic?
      // Let's add a specialized method in MemoryManager for messages.
      
      await this.memoryManager.ingestAgentMessage(message);
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
