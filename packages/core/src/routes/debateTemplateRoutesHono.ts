import { Hono } from 'hono';
import { SupervisorCouncilManager, type DebateTemplate, type DevelopmentTask } from '../managers/SupervisorCouncilManager.js';
import * as crypto from 'crypto';

export function createDebateTemplateRoutes(): Hono {
  const app = new Hono();
  const councilManager = SupervisorCouncilManager.getInstance();

  app.get('/', (c) => {
    const templates = councilManager.getTemplates();
    return c.json({ templates });
  });

  app.get('/:id', (c) => {
    const id = c.req.param('id');
    const templates = councilManager.getTemplates();
    const template = templates.find(t => t.id === id);
    
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template });
  });

  app.post('/', async (c) => {
    const template = await c.req.json<DebateTemplate>();
    
    if (!template.id || !template.name || !template.systemPrompt) {
      return c.json({ error: 'id, name, and systemPrompt are required' }, 400);
    }

    const existingTemplates = councilManager.getTemplates();
    if (existingTemplates.some(t => t.id === template.id)) {
      return c.json({ error: 'Template with this ID already exists' }, 409);
    }

    councilManager.addCustomTemplate(template);
    return c.json({ status: 'created', template }, 201);
  });

  app.post('/:id/debate', async (c) => {
    const id = c.req.param('id');
    const { task: taskInput } = await c.req.json<{
      task: { description: string; files: string[]; context?: string };
    }>();

    if (!taskInput?.description || !taskInput?.files) {
      return c.json({ error: 'task.description and task.files are required' }, 400);
    }

    const task: DevelopmentTask = {
      id: crypto.randomUUID(),
      description: taskInput.description,
      files: taskInput.files,
      context: taskInput.context || '',
    };

    try {
      const result = await councilManager.debateWithTemplate(task, id);
      return c.json({ result });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('not found')) {
        return c.json({ error: message }, 404);
      }
      return c.json({ error: message }, 500);
    }
  });

  app.get('/list/names', (c) => {
    const templates = councilManager.getTemplates();
    const names = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
    }));

    return c.json({ templates: names });
  });

  return app;
}

