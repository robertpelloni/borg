import { McpProxyManager } from '../managers/McpProxyManager.js';
import { SecretManager } from '../managers/SecretManager.js';
import { ModelGateway } from '../gateway/ModelGateway.js';

export class AgentExecutor {
    private modelGateway: ModelGateway;

    constructor(
        private proxyManager: McpProxyManager,
        private secretManager: SecretManager
    ) {
        this.modelGateway = new ModelGateway(secretManager);
    }

    async run(agent: any, task: string, context: any = {}, sessionId: string) {
        console.log(`[AgentExecutor] Running ${agent.name} on task: ${task}`);

        // 1. Construct System Prompt
        const systemPrompt = `You are ${agent.name}. ${agent.description}. ${agent.instructions}`;

        // 2. Initial Message
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task }
        ];

        // 3. Execution Loop (Simplified ReAct)
        // In a real system, we'd use LangChain or a proper loop handling tool calls.
        // For this skeleton, we'll just do one turn.

        const response = await this.modelGateway.chat(messages as any, agent.model);

        return response;
    }
}
