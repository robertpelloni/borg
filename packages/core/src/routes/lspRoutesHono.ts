import { Hono } from 'hono';
import { LspManager } from '../managers/LspManager.js';

export function createLspRoutes(): Hono {
  const app = new Hono();
  const lspManager = LspManager.getInstance();

  app.get('/status', (c) => {
    return c.json(lspManager.getStatus());
  });

  app.get('/configs', (c) => {
    return c.json(lspManager.getAllServerConfigs());
  });

  app.get('/available', async (c) => {
    const availability = await lspManager.checkAvailability();
    return c.json(Object.fromEntries(availability));
  });

  app.post('/detect', async (c) => {
    const { projectPath } = await c.req.json();
    if (!projectPath) {
      return c.json({ error: 'projectPath is required' }, 400);
    }
    const detected = await lspManager.detectServersForProject(projectPath);
    return c.json({ detected: detected.map(cfg => ({ id: cfg.id, name: cfg.name })) });
  });

  app.post('/autoload', async (c) => {
    const { projectPath } = await c.req.json();
    if (!projectPath) {
      return c.json({ error: 'projectPath is required' }, 400);
    }
    const startedIds = await lspManager.autoLoadForProject(projectPath);
    return c.json({ started: startedIds, status: lspManager.getStatus() });
  });

  app.post('/start', async (c) => {
    const { serverId, projectRoot } = await c.req.json();
    if (!serverId || !projectRoot) {
      return c.json({ error: 'serverId and projectRoot are required' }, 400);
    }
    try {
      const instance = await lspManager.startServer(serverId, projectRoot);
      return c.json({ success: true, server: { id: serverId, status: instance.status } });
    } catch (err) {
      return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  app.post('/stop', async (c) => {
    const { serverId } = await c.req.json();
    if (!serverId) {
      return c.json({ error: 'serverId is required' }, 400);
    }
    await lspManager.stopServer(serverId);
    return c.json({ success: true });
  });

  app.post('/stop-all', async (c) => {
    await lspManager.stopAll();
    return c.json({ success: true });
  });

  app.get('/server/:serverId', (c) => {
    const serverId = c.req.param('serverId');
    const instance = lspManager.getServerInstance(serverId);
    if (!instance) {
      return c.json({ error: 'Server not found' }, 404);
    }
    return c.json({
      id: serverId,
      name: instance.config.name,
      status: instance.status,
      projectRoot: instance.projectRoot,
      startedAt: instance.startedAt,
      error: instance.error,
    });
  });

  app.get('/server-for-file', (c) => {
    const filePath = c.req.query('filePath');
    if (!filePath) {
      return c.json({ error: 'filePath query param is required' }, 400);
    }
    const config = lspManager.getServerForFile(filePath);
    if (!config) {
      return c.json({ server: null });
    }
    return c.json({ server: { id: config.id, name: config.name } });
  });

  app.post('/configs', async (c) => {
    const { id, name, command, args, rootPatterns, fileExtensions } = await c.req.json();
    if (!id || !name || !command) {
      return c.json({ error: 'id, name, and command are required' }, 400);
    }
    lspManager.addCustomConfig({
      id,
      name,
      command,
      args: args ?? [],
      rootPatterns: rootPatterns ?? [],
      fileExtensions: fileExtensions ?? [],
    });
    return c.json({ success: true });
  });

  app.delete('/configs/:id', (c) => {
    const id = c.req.param('id');
    const removed = lspManager.removeCustomConfig(id);
    return c.json({ success: removed });
  });

  return app;
}
