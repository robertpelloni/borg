import { EventEmitter } from 'events';
import { AgentDefinition } from '../types.js';
import { AgentMessageBroker } from '../managers/AgentMessageBroker.js';
import { McpRouter } from '../managers/McpRouter.js';
import { LogManager } from '../managers/LogManager.js';
import OpenAI from 'openai';

export class AutonomousAgent extends EventEmitter {
    private status: 'idle' | 'busy' | 'paused' = 'idle';
    private loopInterval: NodeJS.Timeout | null = null;
    private messages: any[] = [];
    private openai: OpenAI | null = null;
    private sessionId: string;

    constructor(
        public readonly id: string,
        public readonly definition: AgentDefinition,
        private messageBroker: AgentMessageBroker,
        private mcpRouter: McpRouter,
        private logManager: LogManager,
        private apiKey: string,
        private parentId?: string
    ) {
        super();
        this.sessionId = `auto-agent-${this.id}-${Date.now()}`;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
        
        // Initialize System Prompt
        let systemPrompt = `You are ${definition.name}. ${definition.description}\n\nInstructions:\n${definition.instructions}\n\nYou are an autonomous agent. You can receive messages from other agents or the user. Check your mailbox frequently.`;
        
        if (this.parentId) {
            systemPrompt += `\n\nYou are a sub-agent delegated by agent "${this.parentId}". Report your findings back to them using the 'send_message' tool.`;
        }

        this.messages.push({
            role: 'system',
            content: systemPrompt
        });
    }

    public async start() {
        if (this.status !== 'paused' && this.status !== 'idle') return;
        this.status = 'idle';
        console.log(`[AutonomousAgent:${this.definition.name}] Starting loop...`);
        
        // Subscribe to real-time messages
        this.messageBroker.subscribe(this.id, (msg) => {
            console.log(`[AutonomousAgent:${this.definition.name}] Real-time message received from ${msg.sourceAgentId}`);
            this.handleMessage(msg);
        });

        // Start Tick Loop for background tasks (like checking mailbox if subscription fails, or internal thoughts)
        this.loopInterval = setInterval(() => this.tick(), 5000); // Check every 5s
    }

    public stop() {
        this.status = 'paused';
        if (this.loopInterval) clearInterval(this.loopInterval);
        this.messageBroker.unsubscribe(this.id);
        console.log(`[AutonomousAgent:${this.definition.name}] Stopped.`);
    }

    private async tick() {
        if (this.status === 'busy') return;

        // 1. Check Mailbox (Redundant if subscription works, but good backup)
        const messages = this.messageBroker.getMessages(this.id);
        if (messages.length > 0) {
            console.log(`[AutonomousAgent:${this.definition.name}] Found ${messages.length} messages in mailbox.`);
            for (const msg of messages) {
                await this.handleMessage(msg);
            }
        }
    }

    private async handleMessage(msg: any) {
        this.status = 'busy';
        try {
            // Add to memory
            this.messages.push({
                role: 'user',
                content: `Message from ${msg.sourceAgentId}: ${JSON.stringify(msg.content)}`
            });

            // Trigger Thought/Action Loop
            await this.runCycle();

        } catch (err) {
            console.error(`[AutonomousAgent:${this.definition.name}] Error handling message:`, err);
        } finally {
            this.status = 'idle';
        }
    }

    private async runCycle() {
        if (!this.openai) {
            console.error(`[AutonomousAgent:${this.definition.name}] No OpenAI Key.`);
            return;
        }

        let iterations = 0;
        const maxIterations = 5; // Limit autonomous steps per trigger

        while (iterations < maxIterations) {
            iterations++;
            
            // 1. Get Tools
            const tools = await this.mcpRouter.getAllTools(this.sessionId);
            const openAiTools = tools.map((t: any) => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema || {}
                }
            }));

            // 2. Call LLM
            const completion = await this.openai.chat.completions.create({
                model: this.definition.model || 'gpt-4-turbo',
                messages: this.messages,
                tools: openAiTools as any,
                tool_choice: 'auto'
            });

            // Log Cost
            if (this.logManager && completion.usage) {
                const cost = this.logManager.calculateCost(
                    this.definition.model || 'gpt-4-turbo', 
                    completion.usage.prompt_tokens, 
                    completion.usage.completion_tokens
                );
                this.logManager.log({
                    type: 'response',
                    tool: 'llm_completion',
                    server: 'openai',
                    args: { agent: this.definition.name },
                    result: { usage: completion.usage },
                    tokens: completion.usage.total_tokens,
                    cost: cost
                });
            }

            const message = completion.choices[0].message;
            this.messages.push(message);

            // 3. Handle Tool Calls
            if (message.tool_calls && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    // @ts-ignore
                    const name = toolCall.function.name;
                    // @ts-ignore
                    const args = JSON.parse(toolCall.function.arguments);

                    console.log(`[AutonomousAgent:${this.definition.name}] Executing ${name}`);
                    
                    let result;
                    try {
                        const res = await this.mcpRouter.callToolSimple(name, args, this.sessionId);
                        result = JSON.stringify(res);
                    } catch (e: any) {
                        result = `Error: ${e.message}`;
                    }

                    this.messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: result
                    });
                }
                // Loop continues to let LLM process the tool output
            } else {
                // 4. Final Answer / Stop
                console.log(`[AutonomousAgent:${this.definition.name}] Cycle complete. Response: ${message.content}`);
                break;
            }
        }
    }
}
