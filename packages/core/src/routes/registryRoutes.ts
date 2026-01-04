import { FastifyInstance } from 'fastify';
import { CoreService } from '../server.js';

export function registerRegistryRoutes(app: FastifyInstance, service: CoreService) {
  app.get('/api/registry/agents', async (request, reply) => {
    const agents = service.agentManager.registry.listAgents();
    return { agents };
  });

  app.get('/api/registry/agents/:id', async (request: any, reply) => {
    const { id } = request.params;
    const agent = service.agentManager.registry.getAgent(id);
    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }
    return { agent };
  });

  app.get('/api/registry/search', async (request: any, reply) => {
    const { capability } = request.query;
    if (!capability) {
        return reply.code(400).send({ error: 'Missing capability query param' });
    }
    const agents = service.agentManager.registry.findAgentsByCapability(capability);
    return { agents };
  });
}
