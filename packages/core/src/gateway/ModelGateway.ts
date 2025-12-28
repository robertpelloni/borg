import { SecretManager } from '../managers/SecretManager.js';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class ModelGateway {
    constructor(private secretManager: SecretManager) {}

    async chat(messages: ChatMessage[], model: string = 'gpt-3.5-turbo'): Promise<string> {
        // Simple stub for now. In reality, use 'openai' package or fetch.
        console.log(`[ModelGateway] Chat request to ${model}:`, messages.length, 'messages');

        if (model.startsWith('gpt')) {
            return this.callOpenAI(messages, model);
        } else if (model.startsWith('claude')) {
            return this.callAnthropic(messages, model);
        }

        return "Model not supported yet.";
    }

    async getEmbedding(text: string): Promise<number[]> {
        // Stub: Return random vector
        return Array(1536).fill(0).map(() => Math.random());
    }

    private async callOpenAI(messages: ChatMessage[], model: string): Promise<string> {
        const apiKey = this.secretManager.getSecret('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OPENAI_API_KEY not found");

        // Mock response for skeleton
        return "This is a mock response from OpenAI.";
    }

    private async callAnthropic(messages: ChatMessage[], model: string): Promise<string> {
        const apiKey = this.secretManager.getSecret('ANTHROPIC_API_KEY');
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found");

        // Mock response for skeleton
        return "This is a mock response from Claude.";
    }
}
