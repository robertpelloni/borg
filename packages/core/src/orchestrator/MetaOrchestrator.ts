
import { AgentInterface, AgentMessage } from './AgentCommunication.js';

export class MetaOrchestrator {
    private agents: Map<string, AgentInterface> = new Map();

    registerAgent(agent: AgentInterface) {
        this.agents.set(agent.id, agent);
        console.log(`[MetaOrchestrator] Registered agent: ${agent.id}`);
    }

    async delegateTask(targetAgentId: string, task: string, context: any) {
        const agent = this.agents.get(targetAgentId);
        if (!agent) throw new Error(`Agent ${targetAgentId} not found.`);

        const msg: AgentMessage = {
            id: crypto.randomUUID(),
            from: 'METAMIND',
            to: targetAgentId,
            type: 'TASK_REQUEST',
            payload: { task, context },
            timestamp: Date.now()
        };

        console.log(`[MetaOrchestrator] Delegating to ${targetAgentId}: "${task}"`);
        await agent.sendMessage(msg);
    }

    async broadcastStatusRequest() {
        for (const [id, agent] of this.agents) {
            await agent.sendMessage({
                id: crypto.randomUUID(),
                from: 'METAMIND',
                to: id,
                type: 'STATUS_UPDATE',
                payload: {},
                timestamp: Date.now()
            });
        }
    }
}
