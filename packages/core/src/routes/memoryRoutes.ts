import { FastifyInstance } from 'fastify';
import { MemoryManager } from '../managers/MemoryManager.js';
import { z } from 'zod';

const IngestContentSchema = z.object({
  content: z.string(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export async function memoryRoutes(server: FastifyInstance, memoryManager: MemoryManager) {
  
  // Get all providers
  server.get('/memory/providers', async () => {
    return memoryManager.getProviders();
  });

  // Search memories
  server.get('/memory/search', async (request, reply) => {
    const { query, providerId } = request.query as { query: string, providerId?: string };
    if (!query) return reply.code(400).send({ error: 'Query is required' });
    
    return memoryManager.search({ query, providerId });
  });

  // Remember something (Ingest)
  server.post('/memory/remember', async (request) => {
    const body = IngestContentSchema.parse(request.body);
    const result = await memoryManager.remember({
      content: body.content,
      tags: body.tags
    });
    return { success: true, id: result };
  });

  // List snapshots
  server.get('/memory/snapshots', async () => {
      return memoryManager.listSnapshots({});
  });

  // Create snapshot
  server.post('/memory/snapshots', async (request, reply) => {
      const { sessionId, context } = request.body as { sessionId: string, context: any };
      if (!sessionId || !context) return reply.code(400).send({ error: 'Missing sessionId or context' });
      
      const result = await memoryManager.createSnapshot({ sessionId, context });
      return { success: true, message: result };
  });

  // Restore snapshot
  server.post('/memory/snapshots/restore', async (request, reply) => {
      const { filename } = request.body as { filename: string };
      if (!filename) return reply.code(400).send({ error: 'Missing filename' });

      try {
        const result = await memoryManager.restoreSnapshot({ filename });
        return { success: true, data: result };
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
  });
}
