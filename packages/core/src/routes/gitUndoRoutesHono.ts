import { Hono } from 'hono';
import { GitUndoManager } from '../managers/GitUndoManager.js';

export function createGitUndoRoutes(gitUndoManager: GitUndoManager): Hono {
  const app = new Hono();

  app.get('/status', (c) => {
    return c.json(gitUndoManager.getStatus());
  });

  app.get('/history', (c) => {
    return c.json({
      undoStack: gitUndoManager.getUndoStack(),
      redoStack: gitUndoManager.getRedoStack(),
    });
  });

  app.get('/session/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId');
    return c.json({ entries: gitUndoManager.getHistoryForSession(sessionId) });
  });

  app.post('/start', async (c) => {
    const { sessionId, description } = await c.req.json();
    if (!sessionId || !description) {
      return c.json({ error: 'sessionId and description required' }, 400);
    }
    const id = await gitUndoManager.startChangeGroup(sessionId, description);
    return c.json({ success: true, groupId: id });
  });

  app.post('/track', async (c) => {
    const { filePath, changeType, previousContent } = await c.req.json();
    if (!filePath || !changeType) {
      return c.json({ error: 'filePath and changeType required' }, 400);
    }
    try {
      await gitUndoManager.trackFileChange(filePath, changeType, previousContent);
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post('/commit', async (c) => {
    try {
      const entry = await gitUndoManager.commitChangeGroup();
      return c.json({ success: true, entry });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  app.post('/undo', async (c) => {
    if (!gitUndoManager.canUndo()) {
      return c.json({ error: 'Nothing to undo' }, 400);
    }
    const entry = await gitUndoManager.undo();
    return c.json({ success: true, entry });
  });

  app.post('/redo', async (c) => {
    if (!gitUndoManager.canRedo()) {
      return c.json({ error: 'Nothing to redo' }, 400);
    }
    const entry = await gitUndoManager.redo();
    return c.json({ success: true, entry });
  });

  app.post('/clear', (c) => {
    gitUndoManager.clearHistory();
    return c.json({ success: true });
  });

  app.get('/git/history', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '20', 10);
    const history = await gitUndoManager.getGitHistory(limit);
    return c.json({ success: true, commits: history });
  });

  app.post('/git/revert', async (c) => {
    const { commitHash } = await c.req.json();
    if (!commitHash) {
      return c.json({ error: 'commitHash required' }, 400);
    }
    const success = await gitUndoManager.revertToCommit(commitHash);
    return c.json({ success });
  });

  return app;
}
