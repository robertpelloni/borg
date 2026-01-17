import { Hono } from 'hono';
import { ToolSearchService } from '../services/ToolSearchService.js';

export function createToolRoutes(searchService: ToolSearchService): Hono {
  const app = new Hono();

  app.get('/search', async (c) => {
    const query = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '20');
    const category = c.req.query('category');
    const serverId = c.req.query('serverId');

    // Use hybrid search if query is present, otherwise just list/filter
    let results;
    if (query) {
      results = await searchService.hybridSearch(query, { 
        limit, 
        category, 
        mcpServerId: serverId 
      });
    } else {
        // If no query, just return all tools (filtered)
        // We can use searchService.tools directly or a "list" method
        // ToolSearchService doesn't have a public "getAll" with filters, 
        // but we can use filterBy... methods on the raw list.
        // For now, let's just use fuzzySearch with empty query which usually returns all
        results = searchService.fuzzySearch('', { 
            limit: 100, 
            category, 
            mcpServerId: serverId 
        });
    }

    return c.json({ results });
  });

  app.get('/stats', (c) => {
    return c.json(searchService.getStats());
  });

  app.post('/refresh', async (c) => {
    searchService.syncFromDatabase();
    return c.json({ success: true });
  });

  return app;
}
