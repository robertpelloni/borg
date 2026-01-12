/**
 * AIOS Tool Analytics API Routes (Hono)
 * 
 * REST API endpoints for tool usage analytics and metrics.
 * 
 * Endpoints:
 * - GET    /api/analytics/summary     - Overall summary stats
 * - GET    /api/analytics/dashboard   - Dashboard data (summary + top tools + trends)
 * - GET    /api/analytics/tools       - All tool stats
 * - GET    /api/analytics/tools/top   - Top tools by metric
 * - GET    /api/analytics/tools/:name - Stats for specific tool
 * - GET    /api/analytics/agents      - All agent stats
 * - GET    /api/analytics/agents/:id  - Stats for specific agent
 * - GET    /api/analytics/sessions    - Recent sessions
 * - GET    /api/analytics/sessions/:id - Stats for specific session
 * - GET    /api/analytics/errors      - Error patterns
 * - GET    /api/analytics/trends      - Usage trends
 * - GET    /api/analytics/invocations - Query invocation history
 * - POST   /api/analytics/invocations - Record an invocation
 * - POST   /api/analytics/invocations/start - Start tracking invocation
 * - POST   /api/analytics/invocations/:id/complete - Complete invocation
 * - POST   /api/analytics/clear       - Clear old data
 * - POST   /api/analytics/reset       - Reset all analytics
 * 
 * @module routes/analyticsRoutesHono
 */

import { Hono } from 'hono';
import { 
    getToolAnalyticsService,
    ToolInvocation,
    AnalyticsQuery,
} from '../services/ToolAnalyticsService.js';

// ============================================
// Route Factory
// ============================================

