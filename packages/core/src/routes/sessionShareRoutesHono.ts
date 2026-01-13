import { Hono } from 'hono';
import { SessionManager } from '../managers/SessionManager.js';

export function createSessionShareRoutes(sessionManager: SessionManager): Hono {
  const app = new Hono();

  app.post('/create', async (c) => {
    const { sessionId, expiresInHours } = await c.req.json();
    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }
    const result = sessionManager.createShareLink(sessionId, expiresInHours);
    if (!result) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ success: true, ...result });
  });

  app.get('/token/:token', (c) => {
    const token = c.req.param('token');
    const session = sessionManager.getSessionByShareToken(token);
    if (!session) {
      return c.json({ error: 'Share link not found or expired' }, 404);
    }
    return c.json({
      success: true,
      session: {
        id: session.id,
        agentName: session.agentName,
        timestamp: session.timestamp,
        messages: session.messages,
      },
    });
  });

  app.delete('/revoke/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId');
    const revoked = sessionManager.revokeShareLink(sessionId);
    if (!revoked) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ success: true });
  });

  app.get('/list', (c) => {
    const shared = sessionManager.getSharedSessions();
    return c.json({
      success: true,
      sessions: shared.map(s => ({
        id: s.id,
        agentName: s.agentName,
        shareToken: s.shareToken,
        expiresAt: s.shareExpiresAt,
      })),
    });
  });

  return app;
}
