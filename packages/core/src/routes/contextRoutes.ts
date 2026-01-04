import { FastifyInstance } from 'fastify';
import { ContextManager } from '../managers/ContextManager.js';

export async function contextRoutes(fastify: FastifyInstance, options: { contextManager: ContextManager }) {
  const { contextManager } = options;

  fastify.get('/api/context/stats', async (request, reply) => {
    try {
      const stats = contextManager.getContextStats();
      return stats;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch context stats' });
    }
  });

  fastify.get('/api/context/current', async (request, reply) => {
    try {
      return contextManager.getContextFiles();
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch current context' });
    }
  });
}
