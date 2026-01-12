/**
 * Memory Routes - Hono routes for memory management including Vibememo
 */

import { Hono } from 'hono';
import type { MemoryManager } from '../managers/MemoryManager.js';
import { VibememoProvider, createVibememoProvider } from '../providers/VibememoProvider.js';

export function createMemoryRoutes(memoryManager: MemoryManager) {
  const app = new Hono();
  
  // Initialize Vibememo provider
  let vibememoProvider: VibememoProvider | null = null;
  
  // Initialize on first request or startup
  const getVibememo = async (): Promise<VibememoProvider | null> => {
    if (!vibememoProvider) {
      vibememoProvider = createVibememoProvider();
      try {
        await vibememoProvider.init();
        if (vibememoProvider.isAvailable()) {
          await memoryManager.registerProvider(vibememoProvider);
        }
      } catch (error) {
        console.warn('[MemoryRoutes] Vibememo initialization failed:', error);
      }
    }
    return vibememoProvider;
  };

  // === Core Memory Routes ===

  // Get all providers
  app.get('/providers', (c) => {
    return c.json(memoryManager.getProviders());
  });

  // Search memories
  app.get('/search', async (c) => {
    const query = c.req.query('query');
    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }
    const results = await memoryManager.search({ query });
    return c.json({ results });
  });

  // Remember something
  app.post('/remember', async (c) => {
    const body = await c.req.json();
    const { content, tags, skipDedup } = body;
    
    if (!content) {
      return c.json({ error: 'Content is required' }, 400);
    }
    
    const result = await memoryManager.remember({ content, tags, skipDedup });
    return c.json({ success: true, message: result });
  });

  // Recall recent memories
  app.get('/recent', async (c) => {
    const limit = parseInt(c.req.query('limit') || '10');
    const memories = await memoryManager.recall({ limit });
    return c.json({ memories });
  });

  // Get stats
  app.get('/stats', async (c) => {
    const stats = await memoryManager.getStats();
    return c.json(stats);
  });

  // === Snapshot Routes ===

  // List snapshots
  app.get('/snapshots', (c) => {
    return c.json({ snapshots: memoryManager.listSnapshots() });
  });

  // Create snapshot
  app.post('/snapshots', async (c) => {
    const body = await c.req.json();
    const { description } = body;
    const snapshot = await memoryManager.createSnapshot(description);
    return c.json({ success: true, snapshot });
  });

  // Restore snapshot
  app.post('/snapshots/:id/restore', async (c) => {
    const id = c.req.param('id');
    const result = await memoryManager.restoreSnapshot(id);
    return c.json(result);
  });

  // Delete snapshot
  app.delete('/snapshots/:id', async (c) => {
    const id = c.req.param('id');
    const success = await memoryManager.deleteSnapshot(id);
    return c.json({ success });
  });

  // === Vibememo-specific Routes ===

  // Get vibememo status
  app.get('/vibememo/status', async (c) => {
    const vibe = await getVibememo();
    if (!vibe) {
      return c.json({ 
        available: false, 
        message: 'Vibememo provider not initialized' 
      });
    }
    
    const stats = await vibe.getStats();
    return c.json({
      available: vibe.isAvailable(),
      sessionId: vibe.getSessionId(),
      projectId: vibe.getProjectId(),
      messageCount: vibe.getMessageCount(),
      stats,
    });
  });

  // Get context for current message
  app.post('/vibememo/context', async (c) => {
    const vibe = await getVibememo();
    if (!vibe || !vibe.isAvailable()) {
      return c.json({ 
        error: 'Vibememo not available',
        contextText: '',
        hasMemories: false,
      });
    }
    
    const body = await c.req.json();
    const { message } = body;
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }
    
    const context = await vibe.getContext(message);
    return c.json(context || { contextText: '', hasMemories: false });
  });

  // Track conversation exchange
  app.post('/vibememo/track', async (c) => {
    const vibe = await getVibememo();
    if (!vibe || !vibe.isAvailable()) {
      return c.json({ error: 'Vibememo not available' }, 503);
    }
    
    const body = await c.req.json();
    const { userMessage, claudeResponse } = body;
    
    await vibe.trackExchange(userMessage || '', claudeResponse || '');
    return c.json({ success: true, messageCount: vibe.getMessageCount() });
  });

  // Run checkpoint curation
  app.post('/vibememo/checkpoint', async (c) => {
    const vibe = await getVibememo();
    if (!vibe || !vibe.isAvailable()) {
      return c.json({ 
        success: false, 
        error: 'Vibememo not available',
        memoriesCurated: 0,
      }, 503);
    }
    
    const body = await c.req.json();
    const { trigger, claudeSessionId, cwd } = body;
    
    const result = await vibe.checkpoint(
      trigger || 'session_end',
      claudeSessionId,
      cwd
    );
    return c.json(result);
  });

  // Curate from transcript file
  app.post('/vibememo/curate-transcript', async (c) => {
    const vibe = await getVibememo();
    if (!vibe || !vibe.isAvailable()) {
      return c.json({ 
        success: false, 
        error: 'Vibememo not available',
        memoriesCurated: 0,
      }, 503);
    }
    
    const body = await c.req.json();
    const { transcriptPath, trigger, curationMethod } = body;
    
    if (!transcriptPath) {
      return c.json({ error: 'transcriptPath is required' }, 400);
    }
    
    const result = await vibe.curateFromTranscript(
      transcriptPath,
      trigger || 'session_end',
      curationMethod || 'sdk'
    );
    return c.json(result);
  });

  // Set session
  app.post('/vibememo/session', async (c) => {
    const vibe = await getVibememo();
    if (!vibe) {
      return c.json({ error: 'Vibememo not initialized' }, 503);
    }
    
    const body = await c.req.json();
    const { sessionId, projectId } = body;
    
    if (sessionId) {
      vibe.setSessionId(sessionId);
    }
    if (projectId) {
      vibe.setProjectId(projectId);
    }
    
    return c.json({
      sessionId: vibe.getSessionId(),
      projectId: vibe.getProjectId(),
    });
  });

  // Test curator
  app.post('/vibememo/test-curator', async (c) => {
    const vibe = await getVibememo();
    if (!vibe || !vibe.isAvailable()) {
      return c.json({ 
        success: false, 
        message: 'Vibememo not available',
      });
    }
    
    const result = await vibe.testCurator();
    return c.json(result);
  });

  // === Backfill Routes ===

  // Backfill from session logs
  app.post('/backfill/sessions', async (c) => {
    const body = await c.req.json();
    const { sessionsDir, since, agentFilter, maxSessions } = body;
    
    if (!sessionsDir) {
      return c.json({ error: 'sessionsDir is required' }, 400);
    }
    
    const result = await memoryManager.backfillFromSessionLogs(sessionsDir, {
      since: since ? new Date(since) : undefined,
      agentFilter,
      maxSessions,
    });
    
    return c.json(result);
  });

  // === Consolidation Routes ===

  // Consolidate logs
  app.post('/consolidate', async (c) => {
    const body = await c.req.json();
    const { logs } = body;
    
    if (!logs || !Array.isArray(logs)) {
      return c.json({ error: 'logs array is required' }, 400);
    }
    
    const result = await memoryManager.consolidateLogs(logs);
    return c.json({ success: true, message: result });
  });

  return app;
}
