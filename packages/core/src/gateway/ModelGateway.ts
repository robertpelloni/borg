import { SecretManager } from '../managers/SecretManager.js';

export interface CompletionRequest {
    system?: string;
    messages: any[];
    tools?: any[];
    maxTokens?: number;
}

export interface CompletionResponse {
    content: string;
    toolCalls?: any[];
}

export type ModelProvider = 'openai' | 'anthropic' | 'ollama';

export class ModelGateway {
    private provider: ModelProvider = 'openai';
    private model: string = 'gpt-4o'; // Default

    constructor(private secretManager: SecretManager) {}

    setProvider(provider: ModelProvider, model: string) {
        this.provider = provider;
        this.model = model;
        console.log(`[ModelGateway] Switched to ${provider}:${model}`);
    }

    async getEmbedding(text: string): Promise<number[] | null> {
        // Only OpenAI supports embeddings natively in this gateway for now
        // Ollama supports it via /api/embeddings, could implement later
        if (this.provider === 'openai' || this.secretManager.getSecret('OPENAI_API_KEY')) {
            try {
                const apiKey = this.secretManager.getSecret('OPENAI_API_KEY');
                if (!apiKey) return null;

                const OpenAIApi = await import('openai');
                const openai = new OpenAIApi.OpenAI({ apiKey });

                const response = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: text,
                });
                return response.data[0].embedding;
            } catch (e) {
                console.warn('[ModelGateway] Embedding failed:', e);
                return null;
            }
        }
        return null;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        if (this.provider === 'openai') {
            return this.callOpenAI(request);
        } else if (this.provider === 'anthropic') {
            return this.callAnthropic(request);
        } else if (this.provider === 'ollama') {
            return this.callOllama(request);
        }
        throw new Error(`Unknown provider: ${this.provider}`);
    }

    private async callOpenAI(req: CompletionRequest): Promise<CompletionResponse> {
        const apiKey = this.secretManager.getSecret('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OPENAI_API_KEY not found");

        const OpenAIApi = await import('openai');
        const openai = new OpenAIApi.OpenAI({ apiKey });

        const messages = [];
        if (req.system) messages.push({ role: 'system', content: req.system });
        messages.push(...req.messages);

        const completion = await openai.chat.completions.create({
            model: this.model,
            messages: messages as any,
            tools: req.tools,
            max_tokens: req.maxTokens || 1024
        });

        const choice = completion.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls
        };
    }

    private async callAnthropic(req: CompletionRequest): Promise<CompletionResponse> {
         // Placeholder for Anthropic implementation
         // Would use @anthropic-ai/sdk
         throw new Error("Anthropic support pending dependency installation.");
    }

    private async callOllama(req: CompletionRequest): Promise<CompletionResponse> {
        // Simple fetch implementation for local Ollama
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    ...(req.system ? [{ role: 'system', content: req.system }] : []),
                    ...req.messages
                ],
                stream: false,
                // Ollama tool support is experimental/variable, keeping it simple for now
            })
        });

        if (!response.ok) throw new Error(`Ollama failed: ${response.statusText}`);
        const data = await response.json() as any;

        return {
            content: data.message.content
        };
    }
}
