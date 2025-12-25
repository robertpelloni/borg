import { FastifyInstance } from 'fastify';
import { CoreService } from '../server.js';

export async function registerMcpRoutes(app: FastifyInstance, service: CoreService) {
    app.get('/api/state', async () => ({
        agents: service.agentManager.getAgents(),
        skills: service.skillManager.getSkills(),
        hooks: service.hookManager.getHooks(),
        prompts: service.promptManager.getPrompts(),
        context: service.contextManager.getContextFiles(),
        mcpServers: service.mcpManager.getAllServers(),
        commands: service.commandManager.getCommands(),
        scheduledTasks: service.schedulerManager.getTasks(),
        marketplace: service.marketplaceManager.getPackages(),
        profiles: service.profileManager.getProfiles()
    }));

    app.get('/api/config/mcp/:format', async (request: any, reply) => {
        const { format } = request.params as any;
        if (['json', 'toml', 'xml'].includes(format)) {
            return service.configGenerator.generateConfig(format as any);
        }
        reply.code(400).send({ error: 'Invalid format' });
    });

    app.post('/api/mcp/start', async (request: any, reply) => {
        const { name } = request.body;
        const allConfigStr = await service.configGenerator.generateConfig('json');
        const allConfig = JSON.parse(allConfigStr);
        const serverConfig = allConfig.mcpServers[name];

        if (!serverConfig) {
            return reply.code(404).send({ error: 'Server configuration not found' });
        }

        try {
            const secrets = service.secretManager.getEnvVars();
            const env = { ...process.env, ...serverConfig.env, ...secrets };
            serverConfig.env = env;

            await service.mcpManager.startServerSimple(name, serverConfig);
            return { status: 'started' };
        } catch (err: any) {
            return reply.code(500).send({ error: err.message });
        }
    });

    app.post('/api/mcp/stop', async (request: any, reply) => {
        const { name } = request.body;
        await service.mcpManager.stopServer(name);
        return { status: 'stopped' };
    });
}
