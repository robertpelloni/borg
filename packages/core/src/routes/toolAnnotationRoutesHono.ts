import { Hono } from 'hono';
import { ToolAnnotationManager } from '../managers/ToolAnnotationManager.js';

export function createToolAnnotationRoutes(annotationManager: ToolAnnotationManager): Hono {
  const app = new Hono();

  app.get('/status', (c) => {
    return c.json(annotationManager.getStatus());
  });

  app.get('/all', (c) => {
    return c.json({ annotations: annotationManager.getAllAnnotations() });
  });

  app.get('/server/:serverName', (c) => {
    const serverName = c.req.param('serverName');
    return c.json({ annotations: annotationManager.getAnnotationsByServer(serverName) });
  });

  app.get('/category/:category', (c) => {
    const category = c.req.param('category');
    return c.json({ annotations: annotationManager.getAnnotationsByCategory(category) });
  });

  app.get('/tag/:tag', (c) => {
    const tag = c.req.param('tag');
    return c.json({ annotations: annotationManager.getAnnotationsByTag(tag) });
  });

  app.get('/categories', (c) => {
    return c.json({ categories: annotationManager.getCategories() });
  });

  app.get('/tags', (c) => {
    return c.json({ tags: annotationManager.getAllTags() });
  });

  app.get('/tool/:serverName/:toolName', (c) => {
    const { serverName, toolName } = c.req.param();
    const annotation = annotationManager.getAnnotation(serverName, toolName);
    if (!annotation) {
      return c.json({ error: 'Annotation not found' }, 404);
    }
    return c.json(annotation);
  });

  app.put('/tool/:serverName/:toolName', async (c) => {
    const { serverName, toolName } = c.req.param();
    const body = await c.req.json();
    const annotation = annotationManager.setAnnotation(serverName, toolName, body);
    return c.json({ success: true, annotation });
  });

  app.delete('/tool/:serverName/:toolName', (c) => {
    const { serverName, toolName } = c.req.param();
    const removed = annotationManager.removeAnnotation(serverName, toolName);
    if (!removed) {
      return c.json({ error: 'Annotation not found' }, 404);
    }
    return c.json({ success: true });
  });

  app.put('/tool/:serverName/:toolName/ui-hints', async (c) => {
    const { serverName, toolName } = c.req.param();
    const hints = await c.req.json();
    const annotation = annotationManager.setUiHints(serverName, toolName, hints);
    return c.json({ success: true, annotation });
  });

  app.post('/tool/:serverName/:toolName/examples', async (c) => {
    const { serverName, toolName } = c.req.param();
    const example = await c.req.json();
    if (!example.name || !example.input) {
      return c.json({ error: 'name and input are required' }, 400);
    }
    const annotation = annotationManager.addExample(serverName, toolName, example);
    return c.json({ success: true, annotation });
  });

  app.put('/tool/:serverName/:toolName/permissions', async (c) => {
    const { serverName, toolName } = c.req.param();
    const permissions = await c.req.json();
    const annotation = annotationManager.setPermissions(serverName, toolName, permissions);
    return c.json({ success: true, annotation });
  });

  app.get('/visible', (c) => {
    const serverName = c.req.query('serverName');
    return c.json({ tools: annotationManager.getVisibleTools(serverName) });
  });

  app.get('/deprecated', (c) => {
    return c.json({ tools: annotationManager.getDeprecatedTools() });
  });

  app.get('/requiring-confirmation', (c) => {
    return c.json({ tools: annotationManager.getToolsRequiringConfirmation() });
  });

  app.get('/for-agent/:agentName', (c) => {
    const agentName = c.req.param('agentName');
    return c.json({ tools: annotationManager.getToolsForAgent(agentName) });
  });

  app.post('/bulk', async (c) => {
    const { annotations } = await c.req.json();
    if (!Array.isArray(annotations)) {
      return c.json({ error: 'annotations must be an array' }, 400);
    }
    annotationManager.bulkSetAnnotations(annotations);
    return c.json({ success: true, count: annotations.length });
  });

  app.get('/export', (c) => {
    return c.json({ annotations: annotationManager.exportAnnotations() });
  });

  app.post('/import', async (c) => {
    const { annotations } = await c.req.json();
    if (!Array.isArray(annotations)) {
      return c.json({ error: 'annotations must be an array' }, 400);
    }
    const count = annotationManager.importAnnotations(annotations);
    return c.json({ success: true, imported: count });
  });

  return app;
}
