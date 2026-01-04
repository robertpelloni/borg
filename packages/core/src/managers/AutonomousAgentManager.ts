import { AutonomousAgent } from '../agents/AutonomousAgent.js';
import { AgentManager } from './AgentManager.js';
import { AgentMessageBroker } from './AgentMessageBroker.js';
import { McpRouter } from './McpRouter.js';
import { LogManager } from './LogManager.js';
import { SecretManager } from './SecretManager.js';

export class AutonomousAgentManager {
    private runningAgents: Map<string, AutonomousAgent> = new Map();

    constructor(
        private agentManager: AgentManager,
        private messageBroker: AgentMessageBroker,
        private mcpRouter: McpRouter,
        private logManager: LogManager,
        private secretManager: SecretManager
    ) {}

    public async startAgent(agentId: string, parentId?: string) {
        if (this.runningAgents.has(agentId)) {
            console.log(`[AutonomousAgentManager] Agent ${agentId} is already running.`);
            return;
        }

        // 1. Get Definition
        // The AgentManager stores agents by filename or ID.
        // Let's assume agentId matches what AgentManager has.
        const agents = this.agentManager.getAgents();
        // We need a way to find the definition by ID.
        // AgentManager.agents is Map<string, AgentDefinition> where key is filename/ID.
        // But AgentRegistry uses IDs.
        
        // Let's try to find it in the registry first to get the name/metadata
        const profile = this.agentManager.registry.getAgent(agentId);
        if (!profile) {
            throw new Error(`Agent ${agentId} not found in registry.`);
        }

        // Now get the full definition. 
        // Since AgentManager doesn't expose getAgent(id) directly (only getAgents()), 
        // we might need to iterate or update AgentManager.
        // For now, let's iterate.
        const allAgents = this.agentManager.getAgents();
        const def = allAgents.find(a => a.name === profile.name); // Weak link, but works for now if names are unique

        if (!def) {
             throw new Error(`Agent definition for ${profile.name} not found.`);
        }

        const apiKey = this.secretManager.getSecret('OPENAI_API_KEY');
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY not found.");
        }

        const agent = new AutonomousAgent(
            agentId,
            def,
            this.messageBroker,
            this.mcpRouter,
            this.logManager,
            apiKey,
            parentId
        );

        await agent.start();
        this.runningAgents.set(agentId, agent);
        console.log(`[AutonomousAgentManager] Started agent ${agentId}`);
    }

    public stopAgent(agentId: string) {
        const agent = this.runningAgents.get(agentId);
        if (agent) {
            agent.stop();
            this.runningAgents.delete(agentId);
            console.log(`[AutonomousAgentManager] Stopped agent ${agentId}`);
        }
    }

    public getRunningAgents() {
        return Array.from(this.runningAgents.keys());
    }
}
