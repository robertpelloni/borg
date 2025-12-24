import { EventEmitter } from 'events';
import { McpProxyManager } from '../managers/McpProxyManager.js';
import { AgentDefinition } from '../types.js';
import OpenAI from 'openai';
import { SecretManager } from '../managers/SecretManager.js';

export class AgentExecutor extends EventEmitter {
    private openai: OpenAI | null = null;

    constructor(
        private proxyManager: McpProxyManager,
        private secretManager?: SecretManager
    ) {
        super();
        this.initializeOpenAI();
    }

    private initializeOpenAI() {
        if (this.secretManager) {
            const apiKey = this.secretManager.getSecret('OPENAI_API_KEY');
            if (apiKey) {
                this.openai = new OpenAI({ apiKey });
                console.log('[AgentExecutor] OpenAI initialized with key from SecretManager');
            }
        }
    }

    async run(agent: AgentDefinition, task: string, context: any = {}) {
        this.emit('start', { agent: agent.name, task });

        // Re-init in case key was added late
        if (!this.openai) this.initializeOpenAI();

        if (!this.openai) {
            this.emit('error', "No OpenAI API Key found. Please add OPENAI_API_KEY to Secrets.");
            return "Error: No OpenAI API Key found.";
        }

        const messages: any[] = [
            { role: 'system', content: `You are ${agent.name}. ${agent.description}\n\nInstructions:\n${agent.instructions}\n\nYou have access to tools. Use them to answer the user request.` },
            { role: 'user', content: task }
        ];

        let iterations = 0;
        const maxIterations = 10;

        while (iterations < maxIterations) {
            iterations++;
            console.log(`[AgentExecutor] Iteration ${iterations}`);

            try {
                // 1. Get Tools
                // We use getAllTools() which respects progressive disclosure (meta tools)
                // BUT the agent needs to see the tools it loads.
                // The proxyManager handles session visibility if we pass a sessionId.
                // Let's use agent.name as sessionId for now to persist state across runs?
                // Or a unique run ID.
                const sessionId = `agent-${agent.name}-${Date.now()}`;
                const tools = await this.proxyManager.getAllTools(sessionId);

                // Map tools to OpenAI format
                const openAiTools = tools.map(t => ({
                    type: 'function',
                    function: {
                        name: t.name,
                        description: t.description,
                        parameters: t.inputSchema || {}
                    }
                }));

                // 2. Call LLM
                const completion = await this.openai.chat.completions.create({
                    model: agent.model || 'gpt-4-turbo',
                    messages: messages,
                    tools: openAiTools as any,
                    tool_choice: 'auto'
                });

                const message = completion.choices[0].message;
                messages.push(message);

                // 3. Handle Tool Calls
                if (message.tool_calls && message.tool_calls.length > 0) {
                    for (const toolCall of message.tool_calls) {
                        const name = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);

                        this.emit('tool_call', { name, args });
                        console.log(`[AgentExecutor] Calling ${name}`, args);

                        let result;
                        try {
                            // Call via Proxy (handles local/remote/internal)
                            const res = await this.proxyManager.callTool(name, args, sessionId);
                            result = JSON.stringify(res);
                        } catch (e: any) {
                            result = `Error: ${e.message}`;
                        }

                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: result
                        });
                    }
                } else {
                    // 4. Final Answer
                    const content = message.content;
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
