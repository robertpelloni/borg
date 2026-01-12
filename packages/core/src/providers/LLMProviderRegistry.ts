/**
 * AIOS LLM Provider Registry
 * 
 * Unified multi-provider abstraction layer supporting OpenAI, Anthropic, Gemini, Qwen, 
 * and extensible to additional providers.
 * 
 * Features:
 * - Provider-agnostic interface for text completion
 * - Model listing per provider
 * - JSON mode support for structured outputs
 * - Streaming support (where available)
 * - Retry logic with exponential backoff
 * - Token usage tracking
 * 
 * @module providers/LLMProviderRegistry
 */

import { EventEmitter } from 'events';

// ============================================
// Types & Interfaces
// ============================================

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    name?: string;
}

export interface CompletionParams {
    messages: Message[];
    model: string;
    apiKey?: string;
    baseUrl?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    stream?: boolean;
}

export interface CompletionResult {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
    model?: string;
}

export interface StreamChunk {
    content: string;
    done: boolean;
}

export interface LLMProvider {
    id: string;
    name: string;
    complete(params: CompletionParams): Promise<CompletionResult>;
    completeStream?(params: CompletionParams): AsyncGenerator<StreamChunk>;
    listModels(apiKey?: string): Promise<string[]>;
}

export interface ProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    maxRetries?: number;
    retryDelayMs?: number;
}

// ============================================
// Provider Implementations
// ============================================

/**
 * OpenAI Provider (GPT-4, GPT-4o, etc.)
 */
const openaiProvider: LLMProvider = {
    id: 'openai',
    name: 'OpenAI',

    async complete(params: CompletionParams): Promise<CompletionResult> {
        const baseUrl = params.baseUrl || 'https://api.openai.com/v1';
        const model = params.model || 'gpt-4o';

        const messages = params.messages.map(m => {
            const role = m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user';
            const msg: Record<string, unknown> = { role, content: m.content };
            if (m.name) {
                msg.name = m.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            }
            return msg;
        });

        if (params.systemPrompt) {
            messages.unshift({ role: 'system', content: params.systemPrompt });
        }

        const body: Record<string, unknown> = {
            model,
            messages,
            temperature: params.temperature ?? 0.7,
        };

        if (params.maxTokens) {
            body.max_completion_tokens = params.maxTokens;
        }
        if (params.jsonMode) {
            body.response_format = { type: 'json_object' };
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${params.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${(error as any).error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
            finishReason: data.choices?.[0]?.finish_reason,
            model: data.model,
        };
    },

    async listModels(apiKey?: string): Promise<string[]> {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error('Failed to fetch OpenAI models');
        const data = await response.json() as any;
        return data.data
            .filter((m: any) => m.id.startsWith('gpt-'))
            .map((m: any) => m.id)
            .sort();
    },
};

/**
 * Anthropic Provider (Claude)
 */
const anthropicProvider: LLMProvider = {
    id: 'anthropic',
    name: 'Anthropic',

    async complete(params: CompletionParams): Promise<CompletionResult> {
        const baseUrl = params.baseUrl || 'https://api.anthropic.com/v1';
        const model = params.model || 'claude-sonnet-4-20250514';

        const messages = params.messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
        }));

        const response = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': params.apiKey || '',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                system: params.systemPrompt,
                messages,
                max_tokens: params.maxTokens || 4096,
                temperature: params.temperature ?? 0.7,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Anthropic API error: ${(error as any).error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.content?.[0]?.text || '',
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
            finishReason: data.stop_reason,
            model: data.model,
        };
    },

    async listModels(): Promise<string[]> {
        return [
            'claude-sonnet-4-20250514',
            'claude-opus-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
        ];
    },
};

/**
 * Google Gemini Provider
 */
