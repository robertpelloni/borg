import { Hono } from 'hono';
import { SupervisorPluginManager } from '../managers/SupervisorPluginManager.js';

export function createSupervisorPluginRoutes(): Hono {
  const app = new Hono();
  const pluginManager = SupervisorPluginManager.getInstance();

  app.get('/', (c) => {
    const plugins = pluginManager.listPlugins().map(p => ({
      id: p.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      specialties: p.manifest.specialties,
      status: p.status,
      loadedAt: p.loadedAt,
    }));
    return c.json({ plugins });
  });

  app.get('/stats', (c) => {
    return c.json(pluginManager.getStats());
  });

  app.get('/active', (c) => {
    const plugins = pluginManager.getActivePlugins().map(p => ({
      id: p.id,
      name: p.manifest.name,
      specialties: p.manifest.specialties,
    }));
    return c.json({ plugins });
  });

  app.get('/specialty/:specialty', (c) => {
    const specialty = c.req.param('specialty');
    const plugins = pluginManager.getPluginsBySpecialty(specialty).map(p => ({
      id: p.id,
      name: p.manifest.name,
    }));
    return c.json({ specialty, plugins });
  });

  app.get('/:id', (c) => {
    const id = c.req.param('id');
    const plugin = pluginManager.getPlugin(id);
    
    if (!plugin) {
      return c.json({ error: 'Plugin not found' }, 404);
    }

    return c.json({
      id: plugin.id,
      manifest: plugin.manifest,
      path: plugin.path,
      status: plugin.status,
      loadedAt: plugin.loadedAt,
      error: plugin.error,
    });
  });

  app.post('/register', async (c) => {
    const { name, code, options } = await c.req.json<{ name: string; code: string; options?: any }>();
    
    // In a real implementation, we'd need a safe way to evaluate the code
    // For now, let's assume registerInlinePlugin takes a chat function
    try {
        // This is a placeholder for actual code evaluation logic
        // pluginManager.registerInlinePlugin(name, async (msg) => eval(code));
        return c.json({ error: 'Dynamic code registration not fully implemented' }, 501);
    } catch (e) {
        return c.json({ error: (e as Error).message }, 400);
    }
  });

  app.post('/:id/enable', (c) => {
    const id = c.req.param('id');
    pluginManager.enablePlugin(id);
    return c.json({ success: true });
  });

  app.post('/:id/disable', (c) => {
    const id = c.req.param('id');
    pluginManager.disablePlugin(id);
    return c.json({ success: true });
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const unloaded = await pluginManager.unloadPlugin(id);
    
    if (!unloaded) {
      return c.json({ error: 'Plugin not found or failed to unload' }, 404);
    }

    return c.json({ status: 'unloaded' });
  });

  app.get('/:id/health', async (c) => {
    const id = c.req.param('id');
    const health = await pluginManager.checkPluginHealth(id);
    return c.json(health);
  });

  return app;
}
