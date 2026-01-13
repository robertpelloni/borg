import { Hono } from 'hono';
import { GitWorktreeManager, type WorktreeConfig } from '../managers/GitWorktreeManager.js';

interface WorktreeDependencies {
  baseDir: string;
}

let worktreeManager: GitWorktreeManager | null = null;

function getOrCreateManager(baseDir: string): GitWorktreeManager {
  if (!worktreeManager) {
    worktreeManager = new GitWorktreeManager({ baseDir });
  }
  return worktreeManager;
}

export function createGitWorktreeRoutes(deps: WorktreeDependencies): Hono {
  const app = new Hono();

  app.post('/init', async (c) => {
    const { maxWorktrees, cleanupOnExit, defaultBranch } = await c.req.json<Partial<WorktreeConfig>>();
    
    worktreeManager = new GitWorktreeManager({
      baseDir: deps.baseDir,
      maxWorktrees,
      cleanupOnExit,
      defaultBranch,
    });

    return c.json({ status: 'initialized', stats: worktreeManager.getStats() });
  });

  app.get('/stats', (c) => {
    const manager = getOrCreateManager(deps.baseDir);
    return c.json(manager.getStats());
  });

  app.get('/', (c) => {
    const manager = getOrCreateManager(deps.baseDir);
    return c.json({ worktrees: manager.listWorktrees() });
  });

  app.post('/', async (c) => {
    const { agentId } = await c.req.json<{ agentId?: string }>();
    const manager = getOrCreateManager(deps.baseDir);

    try {
      const worktree = await manager.createWorktree(agentId);
      return c.json({ worktree }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 400);
    }
  });

  app.get('/:id', (c) => {
    const id = c.req.param('id');
    const manager = getOrCreateManager(deps.baseDir);
    
    const worktree = manager.getWorktree(id);
    if (!worktree) {
      return c.json({ error: 'Worktree not found' }, 404);
    }

    return c.json({ worktree });
  });

  app.get('/:id/status', async (c) => {
    const id = c.req.param('id');
    const manager = getOrCreateManager(deps.baseDir);
    
    const status = await manager.getWorktreeStatus(id);
    return c.json(status);
  });

  app.post('/:id/assign', async (c) => {
    const id = c.req.param('id');
    const { agentId } = await c.req.json<{ agentId: string }>();
    const manager = getOrCreateManager(deps.baseDir);

    try {
      const worktree = manager.assignWorktree(id, agentId);
      return c.json({ worktree });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 400);
    }
  });

  app.post('/:id/release', (c) => {
    const id = c.req.param('id');
    const manager = getOrCreateManager(deps.baseDir);
    
    manager.releaseWorktree(id);
    return c.json({ status: 'released' });
  });

  app.post('/:id/sync', async (c) => {
    const id = c.req.param('id');
    const manager = getOrCreateManager(deps.baseDir);

    try {
      const result = await manager.syncWithMain(id);
      return c.json(result);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.post('/:id/merge', async (c) => {
    const id = c.req.param('id');
    const { commitMessage } = await c.req.json<{ commitMessage?: string }>();
    const manager = getOrCreateManager(deps.baseDir);

    try {
      const result = await manager.mergeToMain(id, commitMessage);
      return c.json(result);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.post('/:id/reset', async (c) => {
    const id = c.req.param('id');
    const manager = getOrCreateManager(deps.baseDir);

    try {
      await manager.resetWorktree(id);
      return c.json({ status: 'reset' });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const force = c.req.query('force') === 'true';
    const manager = getOrCreateManager(deps.baseDir);

    try {
      await manager.removeWorktree(id, force);
      return c.json({ status: 'removed' });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.get('/agent/:agentId', (c) => {
    const agentId = c.req.param('agentId');
    const manager = getOrCreateManager(deps.baseDir);
    
    const worktree = manager.getWorktreeForAgent(agentId);
    if (!worktree) {
      return c.json({ error: 'No worktree assigned to this agent' }, 404);
    }

    return c.json({ worktree });
  });

  app.post('/agent/:agentId/acquire', async (c) => {
    const agentId = c.req.param('agentId');
    const manager = getOrCreateManager(deps.baseDir);

    try {
      const worktree = await manager.getOrCreateWorktree(agentId);
      return c.json({ worktree });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 400);
    }
  });

  return app;
}