export function createAnalyticsRoutes(): Hono {
    const app = new Hono();
    const service = getToolAnalyticsService();

    // ========================================
    // Summary & Dashboard
    // ========================================

    /**
     * GET /api/analytics/summary
     * Get overall analytics summary
     */
    app.get('/summary', (c) => {
        try {
            const summary = service.getSummary();
            return c.json({
                success: true,
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
     * GET /api/analytics/dashboard
     * Get full dashboard data
     */
    app.get('/dashboard', (c) => {
        try {
            const dashboard = service.getDashboard();
            return c.json({
                success: true,
                ...dashboard,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Tool Stats
    // ========================================

    /**
     * GET /api/analytics/tools
     * Get all tool stats
     */
    app.get('/tools', (c) => {
        try {
            const stats = service.getAllToolStats();
            return c.json({
                success: true,
                tools: stats,
                count: stats.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/analytics/tools/top
     * Get top tools by metric
     */
    app.get('/tools/top', (c) => {
        try {
            const metric = (c.req.query('metric') || 'invocations') as 'invocations' | 'errors' | 'latency' | 'cost';
            const limit = parseInt(c.req.query('limit') || '10');
            
            const validMetrics = ['invocations', 'errors', 'latency', 'cost'];
            if (!validMetrics.includes(metric)) {
                return c.json({ 
                    success: false, 
                    error: `Invalid metric. Valid options: ${validMetrics.join(', ')}` 
                }, 400);
            }

            const tools = service.getTopTools(metric, limit);
            return c.json({
                success: true,
                tools,
                metric,
                count: tools.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/analytics/tools/:name
     * Get stats for a specific tool
     */
    app.get('/tools/:name', (c) => {
        try {
            const name = c.req.param('name');
            const serverName = c.req.query('server');
            
            const stats = service.getToolStats(name, serverName);
            
            if (!stats) {
                return c.json({ success: false, error: 'Tool not found' }, 404);
            }

            return c.json({
                success: true,
                stats,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Agent Stats
    // ========================================

    /**
     * GET /api/analytics/agents
     * Get all agent stats
     */
    app.get('/agents', (c) => {
        try {
            const stats = service.getAllAgentStats();
            return c.json({
                success: true,
                agents: stats,
                count: stats.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/analytics/agents/:id
     * Get stats for a specific agent
     */
    app.get('/agents/:id', (c) => {
        try {
            const id = c.req.param('id');
            const stats = service.getAgentStats(id);
            
            if (!stats) {
                return c.json({ success: false, error: 'Agent not found' }, 404);
            }

            return c.json({
                success: true,
                stats,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Session Stats
    // ========================================

    /**
     * GET /api/analytics/sessions
     * Get recent sessions
     */
    app.get('/sessions', (c) => {
        try {
            const limit = parseInt(c.req.query('limit') || '50');
            const sessions = service.getRecentSessions(limit);
            
            return c.json({
                success: true,
                sessions,
                count: sessions.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/analytics/sessions/:id
     * Get stats for a specific session
     */
    app.get('/sessions/:id', (c) => {
        try {
            const id = c.req.param('id');
            const stats = service.getSessionStats(id);
            
            if (!stats) {
                return c.json({ success: false, error: 'Session not found' }, 404);
            }

            return c.json({
                success: true,
                stats,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Error Patterns
    // ========================================

    /**
     * GET /api/analytics/errors
     * Get error patterns
     */
    app.get('/errors', (c) => {
        try {
            const limit = parseInt(c.req.query('limit') || '50');
            const errors = service.getErrorPatterns(limit);
            
            return c.json({
                success: true,
                errors,
                count: errors.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Usage Trends
    // ========================================

    /**
     * GET /api/analytics/trends
     * Get usage trends
     */
    app.get('/trends', (c) => {
        try {
            const period = (c.req.query('period') || 'hour') as 'hour' | 'day' | 'week' | 'month';
            const count = parseInt(c.req.query('count') || '24');
            
            const validPeriods = ['hour', 'day', 'week', 'month'];
            if (!validPeriods.includes(period)) {
                return c.json({ 
                    success: false, 
                    error: `Invalid period. Valid options: ${validPeriods.join(', ')}` 
                }, 400);
            }

            const trends = service.getUsageTrends(period, count);
            
            return c.json({
                success: true,
                trends,
                period,
                count: trends.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Invocations
    // ========================================

    /**
     * GET /api/analytics/invocations
     * Query invocation history
     */
    app.get('/invocations', (c) => {
        try {
            const query: AnalyticsQuery = {
                toolName: c.req.query('tool') || undefined,
                serverName: c.req.query('server') || undefined,
                agentId: c.req.query('agent') || undefined,
                sessionId: c.req.query('session') || undefined,
                userId: c.req.query('user') || undefined,
                status: c.req.query('status') as ToolInvocation['status'] | undefined,
                startTime: c.req.query('startTime') ? parseInt(c.req.query('startTime')!) : undefined,
                endTime: c.req.query('endTime') ? parseInt(c.req.query('endTime')!) : undefined,
                limit: parseInt(c.req.query('limit') || '100'),
                offset: parseInt(c.req.query('offset') || '0'),
            };
            
            // Handle tags as comma-separated
            const tagsParam = c.req.query('tags');
            if (tagsParam) {
                query.tags = tagsParam.split(',').map(t => t.trim());
            }

            const invocations = service.queryInvocations(query);
            
            return c.json({
                success: true,
                invocations,
                count: invocations.length,
                query,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/analytics/invocations
     * Record a complete invocation
     */
    app.post('/invocations', async (c) => {
        try {
            const body = await c.req.json();
            
            if (!body.toolName) {
                return c.json({ success: false, error: 'toolName required' }, 400);
            }
            if (!body.status) {
                return c.json({ success: false, error: 'status required' }, 400);
            }

            const invocation = service.recordInvocation({
                toolName: body.toolName,
                serverName: body.serverName,
                agentId: body.agentId,
                sessionId: body.sessionId,
                userId: body.userId,
                startTime: body.startTime || Date.now(),
                endTime: body.endTime,
                duration: body.duration,
                inputTokens: body.inputTokens,
                outputTokens: body.outputTokens,
                inputSize: body.inputSize,
                outputSize: body.outputSize,
                status: body.status,
                errorType: body.errorType,
                errorMessage: body.errorMessage,
                cost: body.cost,
                provider: body.provider,
                model: body.model,
                tags: body.tags,
                metadata: body.metadata,
            });

            return c.json({
                success: true,
                invocation,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/analytics/invocations/start
     * Start tracking an invocation
     */
    app.post('/invocations/start', async (c) => {
        try {
            const body = await c.req.json();
            
            if (!body.toolName) {
                return c.json({ success: false, error: 'toolName required' }, 400);
            }

            const id = service.startInvocation({
                toolName: body.toolName,
                serverName: body.serverName,
                agentId: body.agentId,
                sessionId: body.sessionId,
                userId: body.userId,
                inputTokens: body.inputTokens,
                inputSize: body.inputSize,
                provider: body.provider,
                model: body.model,
                tags: body.tags,
                metadata: body.metadata,
            });

            return c.json({
                success: true,
                invocationId: id,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/analytics/invocations/:id/complete
     * Complete a tracked invocation
     */
    app.post('/invocations/:id/complete', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            
            if (!body.status) {
                return c.json({ success: false, error: 'status required' }, 400);
            }

            const invocation = service.completeInvocation(id, {
                status: body.status,
                outputTokens: body.outputTokens,
                outputSize: body.outputSize,
                cost: body.cost,
                errorType: body.errorType,
                errorMessage: body.errorMessage,
            });

            if (!invocation) {
                return c.json({ success: false, error: 'Invocation not found' }, 404);
            }

            return c.json({
                success: true,
                invocation,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Management
    // ========================================

    /**
     * POST /api/analytics/clear
     * Clear old data
     */
    app.post('/clear', async (c) => {
        try {
            const body = await c.req.json();
            const olderThanMs = body.olderThanMs || body.olderThanDays 
                ? body.olderThanDays * 24 * 60 * 60 * 1000 
                : 30 * 24 * 60 * 60 * 1000; // Default 30 days

            const cleared = service.clearOldData(olderThanMs);

            return c.json({
                success: true,
                cleared,
                message: `Cleared ${cleared} old invocation records`,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/analytics/reset
     * Reset all analytics (dangerous!)
     */
    app.post('/reset', async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            
            if (body.confirm !== true) {
                return c.json({ 
                    success: false, 
                    error: 'Must send { confirm: true } to reset all analytics' 
                }, 400);
            }

            service.reset();

            return c.json({
                success: true,
                message: 'All analytics data has been reset',
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/analytics/save
     * Force save to disk
     */
    app.post('/save', (c) => {
        try {
            service.saveToDisk();
            return c.json({
                success: true,
                message: 'Analytics saved to disk',
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
