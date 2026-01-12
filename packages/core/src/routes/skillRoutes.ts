import { Hono } from 'hono';
import { SkillManager } from '../managers/SkillManager.js';

export function createSkillRoutes(skillManager: SkillManager) {
  const app = new Hono();

  app.get('/', async (c) => {
    const skills = skillManager.listSkills();
    return c.json({ 
      total: skills.length,
      skills: skills.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description.substring(0, 200),
        source: s.source,
        tags: s.tags
      }))
    });
  });

  app.get('/stats', (c) => {
    return c.json(skillManager.getStats());
  });

  app.get('/categories', (c) => {
    return c.json({ categories: skillManager.getCategories() });
  });

  app.get('/search', async (c) => {
    const query = c.req.query('q') || '';
    if (!query) {
      return c.json({ error: 'Missing query parameter q' }, 400);
    }
    const results = skillManager.searchSkills(query);
    return c.json({ 
      query,
      count: results.length,
      skills: results.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description.substring(0, 200),
        source: s.source
      }))
    });
  });

  app.get('/category/:category', async (c) => {
    const category = c.req.param('category');
    const skills = skillManager.listSkillsByCategory(category);
    return c.json({ 
      category,
      count: skills.length,
      skills: skills.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description.substring(0, 200)
      }))
    });
  });

  app.get('/source/:source', async (c) => {
    const source = c.req.param('source') as 'local' | 'vibeship' | 'registry';
    const skills = skillManager.listSkillsBySource(source);
    return c.json({ 
      source,
      count: skills.length,
      skills: skills.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description.substring(0, 200)
      }))
    });
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const def = skillManager.getSkillDefinition(id);
    if (!def) {
      return c.json({ error: 'Skill not found' }, 404);
    }
    return c.json({ skill: def });
  });

  app.get('/:id/content', async (c) => {
    const id = c.req.param('id');
    const focus = c.req.query('focus');
    try {
      const content = await skillManager.getSkillContent(id, focus);
      return c.json({ id, content });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  app.get('/:id/full', async (c) => {
    const id = c.req.param('id');
    try {
      const skill = await skillManager.loadSkill(id);
      if (!skill) {
        return c.json({ error: 'Skill not found' }, 404);
      }
      return c.json({ skill });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  app.post('/:id/execute', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { params = {}, context = {} } = body as { params?: Record<string, unknown>; context?: Record<string, unknown> };
    
    try {
      const result = await skillManager.executeSkill(id, params, context);
      return c.json({ result });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  return app;
}