const geminiProvider: LLMProvider = {
    id: 'gemini',
    name: 'Google Gemini',

    async complete(params: CompletionParams): Promise<CompletionResult> {
        const baseUrl = params.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        const model = params.model || 'gemini-2.0-flash';

        // Convert messages to Gemini format
        const contents = params.messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        // Add system instruction if provided
        const systemInstruction = params.systemPrompt 
            ? { parts: [{ text: params.systemPrompt }] }
            : undefined;

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                temperature: params.temperature ?? 0.7,
                maxOutputTokens: params.maxTokens || 8192,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = systemInstruction;
        }

        if (params.jsonMode) {
            (body.generationConfig as any).responseMimeType = 'application/json';
        }

        const response = await fetch(
            `${baseUrl}/models/${model}:generateContent?key=${params.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Gemini API error: ${(error as any).error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        const candidate = data.candidates?.[0];

        return {
            content: candidate?.content?.parts?.[0]?.text || '',
            usage: data.usageMetadata ? {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
            } : undefined,
            finishReason: candidate?.finishReason,
            model,
        };
    },

    async listModels(apiKey?: string): Promise<string[]> {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (!response.ok) throw new Error('Failed to fetch Gemini models');
        const data = await response.json() as any;
        return data.models
            ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''))
            .sort() || [];
    },
};

/**
 * Alibaba Qwen Provider (via DashScope)
 */
const qwenProvider: LLMProvider = {
    id: 'qwen',
    name: 'Alibaba Qwen',

    async complete(params: CompletionParams): Promise<CompletionResult> {
        const baseUrl = params.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        const model = params.model || 'qwen-turbo';

        const messages = params.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        if (params.systemPrompt) {
            messages.unshift({ role: 'system', content: params.systemPrompt });
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${params.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: params.temperature ?? 0.7,
                max_tokens: params.maxTokens || 2048,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Qwen API error: ${(error as any).message || response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
            finishReason: data.choices?.[0]?.finish_reason,
            model: data.model,
        };
    },

    async listModels(): Promise<string[]> {
        return [
            'qwen-turbo',
            'qwen-plus',
            'qwen-max',
            'qwen-max-longcontext',
            'qwen-vl-plus',
            'qwen-vl-max',
        ];
    },
};

/**
 * DeepSeek Provider
 */
const deepseekProvider: LLMProvider = {
    id: 'deepseek',
    name: 'DeepSeek',

    async complete(params: CompletionParams): Promise<CompletionResult> {
        const baseUrl = params.baseUrl || 'https://api.deepseek.com/v1';
        const model = params.model || 'deepseek-chat';

        const messages = params.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        if (params.systemPrompt) {
            messages.unshift({ role: 'system', content: params.systemPrompt });
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${params.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: params.temperature ?? 0.7,
                max_tokens: params.maxTokens || 4096,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`DeepSeek API error: ${(error as any).error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
            finishReason: data.choices?.[0]?.finish_reason,
            model: data.model,
        };
    },

    async listModels(): Promise<string[]> {
        return ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'];
    },
};

/**
 * Groq Provider (Fast inference)
 */
