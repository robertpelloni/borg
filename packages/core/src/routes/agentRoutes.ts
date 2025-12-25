import { FastifyInstance } from 'fastify';
import { CoreService } from '../server.js';

export async function registerAgentRoutes(app: FastifyInstance, service: CoreService) {
    app.post('/api/agents/run', async (request: any, reply) => {
        const { agentName, task } = request.body;
        const agents = service.agentManager.getAgents();
        const agent = agents.find(a => a.name === agentName);
        if (!agent) return reply.code(404).send({ error: "Agent not found" });

        const result = await service.agentExecutor.run(agent, task);
        return { result };
    });

    app.post('/api/code/run', async (request: any, reply) => {
        const { code, sessionId } = request.body;
        try {
            const result = await service.codeExecutionManager.execute(code, async (name, args) => {
                return await service.proxyManager.callTool(name, args, sessionId);
            }, sessionId);
            return { result };
        } catch (err: any) {
            return reply.code(500).send({ error: err.message });
        }
    });
}
