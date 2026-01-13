import { Hono } from 'hono';
import { ArchitectMode, type ArchitectConfig } from '../agents/ArchitectMode.js';

export function createArchitectRoutes(architect: ArchitectMode): Hono {
  const app = new Hono();

  app.get('/config', (c) => {
    return c.json({ configured: true, config: architect.getConfig() });
  });

  app.post('/sessions', async (c) => {
    const { task } = await c.req.json<{ task: string }>();
    if (!task) return c.json({ error: 'task is required' }, 400);

    try {
      const session = await architect.startSession(task);
      return c.json({ 
        sessionId: session.id,
        status: session.status,
        plan: session.plan,
        reasoningOutput: session.reasoningOutput,
      });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.get('/sessions', (c) => {
    const sessions = architect.listSessions().map(s => ({
      id: s.id,
      task: s.task,
      status: s.status,
      hasPlan: !!s.plan,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    }));
    return c.json({ sessions });
  });

  app.get('/sessions/active', (c) => {
    const sessions = architect.getActiveSessions().map(s => ({
      id: s.id,
      task: s.task,
      status: s.status,
      hasPlan: !!s.plan,
      startedAt: s.startedAt,
    }));
    return c.json({ sessions });
  });

  app.get('/sessions/:id', (c) => {
    const id = c.req.param('id');
    const session = architect.getSession(id);
    if (!session) return c.json({ error: 'Session not found' }, 404);
    return c.json({ session });
  });

  app.post('/sessions/:id/approve', async (c) => {
    const id = c.req.param('id');
    const approved = architect.approvePlan(id);
    if (!approved) return c.json({ error: 'Cannot approve' }, 400);
    return c.json({ status: 'approved' });
  });

  app.post('/sessions/:id/reject', async (c) => {
    const id = c.req.param('id');
    const { feedback } = await c.req.json<{ feedback?: string }>();
    const rejected = architect.rejectPlan(id, feedback);
    if (!rejected) return c.json({ error: 'Cannot reject' }, 400);
    return c.json({ status: 'rejected' });
  });

  app.post('/sessions/:id/revise', async (c) => {
    const id = c.req.param('id');
    const { feedback } = await c.req.json<{ feedback: string }>();
    if (!feedback) return c.json({ error: 'feedback is required' }, 400);
    
    try {
      const plan = await architect.revisePlan(id, feedback);
      return c.json({ status: 'revised', plan });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  return app;
}
