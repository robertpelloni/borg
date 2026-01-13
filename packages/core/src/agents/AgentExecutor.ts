import { McpProxyManager } from '../managers/McpProxyManager.js';
import { SecretManager } from '../managers/SecretManager.js';
import { ModelGateway } from '../gateway/ModelGateway.js';
import { SystemPromptManager } from '../managers/SystemPromptManager.js';
import { SessionManager } from '../managers/SessionManager.js';

export class AgentExecutor {
    private modelGateway: ModelGateway;

    constructor(
        private proxyManager: McpProxyManager,
        private secretManager: SecretManager,
        private sessionManager?: SessionManager,
        private systemPromptManager?: SystemPromptManager
    ) {
        this.modelGateway = new ModelGateway(secretManager);
    }

    async run(agent: any, task: string, context: any = {}, sessionId: string) {
        console.log(`[AgentExecutor] Running ${agent.name} on task: ${task}`);

        // 1. Construct System Prompt
        const globalSystem = this.systemPromptManager?.getPrompt() || "";
        const userInstructions = this.systemPromptManager?.getUserInstructions('default') || ""; // Todo: get active profile

        const systemPrompt = `
${globalSystem}

---
USER INSTRUCTIONS:
${userInstructions}

---
AGENT: ${agent.name}
${agent.description}
${agent.instructions}
`;

        // 2. Initial Message
        const messages = [
            { role: 'system', content: systemPrompt.trim() },
            { role: 'user', content: task }
        ];

        // 3. Execution Loop (Simplified ReAct)
        const response = await this.modelGateway.chat(messages as any, agent.model);

        // 4. Save Session (if Manager provided)
        if (this.sessionManager) {
            const sessionMessages = messages.map(m => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content,
                timestamp: Date.now(),
            }));
            sessionMessages.push({ role: 'assistant', content: response, timestamp: Date.now() });
            this.sessionManager.saveSession(sessionId, agent.name, sessionMessages);
        }

        return response;
    }
}
