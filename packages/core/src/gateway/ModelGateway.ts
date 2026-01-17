import { SecretManager } from '../managers/SecretManager.js';
import OpenAI from 'openai';
import { isQuotaOrRateLimitError, uniqueStrings } from '../utils/llmErrors.js';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface UsageStats {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
}

export class ModelGateway {
    public stats: UsageStats = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
    };

    private openai?: OpenAI;
    private modelStatus: Map<string, { status: 'ok' | 'exhausted' | 'error', timestamp: number }> = new Map();
    private readonly EXHAUSTION_COOLDOWN_MS = 1000 * 60 * 60; // 1 hour cooldown for exhausted models

    private fallbackOrder: string[] = [
        'gpt-4o',
        'claude-3-5-sonnet-20240620',
        'gpt-4-turbo',
        'claude-3-opus-20240229',
        'gpt-3.5-turbo'
    ];

    constructor(private secretManager: SecretManager) {}

    private getOpenAIClient(): OpenAI {
        if (!this.openai) {
            const apiKey = this.secretManager.getSecret('OPENAI_API_KEY');
            if (!apiKey) throw new Error("OPENAI_API_KEY not found");
            this.openai = new OpenAI({ apiKey });
        }
        return this.openai;
    }

    async chat(messages: ChatMessage[], preferredModel: string = 'gpt-4o'): Promise<string> {
        const modelsToTry = [preferredModel, ...this.fallbackOrder.filter(m => m !== preferredModel)];
        const uniqueModels = uniqueStrings(modelsToTry);

        // Filter out exhausted models unless they are the only option or cooldown passed
        const availableModels = uniqueModels.filter(m => {
            const status = this.modelStatus.get(m);
            if (!status) return true;
            if (status.status === 'exhausted') {
                if (Date.now() - status.timestamp > this.EXHAUSTION_COOLDOWN_MS) {
                    this.modelStatus.delete(m); // Reset
                    return true;
                }
                console.log(`[ModelGateway] Skipping exhausted model: ${m}`);
                return false;
            }
            return true;
        });

        // If all filtered out (unlikely), fallback to original list to force a try
        const candidates = availableModels.length > 0 ? availableModels : uniqueModels;

        let lastError: any;

        for (const model of candidates) {
            try {
                console.log(`[ModelGateway] Attempting chat with ${model}...`);
                let result: string;
                if (model.startsWith('gpt') || model.startsWith('o1')) {
                    result = await this.callOpenAI(messages, model);
                } else if (model.startsWith('claude')) {
                    result = await this.callAnthropic(messages, model);
                } else {
                    console.warn(`[ModelGateway] Skipping unsupported model format: ${model}`);
                    continue;
                }
                
                // Success - reset status if it was previously error
                this.modelStatus.set(model, { status: 'ok', timestamp: Date.now() });
                return result;

            } catch (error: any) {
                console.warn(`[ModelGateway] Error with ${model}:`, error.message);
                lastError = error;
                
                if (isQuotaOrRateLimitError(error)) {
                    console.log(`[ModelGateway] Quota exceeded for ${model}. Marking as exhausted.`);
                    this.modelStatus.set(model, { status: 'exhausted', timestamp: Date.now() });
                    continue; // Try next model
                }

                // For other errors, maybe mark as temporary error?
                // For now, just continue
                continue;
            }
        }

        throw new Error(`All models failed. Last error: ${lastError?.message}`);
    }

    async getEmbedding(text: string): Promise<number[]> {
        try {
            const client = this.getOpenAIClient();
            const response = await client.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error("[ModelGateway] Embedding failed:", error);
            // Fallback to random for dev/offline if needed, or throw
            throw error;
        }
    }

    private async callOpenAI(messages: ChatMessage[], model: string): Promise<string> {
        const client = this.getOpenAIClient();
        const response = await client.chat.completions.create({
            model: model,
            messages: messages,
        });

        const content = response.choices[0]?.message?.content || "";
        
        // Update stats
        if (response.usage) {
            this.stats.promptTokens += response.usage.prompt_tokens || 0;
            this.stats.completionTokens += response.usage.completion_tokens || 0;
            this.stats.totalTokens += response.usage.total_tokens || 0;
        }

        return content;
    }

    private async callAnthropic(messages: ChatMessage[], model: string): Promise<string> {
        const apiKey = this.secretManager.getSecret('ANTHROPIC_API_KEY');
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found");

        // Convert messages to Anthropic format
        // System message is separate in Anthropic API
        const systemMessage = messages.find(m => m.role === 'system')?.content || "";
        const userAssistantMessages = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                system: systemMessage,
                messages: userAssistantMessages,
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Anthropic API Error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const content = data.content[0]?.text || "";

        // Update stats (approximate or parse usage if available)
        if (data.usage) {
            this.stats.promptTokens += data.usage.input_tokens || 0;
            this.stats.completionTokens += data.usage.output_tokens || 0;
            this.stats.totalTokens += (data.usage.input_tokens + data.usage.output_tokens) || 0;
        }

        return content;
    }
}
