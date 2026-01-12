/**
 * AIOS LLM Gateway Routes (Hono)
 * 
 * REST API for direct LLM provider access via the unified LLMProviderRegistry.
 * Provides a single interface for all supported AI providers.
 * 
 * Features:
 * - Unified completion API across all providers
 * - Streaming support (SSE)
 * - Provider listing and model discovery
 * - Model tier mapping (opus/sonnet/haiku)
 * - Token usage tracking
 * - Provider health checks
 * 
 * Endpoints:
 * - POST /complete - Generate completion
 * - POST /stream - Generate streaming completion (SSE)
 * - GET /providers - List all providers
 * - GET /providers/:id - Get provider info
 * - GET /providers/:id/models - List provider models
 * - GET /models - List all models across providers
 * - GET /tiers - Get model tier mappings
 * - GET /tiers/:tier - Get models for a specific tier
 * - POST /batch - Batch completions (parallel)
 * - GET /health - Provider health status
 * 
 * @module routes/llmGatewayRoutesHono
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getLLMProviderRegistry } from '../providers/LLMProviderRegistry.js';

export function createLLMGatewayRoutes(secretManager: { getSecret: (key: string) => string | undefined }) {
    const router = new Hono();
    const registry = getLLMProviderRegistry();

    // API key mapping
    const apiKeyMap: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        gemini: 'GOOGLE_AI_API_KEY',
        qwen: 'QWEN_API_KEY',
        deepseek: 'DEEPSEEK_API_KEY',
        groq: 'GROQ_API_KEY',
    };

    /**
     * Get API key for provider from secrets
     */
    function getApiKey(providerId: string): string | undefined {
        const keyName = apiKeyMap[providerId];
        return keyName ? secretManager.getSecret(keyName) : undefined;
    }

    // ============================================
    // Completion Endpoints
    // ============================================

    /**
     * POST /complete - Generate a completion
     * 
     * Body:
     * - provider: string (optional, defaults to 'openai')
     * - model: string (optional, uses provider default)
     * - messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>
     * - systemPrompt: string (optional)
     * - temperature: number (optional, 0-2)
     * - maxTokens: number (optional)
     * - jsonMode: boolean (optional)
     */
    router.post('/complete', async (c) => {
        try {
            const body = await c.req.json();
            const {
                provider = 'openai',
                model,
                messages,
                systemPrompt,
                temperature,
                maxTokens,
                jsonMode,
            } = body;

            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                return c.json({
                    success: false,
                    error: 'messages array is required',
                }, 400);
            }

            const apiKey = getApiKey(provider);
            if (!apiKey) {
                return c.json({
                    success: false,
                    error: `API key not configured for provider ${provider}. Set ${apiKeyMap[provider]} in secrets.`,
                }, 400);
            }

            const result = await registry.complete({
                provider,
                model,
                messages,
                apiKey,
                systemPrompt,
                temperature,
                maxTokens,
                jsonMode,
            });

            return c.json({
                success: true,
                provider,
                model: result.model,
                content: result.content,
                usage: result.usage,
                finishReason: result.finishReason,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /stream - Generate a streaming completion (SSE)
     */
    router.post('/stream', async (c) => {
        try {
            const body = await c.req.json();
            const {
                provider = 'openai',
                model,
                messages,
                systemPrompt,
                temperature,
                maxTokens,
            } = body;

            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                return c.json({
                    success: false,
                    error: 'messages array is required',
                }, 400);
            }

            const apiKey = getApiKey(provider);
            if (!apiKey) {
                return c.json({
                    success: false,
                    error: `API key not configured for provider ${provider}`,
                }, 400);
            }

            // For now, fall back to non-streaming and simulate SSE
            // Full streaming would require provider-specific implementations
            return streamSSE(c, async (stream) => {
                try {
                    const result = await registry.complete({
                        provider,
                        model,
                        messages,
                        apiKey,
                        systemPrompt,
                        temperature,
                        maxTokens,
                    });

                    // Simulate streaming by chunking the response
                    const content = result.content;
                    const chunkSize = 20;
                    
                    for (let i = 0; i < content.length; i += chunkSize) {
                        const chunk = content.slice(i, i + chunkSize);
                        await stream.writeSSE({
                            event: 'chunk',
                            data: JSON.stringify({ content: chunk, done: false }),
                        });
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }

                    await stream.writeSSE({
                        event: 'done',
                        data: JSON.stringify({
                            content: '',
                            done: true,
                            usage: result.usage,
                            finishReason: result.finishReason,
                        }),
                    });
                } catch (error) {
                    await stream.writeSSE({
                        event: 'error',
                        data: JSON.stringify({
                            error: error instanceof Error ? error.message : 'Unknown error',
                        }),
                    });
                }
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /batch - Batch completions (parallel)
     * 
     * Body:
     * - requests: Array of completion requests
     */
    router.post('/batch', async (c) => {
        try {
            const body = await c.req.json();
            const { requests } = body;

            if (!requests || !Array.isArray(requests) || requests.length === 0) {
                return c.json({
                    success: false,
                    error: 'requests array is required',
                }, 400);
            }

            if (requests.length > 10) {
                return c.json({
                    success: false,
                    error: 'Maximum 10 requests per batch',
                }, 400);
            }

            const results = await Promise.allSettled(
                requests.map(async (req: Record<string, unknown>) => {
                    const provider = (req.provider as string) || 'openai';
                    const apiKey = getApiKey(provider);
                    
                    if (!apiKey) {
                        throw new Error(`API key not configured for ${provider}`);
                    }

                    return registry.complete({
                        provider,
                        model: req.model as string,
                        messages: req.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
                        apiKey,
                        systemPrompt: req.systemPrompt as string,
                        temperature: req.temperature as number,
                        maxTokens: req.maxTokens as number,
                        jsonMode: req.jsonMode as boolean,
                    });
                })
            );

            const responses = results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return {
                        index,
                        success: true,
                        content: result.value.content,
                        usage: result.value.usage,
                    };
                } else {
                    return {
                        index,
                        success: false,
                        error: result.reason?.message || 'Unknown error',
                    };
                }
            });

            return c.json({
                success: true,
                results: responses,
                summary: {
                    total: results.length,
                    succeeded: responses.filter(r => r.success).length,
                    failed: responses.filter(r => !r.success).length,
                },
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ============================================
    // Provider & Model Discovery
    // ============================================

    /**
     * GET /providers - List all providers
     */
    router.get('/providers', (c) => {
        try {
            const providers = registry.listProviders();
            const providersWithStatus = providers.map(p => ({
                ...p,
                configured: !!getApiKey(p.id),
            }));

            return c.json({
                success: true,
                providers: providersWithStatus,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /providers/:id - Get provider details
     */
    router.get('/providers/:id', async (c) => {
        try {
            const id = c.req.param('id');
            const provider = registry.getProvider(id);

            if (!provider) {
                return c.json({
                    success: false,
                    error: 'Provider not found',
                }, 404);
            }

            const apiKey = getApiKey(id);
            let models: string[] = [];
            
            try {
                models = await registry.listModels(id, apiKey);
            } catch {
                // Use static list if API call fails
                models = [];
            }

            const tiers = registry.getModelTiers()[id];

            return c.json({
                success: true,
                provider: {
                    id: provider.id,
                    name: provider.name,
                    configured: !!apiKey,
                    models,
                    tiers,
                },
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /providers/:id/models - List models for a provider
     */
    router.get('/providers/:id/models', async (c) => {
        try {
            const id = c.req.param('id');
            const apiKey = getApiKey(id);

            if (!apiKey) {
                return c.json({
                    success: false,
                    error: `API key not configured for ${id}`,
                }, 400);
            }

            const models = await registry.listModels(id, apiKey);

            return c.json({
                success: true,
                provider: id,
                models,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /models - List all models across all providers
     */
    router.get('/models', async (c) => {
        try {
            const providers = registry.listProviders();
            const allModels: Array<{ provider: string; model: string; tier?: string }> = [];
            const tiers = registry.getModelTiers();

            for (const provider of providers) {
                const apiKey = getApiKey(provider.id);
                if (!apiKey) continue;

                try {
                    const models = await registry.listModels(provider.id, apiKey);
                    const providerTiers = tiers[provider.id] || {};
                    
                    for (const model of models) {
                        let tier: string | undefined;
                        if (model === providerTiers.opus) tier = 'opus';
                        else if (model === providerTiers.sonnet) tier = 'sonnet';
                        else if (model === providerTiers.haiku) tier = 'haiku';

                        allModels.push({
                            provider: provider.id,
                            model,
                            tier,
                        });
                    }
                } catch {
                    // Skip provider if listing fails
                }
            }

            return c.json({
                success: true,
                models: allModels,
                total: allModels.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ============================================
    // Model Tiers
    // ============================================

    /**
     * GET /tiers - Get all model tier mappings
     */
    router.get('/tiers', (c) => {
        try {
            const tiers = registry.getModelTiers();

            return c.json({
                success: true,
                tiers,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /tiers/:tier - Get models for a specific tier
     */
    router.get('/tiers/:tier', (c) => {
        try {
            const tier = c.req.param('tier') as 'opus' | 'sonnet' | 'haiku';

            if (!['opus', 'sonnet', 'haiku'].includes(tier)) {
                return c.json({
                    success: false,
                    error: 'Invalid tier. Must be: opus, sonnet, or haiku',
                }, 400);
            }

            const allTiers = registry.getModelTiers();
            const models: Array<{ provider: string; model: string; configured: boolean }> = [];

            for (const [providerId, providerTiers] of Object.entries(allTiers)) {
                const model = providerTiers[tier];
                if (model) {
                    models.push({
                        provider: providerId,
                        model,
                        configured: !!getApiKey(providerId),
                    });
                }
            }

            return c.json({
                success: true,
                tier,
                models,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ============================================
    // Health & Status
    // ============================================

    /**
     * GET /health - Provider health status
     */
    router.get('/health', async (c) => {
        try {
            const providers = registry.listProviders();
            const health: Array<{
                provider: string;
                configured: boolean;
                status: 'ok' | 'error' | 'unconfigured';
                latencyMs?: number;
                error?: string;
            }> = [];

            for (const provider of providers) {
                const apiKey = getApiKey(provider.id);
                
                if (!apiKey) {
                    health.push({
                        provider: provider.id,
                        configured: false,
                        status: 'unconfigured',
                    });
                    continue;
                }

                const startTime = Date.now();
                try {
                    // Simple health check - list models
                    await registry.listModels(provider.id, apiKey);
                    const latencyMs = Date.now() - startTime;
                    
                    health.push({
                        provider: provider.id,
                        configured: true,
                        status: 'ok',
                        latencyMs,
                    });
                } catch (error) {
                    health.push({
                        provider: provider.id,
                        configured: true,
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            const summary = {
                total: health.length,
                healthy: health.filter(h => h.status === 'ok').length,
                unhealthy: health.filter(h => h.status === 'error').length,
                unconfigured: health.filter(h => h.status === 'unconfigured').length,
            };

            return c.json({
                success: true,
                health,
                summary,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /test - Test a provider with a simple completion
     */
    router.post('/test', async (c) => {
        try {
            const body = await c.req.json();
            const { provider = 'openai' } = body;

            const apiKey = getApiKey(provider);
            if (!apiKey) {
                return c.json({
                    success: false,
                    error: `API key not configured for ${provider}`,
                }, 400);
            }

            const startTime = Date.now();
            const result = await registry.complete({
                provider,
                messages: [{ role: 'user', content: 'Say "test successful" and nothing else.' }],
                apiKey,
                maxTokens: 20,
            });
            const latencyMs = Date.now() - startTime;

            return c.json({
                success: true,
                provider,
                model: result.model,
                response: result.content,
                latencyMs,
                usage: result.usage,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    return router;
}
