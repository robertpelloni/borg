/**
 * AIOS Agent Template API Routes (Hono)
 * 
 * REST API endpoints for agent template management.
 * Provides access to built-in and custom agent templates.
 * 
 * Endpoints:
 * - GET    /api/templates           - List all templates
 * - GET    /api/templates/stats     - Get template statistics
 * - GET    /api/templates/categories - List categories with counts
 * - GET    /api/templates/tags      - List all tags with counts
 * - GET    /api/templates/search    - Search templates
 * - GET    /api/templates/category/:category - Get templates by category
 * - GET    /api/templates/tag/:tag  - Get templates by tag
 * - GET    /api/templates/:id       - Get specific template
 * - POST   /api/templates           - Create custom template
 * - PUT    /api/templates/:id       - Update custom template
 * - DELETE /api/templates/:id       - Delete custom template
 * - POST   /api/templates/:id/instantiate - Create agent config from template
 * 
 * @module routes/agentTemplateRoutesHono
 */

import { Hono } from 'hono';
import { 
    getAgentTemplateService, 
    AgentTemplate, 
    AgentCategory 
} from '../services/AgentTemplateService.js';

// ============================================
// Route Factory
// ============================================

export function createAgentTemplateRoutes(): Hono {
    const app = new Hono();
    const service = getAgentTemplateService();

    // ========================================
    // List & Stats Routes
    // ========================================

    /**
     * GET /api/templates
     * List all templates (built-in and custom)
     */
    app.get('/', (c) => {
        try {
            const category = c.req.query('category') as AgentCategory | undefined;
            const tag = c.req.query('tag');
            
            let templates: AgentTemplate[];
            
            if (category) {
                templates = service.getTemplatesByCategory(category);
            } else if (tag) {
                templates = service.getTemplatesByTag(tag);
            } else {
                templates = service.getAllTemplates();
            }

            return c.json({
                success: true,
                templates,
                count: templates.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/templates/stats
     * Get template statistics
     */
    app.get('/stats', (c) => {
        try {
            const stats = service.getStats();
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

    /**
     * GET /api/templates/categories
     * List all categories with counts
     */
    app.get('/categories', (c) => {
        try {
            const categories = service.getCategories();
            return c.json({
                success: true,
                categories,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/templates/tags
     * List all tags with counts
     */
    app.get('/tags', (c) => {
        try {
            const tags = service.getTags();
            return c.json({
                success: true,
                tags,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/templates/search
     * Search templates by name, description, or tags
     */
    app.get('/search', (c) => {
        try {
            const query = c.req.query('q');
            
            if (!query) {
                return c.json({ success: false, error: 'Query parameter "q" required' }, 400);
            }

            const templates = service.searchTemplates(query);
            return c.json({
                success: true,
                templates,
                count: templates.length,
                query,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Category & Tag Routes
    // ========================================

    /**
     * GET /api/templates/category/:category
     * Get templates by category
     */
    app.get('/category/:category', (c) => {
        try {
            const category = c.req.param('category') as AgentCategory;
            const validCategories = [
                'development', 'research', 'writing', 'data', 
                'devops', 'security', 'automation', 'assistant', 'custom'
            ];
            
            if (!validCategories.includes(category)) {
                return c.json({ 
                    success: false, 
                    error: `Invalid category. Valid options: ${validCategories.join(', ')}` 
                }, 400);
            }

            const templates = service.getTemplatesByCategory(category);
            return c.json({
                success: true,
                templates,
                count: templates.length,
                category,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/templates/tag/:tag
     * Get templates by tag
     */
    app.get('/tag/:tag', (c) => {
        try {
            const tag = c.req.param('tag');
            const templates = service.getTemplatesByTag(tag);
            
            return c.json({
                success: true,
                templates,
                count: templates.length,
                tag,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Single Template Routes
    // ========================================

    /**
     * GET /api/templates/:id
     * Get a specific template by ID
     */
    app.get('/:id', (c) => {
        try {
            const id = c.req.param('id');
            const template = service.getTemplate(id);
            
            if (!template) {
                return c.json({ success: false, error: 'Template not found' }, 404);
            }

            return c.json({
                success: true,
                template,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ========================================
    // Custom Template CRUD
    // ========================================

    /**
     * POST /api/templates
     * Create a new custom template
     */
    app.post('/', async (c) => {
        try {
            const body = await c.req.json();
            const { 
                id, 
                name, 
                description, 
                category, 
                tags, 
                systemPrompt,
                model,
                modelTier,
                temperature,
                maxTokens,
                recommendedTools,
                requiredTools,
                toolSets,
                behavior,
                author,
                version,
                examples,
            } = body;

            // Validation
            if (!id) {
                return c.json({ success: false, error: 'id required' }, 400);
            }
            if (!name) {
                return c.json({ success: false, error: 'name required' }, 400);
            }
            if (!systemPrompt) {
                return c.json({ success: false, error: 'systemPrompt required' }, 400);
            }
            if (!category) {
                return c.json({ success: false, error: 'category required' }, 400);
            }

            const template: AgentTemplate = {
                id,
                name,
                description: description || '',
                category: category as AgentCategory,
                tags: tags || [],
                systemPrompt,
                model,
                modelTier,
                temperature,
                maxTokens,
                recommendedTools,
                requiredTools,
                toolSets,
                behavior,
                author,
                version,
                examples,
            };

            service.addCustomTemplate(template);

            return c.json({
                success: true,
                template: service.getTemplate(id),
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * PUT /api/templates/:id
     * Update a custom template
     */
    app.put('/:id', async (c) => {
        try {
            const id = c.req.param('id');
            const updates = await c.req.json();

            service.updateCustomTemplate(id, updates);

            return c.json({
                success: true,
                template: service.getTemplate(id),
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const status = message.includes('built-in') ? 403 : 
                          message.includes('not found') ? 404 : 500;
            
            return c.json({
                success: false,
                error: message,
            }, status);
        }
    });

    /**
     * DELETE /api/templates/:id
     * Delete a custom template
     */
    app.delete('/:id', (c) => {
        try {
            const id = c.req.param('id');
            service.deleteCustomTemplate(id);

            return c.json({ success: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const status = message.includes('built-in') ? 403 : 
                          message.includes('not found') ? 404 : 500;
            
            return c.json({
                success: false,
                error: message,
            }, status);
        }
    });

    // ========================================
    // Template Operations
    // ========================================

    /**
     * POST /api/templates/:id/instantiate
     * Create agent configuration from template
     */
    app.post('/:id/instantiate', async (c) => {
        try {
            const id = c.req.param('id');
            const overrides = await c.req.json().catch(() => ({}));

            const agentConfig = service.createAgentFromTemplate(id, overrides);

            return c.json({
                success: true,
                agentConfig,
                sourceTemplate: id,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const status = message.includes('not found') ? 404 : 500;
            
            return c.json({
                success: false,
                error: message,
            }, status);
        }
    });

    /**
     * POST /api/templates/:id/clone
     * Clone a template (built-in or custom) as a new custom template
     */
    app.post('/:id/clone', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { newId, newName } = body;

            if (!newId) {
                return c.json({ success: false, error: 'newId required' }, 400);
            }

            const sourceTemplate = service.getTemplate(id);
            if (!sourceTemplate) {
                return c.json({ success: false, error: 'Source template not found' }, 404);
            }

            const clonedTemplate: AgentTemplate = {
                ...sourceTemplate,
                id: newId,
                name: newName || `${sourceTemplate.name} (Copy)`,
                category: 'custom',
            };

            service.addCustomTemplate(clonedTemplate);

            return c.json({
                success: true,
                template: service.getTemplate(newId),
                clonedFrom: id,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/templates/:id/export
     * Export template as JSON
     */
    app.get('/:id/export', (c) => {
        try {
            const id = c.req.param('id');
            const template = service.getTemplate(id);
            
            if (!template) {
                return c.json({ success: false, error: 'Template not found' }, 404);
            }

            c.header('Content-Type', 'application/json');
            c.header('Content-Disposition', `attachment; filename="template-${id}.json"`);
            return c.body(JSON.stringify(template, null, 2));
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/templates/import
     * Import template from JSON
     */
    app.post('/import', async (c) => {
        try {
            const template = await c.req.json() as AgentTemplate;

            // Validation
            if (!template.id || !template.name || !template.systemPrompt || !template.category) {
                return c.json({ 
                    success: false, 
                    error: 'Invalid template: id, name, systemPrompt, and category are required' 
                }, 400);
            }

            // Force category to custom for imported templates
            template.category = 'custom';
            
            service.addCustomTemplate(template);

            return c.json({
                success: true,
                template: service.getTemplate(template.id),
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    return app;
}
