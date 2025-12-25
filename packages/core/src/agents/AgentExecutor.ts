import { EventEmitter } from 'events';
import { McpProxyManager } from '../managers/McpProxyManager.js';
import { AgentDefinition } from '../types.js';
import { SecretManager } from '../managers/SecretManager.js';
import { ModelGateway } from '../gateway/ModelGateway.js';
import { SessionManager } from '../managers/SessionManager.js';

export class AgentExecutor extends EventEmitter {
    private gateway: ModelGateway;

    constructor(
        private proxyManager: McpProxyManager,
        private secretManager: SecretManager,
        private sessionManager?: SessionManager
    ) {
        super();
        this.gateway = new ModelGateway(secretManager);
    }

    /**
     * Updates the gateway configuration.
     */
    configureModel(provider: 'openai' | 'anthropic' | 'ollama', model: string) {
        this.gateway.setProvider(provider, model);
    }

    async run(agent: AgentDefinition, task: string, context: any = {}, sessionId?: string) {
        this.emit('start', { agent: agent.name, task });

        let messages: any[] = [];
        const sessionKey = sessionId || `agent-${agent.name}-${Date.now()}`;

        // Resume session if exists
        if (this.sessionManager) {
            const saved = this.sessionManager.loadSession(sessionKey);
            if (saved) {
                messages = saved.messages;
                console.log(`[AgentExecutor] Resumed session: ${sessionKey}`);
            }
        }

        // Initialize if new
        if (messages.length === 0) {
            messages = [
                { role: 'system', content: `You are ${agent.name}. ${agent.description}\n\nInstructions:\n${agent.instructions}\n\nYou have access to tools. Use them to answer the user request.` },
                { role: 'user', content: task }
            ];
        } else if (task && sessionId) {
            // If resuming with a new task, append it
            // Check if last message was user (retry) or assistant (new turn)
            const last = messages[messages.length - 1];
            if (last.role === 'assistant') {
                messages.push({ role: 'user', content: task });
            }
        }

        let iterations = 0;
        const maxIterations = 10;

        while (iterations < maxIterations) {
            iterations++;
            console.log(`[AgentExecutor] Iteration ${iterations}`);

            try {
                // 1. Get Tools
                const tools = await this.proxyManager.getAllTools(sessionKey);

                const formattedTools = tools.map(t => ({
                    type: 'function',
                    function: {
                        name: t.name,
                        description: t.description,
                        parameters: t.inputSchema || {}
                    }
                }));

                // 2. Call LLM via Gateway
                const response = await this.gateway.complete({
                    system: `You are ${agent.name}. ${agent.description}`,
                    messages: messages,
                    tools: formattedTools,
                });

                // Add assistant response to history
                const assistantMsg: any = { role: 'assistant', content: response.content };
                if (response.toolCalls) {
                    assistantMsg.tool_calls = response.toolCalls;
                }
                messages.push(assistantMsg);

                // Save State
                if (this.sessionManager) {
                    this.sessionManager.saveSession(sessionKey, agent.name, messages);
                }

                // 3. Handle Tool Calls
                if (response.toolCalls && response.toolCalls.length > 0) {
                    for (const toolCall of response.toolCalls) {
                        const name = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);

                        this.emit('tool_call', { name, args });
                        console.log(`[AgentExecutor] Calling ${name}`, args);

                        let result;
                        try {
                            const res = await this.proxyManager.callTool(name, args, sessionKey);
                            result = typeof res === 'string' ? res : JSON.stringify(res);
                        } catch (e: any) {
                            result = `Error: ${e.message}`;
                        }

                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: result
                        });

                        // Save State after tool result
                        if (this.sessionManager) {
                            this.sessionManager.saveSession(sessionKey, agent.name, messages);
                        }
                    }
                } else {
                    // 4. Final Answer
                    const content = response.content;
                    this.emit('result', content);
                    return content;
                }

            } catch (e: any) {
                console.error('[AgentExecutor] Loop Error:', e);
                this.emit('error', e.message);
                return `Error: ${e.message}`;
            }
        }

        return "Max iterations reached.";
    }
}
