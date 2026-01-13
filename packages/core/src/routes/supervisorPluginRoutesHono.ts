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
      provider: p.manifest.provider,
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

  app.post('/load/directory', async (c) => {
    const { directory } = await c.req.json<{ directory?: string }>();
    
    try {
      const results = await pluginManager.loadFromDirectory(directory);
      return c.json({ results });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.post('/load/path', async (c) => {
    const { path } = await c.req.json<{ path: string }>();
    
    if (!path) {
      return c.json({ error: 'path is required' }, 400);
    }

    const result = await pluginManager.loadPlugin(path);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ pluginId: result.pluginId }, 201);
  });

  app.post('/load/npm', async (c) => {
    const { packageName } = await c.req.json<{ packageName: string }>();
    
    if (!packageName) {
      return c.json({ error: 'packageName is required' }, 400);
    }

    const result = await pluginManager.loadFromNpm(packageName);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ pluginId: result.pluginId }, 201);
  });

  app.post('/:id/enable', (c) => {
    const id = c.req.param('id');
    const enabled = pluginManager.enablePlugin(id);
    
    if (!enabled) {
      return c.json({ error: 'Plugin not found' }, 404);
    }

    return c.json({ status: 'enabled' });
  });

  app.post('/:id/disable', (c) => {
    const id = c.req.param('id');
    const disabled = pluginManager.disablePlugin(id);
    
    if (!disabled) {
      return c.json({ error: 'Plugin not found' }, 404);
    }

    return c.json({ status: 'disabled' });
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

  app.get('/health/all', async (c) => {
    const healthMap = await pluginManager.checkAllHealth();
    const health: Record<string, { available: boolean; error?: string }> = {};
    
    for (const [id, status] of healthMap) {
      health[id] = status;
    }
    
    return c.json({ health });
  });

  return app;
}
