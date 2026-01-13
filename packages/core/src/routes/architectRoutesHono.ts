import { Hono } from 'hono';
import { ArchitectMode, type ArchitectConfig, type ModelChatFn } from '../agents/ArchitectMode.js';
import { ModelGateway } from '../gateway/ModelGateway.js';
import { SecretManager } from '../managers/SecretManager.js';

interface ArchitectDependencies {
  modelGateway: ModelGateway;
  secretManager: SecretManager;
}

let architectInstance: ArchitectMode | null = null;

function getOrCreateArchitect(config: ArchitectConfig, deps: ArchitectDependencies): ArchitectMode {
  if (!architectInstance) {
    architectInstance = new ArchitectMode(config);
    
    const chatFn: ModelChatFn = async (model, messages, options) => {
      const chatMessages = messages.map(m => ({ 
        role: m.role as 'user' | 'assistant' | 'system', 
        content: m.content 
      }));
      return deps.modelGateway.chat(chatMessages, model);
    };

    architectInstance.setChatFunction(chatFn);
  }
  return architectInstance;
}

function getApiKey(provider: string, secretManager: SecretManager): string | null {
  const keyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    qwen: 'QWEN_API_KEY',
    groq: 'GROQ_API_KEY',
  };
  return secretManager.getSecret(keyMap[provider] || 'OPENAI_API_KEY') ?? null;
}

export function createArchitectRoutes(deps: ArchitectDependencies): Hono {
  const app = new Hono();

  app.get('/config', (c) => {
    if (!architectInstance) {
      return c.json({ 
        configured: false,
        defaults: {
          reasoningModel: 'o3-mini',
          editingModel: 'gpt-4o',
          maxReasoningTokens: 4000,
          maxEditingTokens: 8000,
          temperature: 0.3,
          autoApprove: false,
        }
      });
    }
    return c.json({ configured: true, config: architectInstance.getConfig() });
  });

  app.post('/config', async (c) => {
    const config = await c.req.json<ArchitectConfig>();
    
    if (!config.reasoningModel || !config.editingModel) {
      return c.json({ error: 'reasoningModel and editingModel are required' }, 400);
    }

    architectInstance = null;
    const architect = getOrCreateArchitect(config, deps);
    
    return c.json({ status: 'configured', config: architect.getConfig() });
  });

  app.post('/sessions', async (c) => {
    const { task, config } = await c.req.json<{ task: string; config?: ArchitectConfig }>();
    
    if (!task) {
      return c.json({ error: 'task is required' }, 400);
    }

    const architectConfig = config || {
      reasoningModel: 'o3-mini',
      editingModel: 'gpt-4o',
    };

    const architect = getOrCreateArchitect(architectConfig, deps);

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
    if (!architectInstance) {
      return c.json({ sessions: [] });
    }
    
    const sessions = architectInstance.listSessions().map(s => ({
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
    if (!architectInstance) {
      return c.json({ sessions: [] });
    }
    
    const sessions = architectInstance.getActiveSessions().map(s => ({
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
    
    if (!architectInstance) {
      return c.json({ error: 'Architect not initialized' }, 404);
    }

    const session = architectInstance.getSession(id);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({ session });
  });

  app.post('/sessions/:id/approve', async (c) => {
    const id = c.req.param('id');
    
    if (!architectInstance) {
      return c.json({ error: 'Architect not initialized' }, 404);
    }

    const approved = architectInstance.approvePlan(id);
    if (!approved) {
      return c.json({ error: 'Cannot approve - session not in reviewing state' }, 400);
    }

    return c.json({ status: 'approved', message: 'Edits are being executed' });
  });

  app.post('/sessions/:id/reject', async (c) => {
    const id = c.req.param('id');
    const { feedback } = await c.req.json<{ feedback?: string }>();
    
    if (!architectInstance) {
      return c.json({ error: 'Architect not initialized' }, 404);
    }

    const rejected = architectInstance.rejectPlan(id, feedback);
    if (!rejected) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({ status: 'rejected' });
  });

  app.post('/sessions/:id/revise', async (c) => {
    const id = c.req.param('id');
    const { feedback } = await c.req.json<{ feedback: string }>();
    
    if (!feedback) {
      return c.json({ error: 'feedback is required' }, 400);
    }

    if (!architectInstance) {
      return c.json({ error: 'Architect not initialized' }, 404);
    }

    try {
      const revisedPlan = await architectInstance.revisePlan(id, feedback);
      if (!revisedPlan) {
        return c.json({ error: 'Session or plan not found' }, 404);
      }

      return c.json({ status: 'revised', plan: revisedPlan });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.post('/sessions/:id/execute', async (c) => {
    const id = c.req.param('id');
    
    if (!architectInstance) {
      return c.json({ error: 'Architect not initialized' }, 404);
    }

    try {
      const result = await architectInstance.executeEdits(id);
      return c.json({ result });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  app.get('/sessions/:id/events', async (c) => {
    const id = c.req.param('id');
    
    if (!architectInstance) {
      return c.json({ error: 'Architect not initialized' }, 404);
    }

    const session = architectInstance.getSession(id);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return c.body(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          
          const sendEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          sendEvent('session', { session });

          const handlers = {
            sessionStarted: (data: unknown) => sendEvent('sessionStarted', data),
            reasoningComplete: (data: unknown) => sendEvent('reasoningComplete', data),
            planCreated: (data: unknown) => sendEvent('planCreated', data),
            planRevised: (data: unknown) => sendEvent('planRevised', data),
            planRejected: (data: unknown) => sendEvent('planRejected', data),
            editingStarted: (data: unknown) => sendEvent('editingStarted', data),
            fileEdited: (data: unknown) => sendEvent('fileEdited', data),
            editingComplete: (data: unknown) => sendEvent('editingComplete', data),
            editingFailed: (data: unknown) => sendEvent('editingFailed', data),
            error: (data: unknown) => sendEvent('error', data),
          };

          for (const [event, handler] of Object.entries(handlers)) {
            architectInstance!.on(event, handler);
          }

          c.req.raw.signal.addEventListener('abort', () => {
            for (const [event, handler] of Object.entries(handlers)) {
              architectInstance!.off(event, handler);
            }
            controller.close();
          });
        },
      })
    );
  });

  return app;
}
