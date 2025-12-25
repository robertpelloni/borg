import os

content = r'''import Fastify from 'fastify';
import { Socket, Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { HookManager } from './managers/HookManager.js';
import { AgentManager } from './managers/AgentManager.js';
import { SkillManager } from './managers/SkillManager.js';
import { PromptManager } from './managers/PromptManager.js';
import { ContextManager } from './managers/ContextManager.js';
import { McpManager } from './managers/McpManager.js';
import { CommandManager } from './managers/CommandManager.js';
import { ConfigGenerator } from './utils/ConfigGenerator.js';
import { HookExecutor } from './utils/HookExecutor.js';
import { McpInterface } from './interfaces/McpInterface.js';
import { ClientManager } from './managers/ClientManager.js';
import { CodeExecutionManager } from './managers/CodeExecutionManager.js';
import { McpProxyManager } from './managers/McpProxyManager.js';
import { LogManager } from './managers/LogManager.js';
import { SecretManager } from './managers/SecretManager.js';
import { HubServer } from './hub/HubServer.js';
import { HookEvent } from './types.js';
import { AgentExecutor } from './agents/AgentExecutor.js';
import { MemoryManager } from './managers/MemoryManager.js';
import { SchedulerManager } from './managers/SchedulerManager.js';
import { MarketplaceManager } from './managers/MarketplaceManager.js';
import { DocumentManager } from './managers/DocumentManager.js';
import { ProfileManager } from './managers/ProfileManager.js';
import { toToon, FormatTranslatorTool } from './utils/toon.js';
import { registerMcpRoutes } from './routes/mcpRoutes.js';
import { registerAgentRoutes } from './routes/agentRoutes.js';

export class CoreService {
  public app = Fastify({ logger: true });
  public io: SocketIOServer;
  
  public hookManager: HookManager;
  public agentManager: AgentManager;
  public skillManager: SkillManager;
  public promptManager: PromptManager;
  public contextManager: ContextManager;
  public commandManager: CommandManager;
  public mcpManager: McpManager;
  public configGenerator: ConfigGenerator;
  public mcpInterface: McpInterface;
  public clientManager: ClientManager;
  public codeExecutionManager: CodeExecutionManager;
  public proxyManager: McpProxyManager;
  public logManager: LogManager;
  public secretManager: SecretManager;
  public hubServer: HubServer;
  public agentExecutor: AgentExecutor;
  public memoryManager: MemoryManager;
  public schedulerManager: SchedulerManager;
  public marketplaceManager: MarketplaceManager;
  public documentManager: DocumentManager;
  public profileManager: ProfileManager;

  constructor(
    private rootDir: string
  ) {
    this.io = new SocketIOServer(this.app.server, {
      cors: { origin: "*" }
    });

    this.app.register(import('@fastify/cors'), {
        origin: '*'
    });

    const uiDist = path.resolve(rootDir, '../ui/dist');
    this.app.register(import('@fastify/static'), {
        root: uiDist,
        prefix: '/'
    });

    this.hookManager = new HookManager(path.join(rootDir, 'hooks'));
    this.agentManager = new AgentManager(rootDir);
    this.skillManager = new SkillManager(path.join(rootDir, 'skills'));
    this.promptManager = new PromptManager(path.join(rootDir, 'prompts'));
    this.contextManager = new ContextManager(path.join(rootDir, 'context'));
    this.commandManager = new CommandManager(path.join(rootDir, 'commands'));
    this.mcpManager = new McpManager(path.join(rootDir, 'mcp-servers'));
    this.configGenerator = new ConfigGenerator(path.join(rootDir, 'mcp-servers'));
    this.clientManager = new ClientManager();
    this.codeExecutionManager = new CodeExecutionManager();
    this.logManager = new LogManager(path.join(rootDir, 'logs'));
    this.secretManager = new SecretManager(rootDir);
    this.proxyManager = new McpProxyManager(this.mcpManager, this.logManager);
    this.memoryManager = new MemoryManager(path.join(rootDir, 'data'));
    this.marketplaceManager = new MarketplaceManager(rootDir);
    this.documentManager = new DocumentManager(path.join(rootDir, 'documents'), this.memoryManager);
    this.profileManager = new ProfileManager(rootDir);

    this.hubServer = new HubServer(
        this.proxyManager,
        this.codeExecutionManager,
        this.agentManager,
        this.skillManager,
        this.promptManager
    );

    this.mcpInterface = new McpInterface(this.hubServer);
    this.agentExecutor = new AgentExecutor(this.proxyManager, this.secretManager);
    this.schedulerManager = new SchedulerManager(rootDir, this.agentExecutor, this.proxyManager);

    this.commandManager.on('updated', (commands) => {
        this.registerCommandsAsTools(commands);
    });

    this.setupRoutes();
    this.setupSocket();
  }

  private registerCommandsAsTools(commands: any[]) {
      commands.forEach(cmd => {
          this.proxyManager.registerInternalTool({
              name: cmd.name,
              description: cmd.description || `Execute command: ${cmd.command}`,
              inputSchema: {
                  type: "object",
                  properties: {},
              }
          }, async () => {
              console.log(`Executing command: ${cmd.name}`);
              return await HookExecutor.executeCommand(cmd.command, cmd.args);
          });
      });
  }

  private setupRoutes() {
    this.app.get('/health', async () => ({ status: 'ok' }));

    // Register Modular Routes
    registerMcpRoutes(this.app, this);
    registerAgentRoutes(this.app, this);

    this.app.setNotFoundHandler((req, res) => {
        if (!req.raw.url?.startsWith('/api')) {
             res.sendFile('index.html');
        } else {
             res.status(404).send({ error: "Not found" });
        }
    });

    // Remaining Routes (can be refactored further later)
    this.app.post('/api/clients/configure', async (request: any, reply) => {
        const { clientName } = request.body;
        const scriptPath = path.resolve(process.argv[1]);
        try {
            const result = await this.clientManager.configureClient(clientName, {
                scriptPath,
                env: { MCP_STDIO_ENABLED: 'true' }
            });
            return result;
        } catch (err: any) {
            return reply.code(500).send({ error: err.message });
        }
    });

    this.app.get('/api/secrets', async () => {
        return { secrets: this.secretManager.getAllSecrets() };
    });

    this.app.post('/api/secrets', async (request: any, reply) => {
        const { key, value } = request.body;
        if (!key || !value) {
            return reply.code(400).send({ error: 'Missing key or value' });
        }
        this.secretManager.setSecret(key, value);
        return { status: 'created' };
    });

    this.app.delete('/api/secrets/:key', async (request: any, reply) => {
        const { key } = request.params;
        this.secretManager.deleteSecret(key);
        return { status: 'deleted' };
    });

    this.app.post('/api/marketplace/refresh', async () => {
        await this.marketplaceManager.refresh();
        return { status: 'ok' };
    });

    this.app.post('/api/marketplace/install', async (request: any, reply) => {
        const { name } = request.body;
        try {
            const result = await this.marketplaceManager.installPackage(name);
            return { result };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.post('/api/profiles/activate', async (request: any, reply) => {
        const { name } = request.body;
        const profile = this.profileManager.activateProfile(name);
        if (profile) {
            return { status: 'activated', profile };
        }
        return reply.code(404).send({ error: "Profile not found" });
    });

    this.app.post('/api/inspector/replay', async (request: any, reply) => {
        const { tool, args, server } = request.body;
        try {
            const result = await this.proxyManager.callTool(tool, args);
            return { result };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.get('/api/hub/sse', async (request: any, reply) => {
        await this.hubServer.handleSSE(request.raw, reply.raw);
        reply.hijack();
    });

    this.app.post('/api/hub/messages', async (request: any, reply) => {
        const sessionId = request.query.sessionId as string;
        await this.hubServer.handleMessage(sessionId, request.body, reply.raw);
        reply.hijack();
    });

    this.app.post('/api/mcp/start', async (request: any, reply) => {
        const { name } = request.body;
        // Let's use the generator to find the config for this specific server
        const allConfigStr = await this.configGenerator.generateConfig('json');
        const allConfig = JSON.parse(allConfigStr);
        const serverConfig = allConfig.mcpServers[name];

        if (!serverConfig) {
            return reply.code(404).send({ error: 'Server configuration not found' });
        }

        try {
            // Inject Secrets
            const secrets = this.secretManager.getEnvVars();
            const env = { ...process.env, ...serverConfig.env, ...secrets };
            serverConfig.env = env;

            await this.mcpManager.startServerSimple(name, serverConfig);
            return { status: 'started' };
        } catch (err: any) {
            return reply.code(500).send({ error: err.message });
        }
    });

    this.app.post('/api/mcp/stop', async (request: any, reply) => {
        const { name } = request.body;
        await this.mcpManager.stopServer(name);
        return { status: 'stopped' };
    });
  }

  private setupSocket() {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected', socket.id);

      socket.emit('state', {
        agents: this.agentManager.getAgents(),
        skills: this.skillManager.getSkills(),
        hooks: this.hookManager.getHooks(),
        prompts: this.promptManager.getPrompts(),
        context: this.contextManager.getContextFiles(),
        mcpServers: this.mcpManager.getAllServers(),
        commands: this.commandManager.getCommands(),
        scheduledTasks: this.schedulerManager.getTasks(),
        marketplace: this.marketplaceManager.getPackages(),
        profiles: this.profileManager.getProfiles()
      });

      socket.on('hook_event', (event: HookEvent) => {
        console.log('Received hook event:', event);
        this.processHook(event);
      });
    });

    this.logManager.on('log', (log) => this.io.emit('traffic_log', log));
    this.agentManager.on('updated', (agents) => this.io.emit('agents_updated', agents));
    this.skillManager.on('updated', (skills) => this.io.emit('skills_updated', skills));
    this.hookManager.on('loaded', (hooks) => this.io.emit('hooks_updated', hooks));
    this.promptManager.on('updated', (prompts) => this.io.emit('prompts_updated', prompts));
    this.contextManager.on('updated', (context) => this.io.emit('context_updated', context));
    this.commandManager.on('updated', (commands) => this.io.emit('commands_updated', commands));
    this.mcpManager.on('updated', (servers) => this.io.emit('mcp_updated', servers));
    this.marketplaceManager.on('updated', (pkgs) => this.io.emit('marketplace_updated', pkgs));
    this.profileManager.on('updated', (profiles) => this.io.emit('profiles_updated', profiles));
  }

  private async processHook(event: HookEvent) {
      const hooks = this.hookManager.getHooks();
      const matched = hooks.filter(h => h.event === event.type);
      
      for (const hook of matched) {
          console.log(`[Core] Triggering hook action for ${event.type}: ${hook.action}`);
          if (hook.type === 'command') {
              try {
                  const output = await HookExecutor.executeCommand(hook.action);
                  this.io.emit('hook_log', { ...event, output });
              } catch (err: any) {
                  console.error(`Error executing hook: ${err.message}`);
              }
          }
      }
  }

  public async start(port = 3000) {
    await this.agentManager.loadAgents();
    await this.skillManager.loadSkills();
    await this.hookManager.loadHooks();
    await this.promptManager.start();
    await this.contextManager.start();
    await this.commandManager.start();
    await this.proxyManager.start();
    this.schedulerManager.start();
    await this.marketplaceManager.refresh();
    await this.documentManager.start();

    if (process.env.MCP_STDIO_ENABLED === 'true') {
        console.error('[Core] Starting MCP Stdio Interface...');
        this.mcpInterface.start();
    }

    this.memoryManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: any) => {
             if (tool.name === 'remember') return this.memoryManager.remember(args);
             if (tool.name === 'search_memory') return this.memoryManager.search(args);
             if (tool.name === 'recall_recent') return this.memoryManager.recall(args);
             return "Unknown tool";
        });
    });

    this.proxyManager.registerInternalTool(FormatTranslatorTool, async (args: any) => {
        const json = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
        return toToon(json);
    });

    this.proxyManager.registerInternalTool({
        name: "install_package",
        description: "Install an Agent or Skill from the Marketplace.",
        inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
    }, async (args: any) => {
        return await this.marketplaceManager.installPackage(args.name);
    });

    this.proxyManager.registerInternalTool({
        name: "improve_prompt",
        description: "Rewrite a prompt using the configured LLM to follow best practices.",
        inputSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] }
    }, async (args: any) => {
        const improverAgent = {
            name: "PromptImprover",
            description: "Expert prompt engineer.",
            instructions: "You are an expert prompt engineer. Rewrite the user's prompt to be clear, specific, and optimized for LLMs. Output ONLY the improved prompt.",
            model: "gpt-4-turbo"
        };
        const result = await this.agentExecutor.run(improverAgent, args.prompt);
        return result;
    });
    
    try {
      await this.app.listen({ port, host: '0.0.0.0' });
      console.log(`Core Service running on port ${port}`);


    } catch (err) {
      this.app.log.error(err);
      process.exit(1);
    }
  }
}
'''

with open('packages/core/src/server.ts', 'w', encoding='utf-8') as f:
    f.write(content)
