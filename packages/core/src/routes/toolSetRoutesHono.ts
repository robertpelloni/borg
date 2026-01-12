/**
 * AIOS Tool Set API Routes (Hono)
 * 
 * REST API endpoints for tool set management
 * 
 * @module routes/toolSetRoutesHono
 */

import { Hono } from 'hono';
import { getToolSetManager, ToolSetItem } from '../managers/ToolSetManager.js';

// ============================================
// Route Factory
// ============================================

export function createToolSetRoutes(): Hono {
    const app = new Hono();
    const manager = getToolSetManager();

    // ========================================
    // Tool Set Routes
    // ========================================

    /**
     * GET /api/toolsets
     * List all tool sets
     */
    app.get('/', (c) => {
        try {
            const toolSets = manager.getAllToolSets();
            return c.json({
                success: true,
                toolSets,
                count: toolSets.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/toolsets/templates
     * List available templates
     */
    app.get('/templates', (c) => {
        try {
            const templates = manager.getTemplates();
            return c.json({
                success: true,
                templates,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/toolsets/:id
     * Get a specific tool set
     */
    app.get('/:id', (c) => {
        try {
            const id = c.req.param('id');
            const toolSet = manager.getToolSet(id);
            
            if (!toolSet) {
                return c.json({ success: false, error: 'Tool set not found' }, 404);
            }

            return c.json({
                success: true,
                toolSet,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/toolsets
     * Create a new tool set
     */
    app.post('/', async (c) => {
        try {
            const body = await c.req.json();
            const { name, description, items, tags, metadata } = body;

            if (!name) {
                return c.json({ success: false, error: 'name required' }, 400);
            }

            const toolSet = manager.createToolSet({
                name,
                description: description || '',
                items: items || [],
                tags,
                metadata,
            });

            return c.json({
                success: true,
                toolSet,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/toolsets/from-template
     * Create tool set from template
     */
    app.post('/from-template', async (c) => {
        try {
            const body = await c.req.json();
            const { templateId, name, additionalItems, excludeItems } = body;

            if (!templateId) {
                return c.json({ success: false, error: 'templateId required' }, 400);
            }

            const toolSet = manager.createFromTemplate(templateId, {
                name,
                additionalItems,
                excludeItems,
            });

            return c.json({
                success: true,
                toolSet,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * PUT /api/toolsets/:id
     * Update a tool set
     */
    app.put('/:id', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();

            const toolSet = manager.updateToolSet(id, body);

            return c.json({
                success: true,
                toolSet,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * DELETE /api/toolsets/:id
     * Delete a tool set
     */
    app.delete('/:id', (c) => {
        try {
            const id = c.req.param('id');
            const deleted = manager.deleteToolSet(id);

            if (!deleted) {
                return c.json({ success: false, error: 'Tool set not found' }, 404);
            }

            return c.json({ success: true });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/toolsets/:id/items
     * Add item to tool set
     */
    app.post('/:id/items', async (c) => {
        try {
            const id = c.req.param('id');
            const item = await c.req.json() as ToolSetItem;

            if (!item.toolName) {
                return c.json({ success: false, error: 'toolName required' }, 400);
            }

            const toolSet = manager.addItemToToolSet(id, item);

            return c.json({
                success: true,
                toolSet,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * DELETE /api/toolsets/:id/items/:toolName
     * Remove item from tool set
     */
    app.delete('/:id/items/:toolName', (c) => {
        try {
            const id = c.req.param('id');
            const toolName = c.req.param('toolName');

            const toolSet = manager.removeItemFromToolSet(id, toolName);

            return c.json({
                success: true,
                toolSet,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/toolsets/:id/tools
     * Get tool names from a tool set
     */
    app.get('/:id/tools', (c) => {
        try {
            const id = c.req.param('id');
            const toolNames = manager.getToolNames(id);

            return c.json({
                success: true,
                tools: toolNames,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/toolsets/:id/validate
     * Validate tool set against available tools
     */
    app.post('/:id/validate', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { availableTools } = body;

            if (!availableTools || !Array.isArray(availableTools)) {
                return c.json({ success: false, error: 'availableTools array required' }, 400);
            }

            const validation = manager.validateToolSet(id, availableTools);

            return c.json({
                success: true,
                validation,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/toolsets/merge
     * Merge multiple tool sets
     */
    app.post('/merge', async (c) => {
        try {
            const body = await c.req.json();
            const { toolSetIds, name, description } = body;

            if (!toolSetIds || !Array.isArray(toolSetIds) || toolSetIds.length < 2) {
                return c.json({ success: false, error: 'At least 2 toolSetIds required' }, 400);
            }
            if (!name) {
                return c.json({ success: false, error: 'name required' }, 400);
            }

            const toolSet = manager.mergeToolSets(toolSetIds, name, description || '');

            return c.json({
                success: true,
                toolSet,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/toolsets/:id/export
     * Export tool set as JSON
     */
    app.get('/:id/export', (c) => {
        try {
            const id = c.req.param('id');
            const json = manager.exportToolSet(id);

            c.header('Content-Type', 'application/json');
            c.header('Content-Disposition', `attachment; filename="toolset-${id}.json"`);
            return c.body(json);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /api/toolsets/import
     * Import tool set from JSON
     */
    app.post('/import', async (c) => {
        try {
            const body = await c.req.text();
            const toolSet = manager.importToolSet(body);

            return c.json({
                success: true,
                toolSet,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /api/toolsets/by-tag/:tag
     * Get tool sets by tag
     */
    app.get('/by-tag/:tag', (c) => {
        try {
            const tag = c.req.param('tag');
            const toolSets = manager.getToolSetsByTag(tag);

            return c.json({
                success: true,
                toolSets,
                count: toolSets.length,
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