const groqProvider: LLMProvider = {
    id: 'groq',
    name: 'Groq',

    async complete(params: CompletionParams): Promise<CompletionResult> {
        const baseUrl = params.baseUrl || 'https://api.groq.com/openai/v1';
        const model = params.model || 'llama-3.3-70b-versatile';

        const messages = params.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        if (params.systemPrompt) {
            messages.unshift({ role: 'system', content: params.systemPrompt });
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${params.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: params.temperature ?? 0.7,
                max_tokens: params.maxTokens || 4096,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Groq API error: ${(error as any).error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
            finishReason: data.choices?.[0]?.finish_reason,
            model: data.model,
        };
    },

    async listModels(): Promise<string[]> {
        return [
            'llama-3.3-70b-versatile',
            'llama-3.1-70b-versatile',
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
            'gemma2-9b-it',
        ];
    },
};

// ============================================
// LLM Provider Registry Class
// ============================================

export class LLMProviderRegistry extends EventEmitter {
    private providers: Map<string, LLMProvider> = new Map();
    private providerConfigs: Map<string, ProviderConfig> = new Map();
    private defaultProvider: string = 'openai';

    constructor() {
        super();
        // Register built-in providers
        this.registerProvider(openaiProvider);
        this.registerProvider(anthropicProvider);
        this.registerProvider(geminiProvider);
        this.registerProvider(qwenProvider);
        this.registerProvider(deepseekProvider);
        this.registerProvider(groqProvider);
    }

    /**
     * Register a new LLM provider
     */
    registerProvider(provider: LLMProvider): void {
        this.providers.set(provider.id, provider);
        this.emit('provider:registered', { providerId: provider.id });
    }

    /**
     * Set configuration for a provider
     */
    setProviderConfig(providerId: string, config: ProviderConfig): void {
        this.providerConfigs.set(providerId, config);
    }

    /**
     * Get a provider by ID
     */
    getProvider(providerId: string): LLMProvider | undefined {
        return this.providers.get(providerId);
    }

    /**
     * List all registered providers
     */
    listProviders(): Array<{ id: string; name: string }> {
        return Array.from(this.providers.values()).map(p => ({
            id: p.id,
            name: p.name,
        }));
    }

    /**
     * Set the default provider
     */
    setDefaultProvider(providerId: string): void {
        if (!this.providers.has(providerId)) {
            throw new Error(`Provider ${providerId} not found`);
        }
        this.defaultProvider = providerId;
    }

    /**
     * Complete a message using the specified or default provider
     */
    async complete(params: {
        provider?: string;
        messages: Message[];
        model?: string;
        apiKey?: string;
        baseUrl?: string;
        systemPrompt?: string;
        temperature?: number;
        maxTokens?: number;
        jsonMode?: boolean;
    }): Promise<CompletionResult> {
        const providerId = params.provider || this.defaultProvider;
        const provider = this.providers.get(providerId);

        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        const config = this.providerConfigs.get(providerId) || {};
        const retries = config.maxRetries ?? 3;
        const retryDelay = config.retryDelayMs ?? 1000;

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const result = await provider.complete({
                    messages: params.messages,
                    model: params.model || config.defaultModel || '',
                    apiKey: params.apiKey || config.apiKey,
                    baseUrl: params.baseUrl || config.baseUrl,
                    systemPrompt: params.systemPrompt,
                    temperature: params.temperature,
                    maxTokens: params.maxTokens,
                    jsonMode: params.jsonMode,
                });

                this.emit('completion:success', {
                    providerId,
                    model: result.model,
                    usage: result.usage,
                });

                return result;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                this.emit('completion:error', {
                    providerId,
                    attempt: attempt + 1,
                    error: lastError.message,
                });

                // Don't retry on auth errors
                if (lastError.message.includes('401') || lastError.message.includes('403')) {
                    throw lastError;
                }

                // Exponential backoff
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
                }
            }
        }

        throw lastError || new Error('Unknown error during completion');
    }

    /**
     * Generate text using provider (simplified interface)
     */
    async generateText(params: {
        provider: string;
        apiKey: string;
        model: string;
        messages: Message[];
        systemPrompt?: string;
        maxTokens?: number;
        jsonMode?: boolean;
    }): Promise<string> {
        const result = await this.complete({
            provider: params.provider,
            apiKey: params.apiKey,
            model: params.model,
            messages: params.messages,
            systemPrompt: params.systemPrompt,
            maxTokens: params.maxTokens,
            jsonMode: params.jsonMode,
        });
        return result.content;
    }

    /**
     * List available models for a provider
     */
    async listModels(providerId: string, apiKey?: string): Promise<string[]> {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        const config = this.providerConfigs.get(providerId) || {};
        return provider.listModels(apiKey || config.apiKey);
    }

    /**
     * Get model tier mapping (opus/sonnet/haiku equivalents)
     */
    getModelTiers(): Record<string, { opus: string; sonnet: string; haiku: string }> {
        return {
            openai: {
                opus: 'gpt-4o',
                sonnet: 'gpt-4o-mini',
                haiku: 'gpt-4o-mini',
            },
            anthropic: {
                opus: 'claude-opus-4-20250514',
                sonnet: 'claude-sonnet-4-20250514',
                haiku: 'claude-3-5-haiku-20241022',
            },
            gemini: {
                opus: 'gemini-2.5-pro',
                sonnet: 'gemini-2.0-flash',
                haiku: 'gemini-2.0-flash-lite',
            },
            qwen: {
                opus: 'qwen-max',
                sonnet: 'qwen-plus',
                haiku: 'qwen-turbo',
            },
            deepseek: {
                opus: 'deepseek-reasoner',
                sonnet: 'deepseek-chat',
                haiku: 'deepseek-chat',
            },
            groq: {
                opus: 'llama-3.3-70b-versatile',
                sonnet: 'llama-3.1-70b-versatile',
                haiku: 'llama-3.1-8b-instant',
            },
        };
    }

    /**
     * Get model for tier and provider
     */
    getModelForTier(providerId: string, tier: 'opus' | 'sonnet' | 'haiku'): string {
        const tiers = this.getModelTiers();
        return tiers[providerId]?.[tier] || '';
    }
}

// Singleton instance
let registryInstance: LLMProviderRegistry | null = null;

export function getLLMProviderRegistry(): LLMProviderRegistry {
    if (!registryInstance) {
        registryInstance = new LLMProviderRegistry();
    }
    return registryInstance;
}

// Re-export for compatibility
export { LLMProvider as ProviderInterface };
