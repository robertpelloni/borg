/**
 * AIOS Orchestration API Routes (Hono)
 * 
 * REST API endpoints for AI orchestration features:
 * - Multi-agent debates
 * - Code review
 * - Memory compaction
 * - Provider management
 * 
 * @module routes/orchestrationRoutesHono
 */

import { Hono } from 'hono';
import { getDebateEngineService, DebateConfig, Participant } from '../services/DebateEngineService.js';
import { getCodeReviewService, ReviewRequest } from '../services/CodeReviewService.js';
import { getMemoryCompactionService, Activity, CompactionConfig } from '../services/MemoryCompactionService.js';
import { getLLMProviderRegistry } from '../providers/LLMProviderRegistry.js';

// ============================================
// Types
// ============================================

interface OrchestrationContext {
    // Add any context variables if needed
}

// ============================================
// Route Factory
// ============================================

export function createOrchestrationRoutes(): Hono {
    const app = new Hono();
    
    const debateService = getDebateEngineService();
    const reviewService = getCodeReviewService();
    const compactionService = getMemoryCompactionService();
    const providerRegistry = getLLMProviderRegistry();

    // ========================================
    // Provider Routes
    // ========================================

    /**
     * GET /api/orchestration/providers
     * List all available LLM providers
     */
    app.get('/providers', async (c) => {
        try {
            const providers = providerRegistry.listProviders();
            const modelTiers = providerRegistry.getModelTiers();
            
            return c.json({
                success: true,
                providers,
                modelTiers,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/orchestration/providers/:providerId/models
     * List models for a specific provider
     */
    app.get('/providers/:providerId/models', async (c) => {
        try {
            const providerId = c.req.param('providerId');
            const apiKey = c.req.header('X-API-Key');
            
            const models = await providerRegistry.listModels(providerId, apiKey);
            
            return c.json({
                success: true,
                providerId,
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
     * POST /api/orchestration/providers/complete
     * Generate a completion using specified provider
     */
    app.post('/providers/complete', async (c) => {
        try {
            const body = await c.req.json();
            const { provider, model, apiKey, messages, systemPrompt, maxTokens, jsonMode } = body;
            
            if (!messages || !Array.isArray(messages)) {
                return c.json({ success: false, error: 'messages array required' }, 400);
            }

            const result = await providerRegistry.complete({
                provider,
                model,
                apiKey,
                messages,
                systemPrompt,
                maxTokens,
                jsonMode,
            });

            return c.json({
                success: true,
                result,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Debate Routes
    // ========================================

    /**
     * POST /api/orchestration/debate
     * Run a multi-agent debate
     */
    app.post('/debate', async (c) => {
        try {
            const body = await c.req.json();
            const config: DebateConfig = {
                topic: body.topic,
                rounds: body.rounds || 2,
                participants: body.participants || [],
                moderator: body.moderator,
                maxTokensPerTurn: body.maxTokensPerTurn,
            };

            if (!config.topic) {
                return c.json({ success: false, error: 'topic required' }, 400);
            }
            if (config.participants.length < 2) {
                return c.json({ success: false, error: 'At least 2 participants required' }, 400);
            }

            const result = await debateService.runDebate(config);

            return c.json({
                success: true,
                result,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/orchestration/debate/quick
     * Quick debate using templates
     */
    app.post('/debate/quick', async (c) => {
        try {
            const body = await c.req.json();
            const { topic, template, context, rounds, apiKeys } = body;

            if (!topic) {
                return c.json({ success: false, error: 'topic required' }, 400);
            }

            const result = await debateService.quickDebate({
                topic,
                template,
                context,
                rounds,
                apiKeys,
            });

            return c.json({
                success: true,
                result,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/orchestration/debate/conference
     * Run a single-round conference/discussion
     */
    app.post('/debate/conference', async (c) => {
        try {
            const body = await c.req.json();
            const { history, participants, topic, maxTokensPerTurn } = body;

            if (!participants || participants.length < 2) {
                return c.json({ success: false, error: 'At least 2 participants required' }, 400);
            }

            const result = await debateService.runConference({
                history: history || [],
                participants,
                topic,
                maxTokensPerTurn,
            });

            return c.json({
                success: true,
                result,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/orchestration/debate/templates
     * Get available debate templates
     */
    app.get('/debate/templates', (c) => {
        const templates = ['code-review', 'architecture', 'security', 'general'];
        const templatesWithParticipants = templates.map(t => ({
            id: t,
            participants: debateService.createDebateTemplate(t as any),
        }));

        return c.json({
            success: true,
            templates: templatesWithParticipants,
        });
    });

    // ========================================
    // Code Review Routes
    // ========================================

    /**
     * POST /api/orchestration/review
     * Run a code review
     */
    app.post('/review', async (c) => {
        try {
            const body = await c.req.json();
            const request: ReviewRequest = {
                codeContext: body.code || body.codeContext,
                provider: body.provider || 'anthropic',
                model: body.model || 'claude-sonnet-4-20250514',
                apiKey: body.apiKey,
                systemPrompt: body.systemPrompt,
                reviewType: body.reviewType,
                customPersonas: body.customPersonas,
                outputFormat: body.outputFormat || 'json',
                prUrl: body.prUrl,
                githubToken: body.githubToken,
                filePath: body.filePath,
                language: body.language,
            };

            if (!request.codeContext) {
                return c.json({ success: false, error: 'code or codeContext required' }, 400);
            }
            if (!request.apiKey) {
                return c.json({ success: false, error: 'apiKey required' }, 400);
            }

            const result = await reviewService.review(request);

            return c.json({
                success: true,
                result,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/orchestration/review/quick
     * Quick code review with defaults
     */
    app.post('/review/quick', async (c) => {
        try {
            const body = await c.req.json();
            const { code, provider, model, apiKey, language } = body;

            if (!code) {
                return c.json({ success: false, error: 'code required' }, 400);
            }
            if (!apiKey) {
                return c.json({ success: false, error: 'apiKey required' }, 400);
            }

            const result = await reviewService.quickReview({
                code,
                provider,
                model,
                apiKey,
                language,
            });

            return c.json({
                success: true,
                result,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Memory Compaction Routes
    // ========================================

    /**
     * POST /api/orchestration/memory/compact
     * Compact session history into a memory file
     */
    app.post('/memory/compact', async (c) => {
        try {
            const body = await c.req.json();
            const { activities, provider, model, apiKey, maxInputChars, includeToolCalls } = body;

            if (!activities || !Array.isArray(activities)) {
                return c.json({ success: false, error: 'activities array required' }, 400);
            }
            if (!apiKey) {
                return c.json({ success: false, error: 'apiKey required' }, 400);
            }

            const config: CompactionConfig = {
                provider: provider || 'anthropic',
                model: model || 'claude-sonnet-4-20250514',
                apiKey,
                maxInputChars,
                includeToolCalls,
            };

            const memoryFile = await compactionService.compactSessionHistory(activities, config);

            return c.json({
                success: true,
                memoryFile,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/orchestration/memory/handoff
     * Generate a handoff document for session continuity
     */
    app.post('/memory/handoff', async (c) => {
        try {
            const body = await c.req.json();
            const { activities, provider, model, apiKey } = body;

            if (!activities || !Array.isArray(activities)) {
                return c.json({ success: false, error: 'activities array required' }, 400);
            }
            if (!apiKey) {
                return c.json({ success: false, error: 'apiKey required' }, 400);
            }

            const config: CompactionConfig = {
                provider: provider || 'anthropic',
                model: model || 'claude-sonnet-4-20250514',
                apiKey,
            };

            const handoff = await compactionService.generateHandoffDocument(activities, config);

            return c.json({
                success: true,
                handoff,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/orchestration/memory/project
     * Compact multiple sessions into project-level memory
     */
    app.post('/memory/project', async (c) => {
        try {
            const body = await c.req.json();
            const { sessions, provider, model, apiKey } = body;

            if (!sessions || !Array.isArray(sessions)) {
                return c.json({ success: false, error: 'sessions array required' }, 400);
            }
            if (!apiKey) {
                return c.json({ success: false, error: 'apiKey required' }, 400);
            }

            const config: CompactionConfig = {
                provider: provider || 'anthropic',
                model: model || 'claude-sonnet-4-20250514',
                apiKey,
            };

            const projectMemory = await compactionService.compactProjectHistory(sessions, config);

            return c.json({
                success: true,
                projectMemory,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/orchestration/memory/inject
     * Generate context injection from a memory file
     */
    app.post('/memory/inject', async (c) => {
        try {
            const memoryFile = await c.req.json();
            
            if (!memoryFile.summary) {
                return c.json({ success: false, error: 'Invalid memory file format' }, 400);
            }

            const injection = compactionService.generateContextInjection(memoryFile);

            return c.json({
                success: true,
                injection,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    return app;
}
