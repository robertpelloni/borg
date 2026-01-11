import { Hono } from 'hono';
import { 
  CLISessionManager, 
  cliSessionManager,
  CLIRegistry,
  cliRegistry,
  SmartPilotManager,
  smartPilotManager,
  VetoManager,
  vetoManager,
  DebateHistoryManager,
  debateHistoryManager,
} from '../managers/autopilot/index.js';
import type { SessionConfig, BulkSessionRequest } from '../managers/autopilot/CLISessionManager.js';

export function createAutopilotRoutes(): Hono {
  const router = new Hono();

  router.get('/cli/tools', async (c) => {
    const tools = await cliRegistry.detectAll();
    return c.json({ tools, stats: cliRegistry.getStats() });
  });

  router.get('/cli/tools/available', (c) => {
    return c.json({ tools: cliRegistry.getAvailableTools() });
  });

  router.post('/cli/tools/refresh', async (c) => {
    const tools = await cliRegistry.refreshDetection();
    return c.json({ tools, stats: cliRegistry.getStats() });
  });

  router.post('/cli/tools/custom', async (c) => {
    const tool = await c.req.json();
    cliRegistry.registerCustomTool(tool);
    return c.json({ status: 'registered', tool });
  });

  router.delete('/cli/tools/custom/:name', (c) => {
    const name = c.req.param('name');
    const removed = cliRegistry.unregisterCustomTool(name);
    return c.json({ status: removed ? 'removed' : 'not_found', name });
  });

  router.get('/sessions', (c) => {
    return c.json({ 
      sessions: cliSessionManager.getAllSessions(),
      stats: cliSessionManager.getStats(),
    });
  });

  router.get('/sessions/:id', (c) => {
    const session = cliSessionManager.getSession(c.req.param('id'));
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json(session);
  });

  router.post('/sessions', async (c) => {
    const config: SessionConfig = await c.req.json();
    
    if (!config.cliType || !config.workingDirectory) {
      return c.json({ error: 'cliType and workingDirectory are required' }, 400);
    }
    
    try {
      const session = await cliSessionManager.createSession(config);
      return c.json(session, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.post('/sessions/:id/start', async (c) => {
    try {
      const session = await cliSessionManager.startSession(c.req.param('id'));
      return c.json(session);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.post('/sessions/:id/stop', async (c) => {
    try {
      await cliSessionManager.stopSession(c.req.param('id'));
      return c.json({ status: 'stopped' });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.post('/sessions/:id/restart', async (c) => {
    try {
      const session = await cliSessionManager.restartSession(c.req.param('id'));
      return c.json(session);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.delete('/sessions/:id', async (c) => {
    try {
      await cliSessionManager.removeSession(c.req.param('id'));
      return c.json({ status: 'removed' });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.get('/sessions/:id/logs', (c) => {
    const limit = c.req.query('limit');
    const logs = cliSessionManager.getSessionLogs(
      c.req.param('id'), 
      limit ? parseInt(limit, 10) : undefined
    );
    return c.json({ logs });
  });

  router.post('/sessions/:id/tags', async (c) => {
    const { tag } = await c.req.json();
    cliSessionManager.addTag(c.req.param('id'), tag);
    return c.json({ status: 'added', tag });
  });

  router.delete('/sessions/:id/tags/:tag', (c) => {
    cliSessionManager.removeTag(c.req.param('id'), c.req.param('tag'));
    return c.json({ status: 'removed' });
  });

  router.post('/sessions/bulk/start', async (c) => {
    const request: BulkSessionRequest = await c.req.json();
    
    if (!request.count || request.count < 1) {
      return c.json({ error: 'count must be at least 1' }, 400);
    }
    
    try {
      const response = await cliSessionManager.bulkStartSessions(request);
      return c.json(response);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.post('/sessions/bulk/stop', async (c) => {
    const { sessionIds } = await c.req.json();
    const count = await cliSessionManager.bulkStopSessions(sessionIds);
    return c.json({ status: 'stopped', count });
  });

  router.get('/smart-pilot/status', (c) => {
    return c.json({
      config: smartPilotManager.getConfig(),
      state: smartPilotManager.getState(),
    });
  });

  router.put('/smart-pilot/config', async (c) => {
    const config = await c.req.json();
    smartPilotManager.configure(config);
    return c.json({ status: 'updated', config: smartPilotManager.getConfig() });
  });

  router.post('/smart-pilot/start', async (c) => {
    try {
      await smartPilotManager.start();
      return c.json({ status: 'started' });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.post('/smart-pilot/stop', (c) => {
    smartPilotManager.stop();
    return c.json({ status: 'stopped' });
  });

  router.post('/smart-pilot/pause', async (c) => {
    const { reason } = await c.req.json();
    smartPilotManager.pause(reason || 'Manual pause');
    return c.json({ status: 'paused' });
  });

  router.post('/smart-pilot/resume', (c) => {
    smartPilotManager.resume();
    return c.json({ status: 'resumed' });
  });

  router.post('/smart-pilot/reset-approvals', (c) => {
    smartPilotManager.resetApprovalCount();
    return c.json({ status: 'reset', remaining: smartPilotManager.getRemainingAutoApprovals() });
  });

  router.get('/veto', (c) => {
    return c.json({
      requests: vetoManager.getAllRequests(),
      stats: vetoManager.getStats(),
    });
  });

  router.get('/veto/pending', (c) => {
    return c.json({ requests: vetoManager.getPendingRequests() });
  });

  router.get('/veto/:id', (c) => {
    const request = vetoManager.getRequest(c.req.param('id'));
    if (!request) {
      return c.json({ error: 'Veto request not found' }, 404);
    }
    return c.json(request);
  });

  router.post('/veto/:id/approve', async (c) => {
    const { approvedBy, reason } = await c.req.json();
    
    if (!approvedBy) {
      return c.json({ error: 'approvedBy is required' }, 400);
    }
    
    try {
      const request = vetoManager.approveVeto(c.req.param('id'), approvedBy, reason);
      return c.json(request);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  router.post('/veto/:id/reject', async (c) => {
    const { rejectedBy, reason } = await c.req.json();
    
    if (!rejectedBy) {
      return c.json({ error: 'rejectedBy is required' }, 400);
    }
    
    try {
      const request = vetoManager.rejectVeto(c.req.param('id'), rejectedBy, reason);
      return c.json(request);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  router.post('/veto/:id/extend', async (c) => {
    const { additionalMs } = await c.req.json();
    
    if (typeof additionalMs !== 'number' || additionalMs <= 0) {
      return c.json({ error: 'additionalMs must be a positive number' }, 400);
    }
    
    try {
      const request = vetoManager.extendTimeout(c.req.param('id'), additionalMs);
      return c.json(request);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  router.delete('/veto/:id', (c) => {
    const deleted = vetoManager.deleteRequest(c.req.param('id'));
    return c.json({ status: deleted ? 'deleted' : 'not_found' });
  });

  router.put('/veto/config', async (c) => {
    const config = await c.req.json();
    vetoManager.configure(config);
    return c.json({ status: 'updated', config: vetoManager.getConfig() });
  });

  router.get('/debate-history', (c) => {
    const limit = c.req.query('limit');
    const records = limit 
      ? debateHistoryManager.getRecentRecords(parseInt(limit, 10))
      : debateHistoryManager.getAllRecords();
    return c.json({ records, stats: debateHistoryManager.getStats() });
  });

  router.get('/debate-history/analytics', (c) => {
    return c.json(debateHistoryManager.getAnalytics());
  });

  router.get('/debate-history/:id', (c) => {
    const record = debateHistoryManager.getRecord(c.req.param('id'));
    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }
    return c.json(record);
  });

  router.get('/debate-history/session/:sessionId', (c) => {
    return c.json({ 
      records: debateHistoryManager.getRecordsBySession(c.req.param('sessionId')) 
    });
  });

  router.get('/debate-history/search', (c) => {
    const query = c.req.query('q');
    if (!query) {
      return c.json({ error: 'Query parameter q is required' }, 400);
    }
    return c.json({ records: debateHistoryManager.searchRecords(query) });
  });

  router.get('/debate-history/export/json', (c) => {
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', 'attachment; filename="debate-history.json"');
    return c.body(debateHistoryManager.exportToJSON());
  });

  router.get('/debate-history/export/csv', (c) => {
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="debate-history.csv"');
    return c.body(debateHistoryManager.exportToCSV());
  });

  router.delete('/debate-history/:id', (c) => {
    const deleted = debateHistoryManager.deleteRecord(c.req.param('id'));
    return c.json({ status: deleted ? 'deleted' : 'not_found' });
  });

  router.post('/debate-history/prune', async (c) => {
    const { maxAgeMs, count } = await c.req.json();
    
    let pruned = 0;
    if (maxAgeMs) {
      pruned = debateHistoryManager.pruneOlderThan(maxAgeMs);
    } else if (count) {
      pruned = debateHistoryManager.pruneOldest(count);
    }
    
    return c.json({ status: 'pruned', count: pruned });
  });

  router.put('/debate-history/config', async (c) => {
    const config = await c.req.json();
    debateHistoryManager.configure(config);
    return c.json({ status: 'updated' });
  });

  return router;
}
