import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { createServer, type Server } from 'node:http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { HookManager } from './managers/HookManager.js';
import { AgentManager } from './managers/AgentManager.js';
import { SkillManager } from './managers/SkillManager.js';
import { PromptManager } from './managers/PromptManager.js';
import { ContextManager } from './managers/ContextManager.js';
import { McpManager } from './managers/McpManager.js';
import { McpClientManager } from './managers/McpClientManager.js';
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
import { HandoffManager } from './managers/HandoffManager.js';
import { SessionManager } from './managers/SessionManager.js';
import { HealthService } from './services/HealthService.js';
import { SystemDoctor } from './services/SystemDoctor.js';
import { BrowserManager } from './managers/BrowserManager.js';
import { TrafficObserver } from './services/TrafficObserver.js';
import { VectorStore } from './services/VectorStore.js';
import { SystemPromptManager } from './managers/SystemPromptManager.js';
import { PipelineTool, executePipeline } from './tools/PipelineTool.js';
import { createPromptImprover } from './tools/PromptImprover.js';
import { toToon, FormatTranslatorTool } from './utils/toon.js';
import { ModelGateway } from './gateway/ModelGateway.js';
import { ContextGenerator } from './utils/ContextGenerator.js';
import { SubmoduleManager } from './managers/SubmoduleManager.js';
import { VSCodeManager } from './managers/VSCodeManager.js';
import { LoopManager } from './agents/LoopManager.js';
import { WebSearchTool } from './tools/WebSearchTool.js';
import { EconomyManager } from './managers/EconomyManager.js';
import { NodeManager } from './managers/NodeManager.js';
import { createCouncilRoutes } from './routes/councilRoutes.js';
import { createAutopilotRoutes } from './routes/autopilotRoutes.js';
import { createSkillRoutes } from './routes/skillRoutes.js';
import { createMemoryRoutes } from './routes/memoryRoutesHono.js';
import { createOrchestrationRoutes } from './routes/orchestrationRoutesHono.js';
import { createToolSetRoutes } from './routes/toolSetRoutesHono.js';
import { createCLIProxyRoutes } from './routes/cliProxyRoutesHono.js';
import { createProfileRoutes } from './routes/profileRoutesHono.js';
import { createLLMGatewayRoutes } from './routes/llmGatewayRoutesHono.js';
import { createAgentTemplateRoutes } from './routes/agentTemplateRoutesHono.js';
import { cliRegistry, cliSessionManager, smartPilotManager, vetoManager, debateHistoryManager, dynamicSelectionManager } from './managers/autopilot/index.js';
import { LLMProviderRegistry, getLLMProviderRegistry } from './providers/LLMProviderRegistry.js';
import { AuthMiddleware } from './middleware/AuthMiddleware.js';
import { SystemTrayManager } from './managers/SystemTrayManager.js';
import { ConductorManager } from './managers/ConductorManager.js';
import { VibeKanbanManager } from './managers/VibeKanbanManager.js';
import { HardwareManager } from './managers/HardwareManager.js';
import fs from 'fs';

export class CoreService {
  private app = new Hono();
  private io!: SocketIOServer;
  private httpServer!: ReturnType<typeof createServer>;
  
  private hookManager: HookManager;
  public agentManager: AgentManager;
  private skillManager: SkillManager;
  private promptManager: PromptManager;
  private contextManager: ContextManager;
  private commandManager: CommandManager;
  private mcpManager: McpManager;
  private mcpClientManager: McpClientManager;
  private configGenerator: ConfigGenerator;
  private mcpInterface: McpInterface;
  private clientManager: ClientManager;
  private codeExecutionManager: CodeExecutionManager;
  private proxyManager: McpProxyManager;
  private logManager: LogManager;
  private secretManager: SecretManager;
  private hubServer: HubServer;
  private agentExecutor: AgentExecutor;
  private memoryManager: MemoryManager;
  private schedulerManager: SchedulerManager;
  private marketplaceManager: MarketplaceManager;
  private documentManager: DocumentManager;
  private profileManager: ProfileManager;
  private handoffManager: HandoffManager;
  private sessionManager: SessionManager;
  private healthService: HealthService;
  private systemDoctor: SystemDoctor;
  private browserManager: BrowserManager;
  private trafficObserver: TrafficObserver;
  private vectorStore: VectorStore;
  private modelGateway: ModelGateway;
  private systemPromptManager: SystemPromptManager;
  private contextGenerator: ContextGenerator;
  private submoduleManager: SubmoduleManager;
  private vscodeManager: VSCodeManager;
  private loopManager: LoopManager;
  private economyManager: EconomyManager;
  private nodeManager: NodeManager;
  private authMiddleware: AuthMiddleware;
  private systemTrayManager: SystemTrayManager;
private conductorManager: ConductorManager;
  private vibeKanbanManager: VibeKanbanManager;
  private hardwareManager: HardwareManager;

  constructor(
    private rootDir: string
  ) {
    // Enable CORS
    this.app.use('*', cors({ origin: '*' }));

    this.hookManager = new HookManager(path.join(rootDir, 'hooks'));
    this.agentManager = new AgentManager(rootDir);
    this.skillManager = new SkillManager();
    this.promptManager = new PromptManager(path.join(rootDir, 'prompts'));
    this.contextManager = new ContextManager(path.join(rootDir, 'context'));
    this.commandManager = new CommandManager(path.join(rootDir, 'commands'));
    this.mcpManager = new McpManager(path.join(rootDir, 'mcp-servers'));
    this.mcpClientManager = new McpClientManager();
    this.configGenerator = new ConfigGenerator(path.join(rootDir, 'mcp-servers'), rootDir);
    this.clientManager = new ClientManager();
    this.codeExecutionManager = new CodeExecutionManager();
    this.logManager = new LogManager(path.join(rootDir, 'logs'));
    this.secretManager = new SecretManager(rootDir);
    this.marketplaceManager = new MarketplaceManager(rootDir);
    this.profileManager = new ProfileManager(rootDir);
    this.sessionManager = new SessionManager(rootDir);
    this.systemDoctor = new SystemDoctor();
    this.browserManager = new BrowserManager();
    this.modelGateway = new ModelGateway(this.secretManager);
    this.vectorStore = new VectorStore(this.modelGateway, path.join(rootDir, 'data'));
    this.memoryManager = new MemoryManager(path.join(rootDir, 'data'), this.vectorStore);
    this.systemPromptManager = new SystemPromptManager(rootDir);
    this.contextGenerator = new ContextGenerator(rootDir);

    this.documentManager = new DocumentManager(path.join(rootDir, 'documents'), this.memoryManager);
    this.handoffManager = new HandoffManager(rootDir, this.memoryManager);
    this.trafficObserver = new TrafficObserver(this.modelGateway, this.memoryManager);

    this.healthService = new HealthService(this.mcpManager, this.modelGateway);

    this.proxyManager = new McpProxyManager(this.mcpManager, this.logManager);

    this.hubServer = new HubServer(
        this.proxyManager,
        this.codeExecutionManager,
        this.agentManager,
        this.skillManager,
        this.promptManager
    );

    this.mcpInterface = new McpInterface(this.hubServer);
    this.agentExecutor = new AgentExecutor(this.proxyManager, this.secretManager, this.sessionManager, this.systemPromptManager);
    this.schedulerManager = new SchedulerManager(rootDir, this.agentExecutor, this.proxyManager);
    this.submoduleManager = new SubmoduleManager();
    this.vscodeManager = new VSCodeManager();
    this.loopManager = new LoopManager(this.schedulerManager);
    this.economyManager = new EconomyManager();
    this.nodeManager = new NodeManager();
    this.authMiddleware = new AuthMiddleware(this.secretManager);
    this.systemTrayManager = new SystemTrayManager(
        this.healthService,
        this.agentManager,
        this.mcpManager,
        this.rootDir
    );
this.conductorManager = new ConductorManager(rootDir);
    this.vibeKanbanManager = new VibeKanbanManager(rootDir);
    this.hardwareManager = HardwareManager.getInstance();

    this.commandManager.on('updated', (commands) => {
        this.registerCommandsAsTools(commands);
    });

    this.healthService.on('clientsUpdated', () => {
        this.io?.emit('health_updated', this.healthService.getSystemStatus());
    });

    // Hook Trigger Wiring
    this.proxyManager.on('pre_tool_call', (data) => {
        this.processHook({ type: 'PreToolUse', ...data });
    });

    this.proxyManager.on('post_tool_call', (data) => {
        this.processHook({ type: 'PostToolUse', ...data });
    });

    this.setupAuth();
    this.setupRoutes();
  }

  private setupAuth() {
      // Auth middleware for API routes
      this.app.use('/api/*', async (c, next) => {
          const url = new URL(c.req.url);
          // Skip auth for health/public endpoints
          if (url.pathname === '/health' || url.pathname === '/api/doctor') {
              return next();
          }
          // Verify auth
          const authResult = await this.authMiddleware.verifyHono(c);
          if (!authResult.valid) {
              return c.json({ error: 'Unauthorized' }, 401);
          }
          return next();
      });
  }

  private registerCommandsAsTools(commands: unknown[]) {
      (commands as Array<{ name: string; description?: string; command: string; args?: string[] }>).forEach(cmd => {
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
    // Health & System
    this.app.get('/health', (c) => c.json(this.healthService.getSystemStatus()));
    this.app.get('/api/doctor', async (c) => c.json(await this.systemDoctor.checkAll()));

    // Council Routes (Multi-LLM debate/voting)
    this.app.route('/api/council', createCouncilRoutes());

    // Autopilot Routes (CLI sessions, smart pilot, veto, debate history)
    this.app.route('/api/autopilot', createAutopilotRoutes());

    // Skill Routes (462 vibeship skills + local skills)
    this.app.route('/api/skills', createSkillRoutes(this.skillManager));

    // Memory Routes (includes vibememo semantic memory)
    this.app.route('/api/memory', createMemoryRoutes(this.memoryManager));

    // Orchestration Routes (debates, code review, memory compaction, providers)
    this.app.route('/api/orchestration', createOrchestrationRoutes());

    // Tool Set Routes (tool collections)
    this.app.route('/api/toolsets', createToolSetRoutes());

    // CLI Proxy Routes (OAuth account management for AI providers)
    this.app.route('/api/cliproxy', createCLIProxyRoutes());

    // Unified Profile Routes (accounts, API profiles, CLI proxy variants)
    this.app.route('/api/profiles', createProfileRoutes());

    // LLM Gateway Routes (unified multi-provider LLM access)
    this.app.route('/api/llm', createLLMGatewayRoutes(this.secretManager));

    // Agent Template Routes (pre-configured agent templates)
    this.app.route('/api/templates', createAgentTemplateRoutes());

    this.app.get('/api/system', (c) => {
        const versionPath = path.join(this.rootDir, '../..', 'VERSION');
        const version = fs.existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf-8').trim() : 'unknown';
        return c.json({
            version,
            submodules: this.submoduleManager.getSubmodules()
        });
    });

    this.app.get('/api/clients', (c) => c.json({ clients: this.clientManager.getClients() }));

    // Handoff Routes
    this.app.post('/api/handoff', async (c) => {
        const { description, context } = await c.req.json();
        const id = await this.handoffManager.createHandoff(description, context);
        return c.json({ id });
    });

    this.app.get('/api/handoff', (c) => c.json({ handoffs: this.handoffManager.getHandoffs() }));

    // Session Routes
    this.app.get('/api/sessions', (c) => c.json({ sessions: this.sessionManager.listSessions() }));
    this.app.get('/api/sessions/:id', (c) => {
        const id = c.req.param('id');
        return c.json({ session: this.sessionManager.loadSession(id) });
    });

    this.app.post('/api/inspector/replay', async (c) => {
        const { tool, args } = await c.req.json();
        try {
            const result = await this.proxyManager.callTool(tool, args);
            return c.json({ result });
        } catch (e: unknown) {
            return c.json({ error: (e as Error).message }, 500);
        }
    });

    this.app.post('/api/clients/configure', async (c) => {
        const { clientName } = await c.req.json();
        const scriptPath = path.resolve(process.argv[1]);
        try {
            const result = await this.clientManager.configureClient(clientName, {
                scriptPath,
                env: { MCP_STDIO_ENABLED: 'true' }
            });
            return c.json(result);
        } catch (err: unknown) {
            return c.json({ error: (err as Error).message }, 500);
        }
    });

    this.app.post('/api/code/run', async (c) => {
        const { code } = await c.req.json();
        try {
            const result = await this.codeExecutionManager.execute(code, async (name, args) => {
                return await this.proxyManager.callTool(name, args);
            });
            return c.json({ result });
        } catch (err: unknown) {
            return c.json({ error: (err as Error).message }, 500);
        }
    });

    this.app.post('/api/agents/run', async (c) => {
        const { agentName, task, sessionId } = await c.req.json();
        const agents = this.agentManager.getAgents();
        const agent = agents.find(a => a.name === agentName);
        if (!agent) return c.json({ error: "Agent not found" }, 404);

        const result = await this.agentExecutor.run(agent, task, {}, sessionId);
        return c.json({ result });
    });

    this.app.post('/api/agents', async (c) => {
        const { name, description, instructions, model } = await c.req.json();
        if (!name) return c.json({ error: "Name required" }, 400);

        await this.agentManager.saveAgent(name, {
            name, description, instructions, model
        });
        return c.json({ status: 'saved' });
    });

    this.app.post('/api/research', async (c) => {
        const { topic } = await c.req.json();
        if (!topic) return c.json({ error: "Topic required" }, 400);

        const agent = this.agentManager.getAgents().find(a => a.name === 'researcher');
        if (!agent) return c.json({ error: "Research agent not found" }, 404);

        const sessionId = `research-${Date.now()}`;
        // Run asynchronously
        this.agentExecutor.run(agent, `Research this topic: ${topic}`, {}, sessionId)
            .then(result => {
                console.log(`[Research] Completed for ${topic}`);
                this.io?.emit('research_update', { sessionId, status: 'completed', message: 'Research finished.', result });
            })
            .catch((err: Error) => {
                console.error(`[Research] Failed: ${err.message}`);
                this.io?.emit('research_update', { sessionId, status: 'error', message: err.message });
            });

        return c.json({ status: 'started', sessionId });
    });

    this.app.get('/api/state', (c) => c.json({
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
    }));

    this.app.get('/api/config/mcp/:format', async (c) => {
        const format = c.req.param('format');
        if (['json', 'toml', 'xml'].includes(format)) {
            return c.json(await this.configGenerator.generateConfig(format as 'json' | 'toml' | 'xml'));
        }
        return c.json({ error: 'Invalid format' }, 400);
    });

    this.app.post('/api/mcp/start', async (c) => {
        const { name } = await c.req.json();
        const allConfigStr = await this.configGenerator.generateConfig('json');
        const allConfig = JSON.parse(allConfigStr);
        const serverConfig = allConfig.mcpServers[name];

        if (!serverConfig) {
            return c.json({ error: 'Server configuration not found' }, 404);
        }

        try {
            const secrets = this.secretManager.getEnvVars();
            const env = { ...process.env, ...serverConfig.env, ...secrets };
            serverConfig.env = env;

            await this.mcpManager.startServerSimple(name, serverConfig);
            return c.json({ status: 'started' });
        } catch (err: unknown) {
            return c.json({ error: (err as Error).message }, 500);
        }
    });

    this.app.post('/api/mcp/stop', async (c) => {
        const { name } = await c.req.json();
        await this.mcpManager.stopServer(name);
        return c.json({ status: 'stopped' });
    });

    // --- McpClientManager Routes (Persistent Sessions) ---
    this.app.get('/api/mcp-client/sessions', async (c) => {
        return c.json({ sessions: await this.mcpClientManager.listSessions() });
    });

    this.app.get('/api/mcp-client/sessions/:name', async (c) => {
        const name = c.req.param('name');
        const session = await this.mcpClientManager.getSession(name);
        if (!session) return c.json({ error: "Session not found" }, 404);
        return c.json({ session });
    });

    this.app.post('/api/mcp-client/sessions/start', async (c) => {
        const { name, config, options } = await c.req.json();
        if (!name || !config) return c.json({ error: "Name and config required" }, 400);
        try {
            await this.mcpClientManager.startSession(name, config, options);
            return c.json({ status: 'started', name });
        } catch (e: unknown) {
            return c.json({ error: (e as Error).message }, 500);
        }
    });

    this.app.post('/api/mcp-client/sessions/stop', async (c) => {
        const { name } = await c.req.json();
        await this.mcpClientManager.deleteSession(name);
        return c.json({ status: 'stopped' });
    });

    this.app.get('/api/mcp-client/sessions/:name/tools', async (c) => {
        const name = c.req.param('name');
        try {
            const tools = await this.mcpClientManager.listTools(name);
            return c.json({ tools });
        } catch (e: unknown) {
            return c.json({ error: (e as Error).message }, 500);
        }
    });

    this.app.post('/api/mcp-client/sessions/:name/call', async (c) => {
        const name = c.req.param('name');
        const { tool, args } = await c.req.json();
        try {
            const result = await this.mcpClientManager.callTool(name, tool, args);
            return c.json({ result });
        } catch (e: unknown) {
            return c.json({ error: (e as Error).message }, 500);
        }
    });
    
    this.app.get('/api/mcp-client/profiles', async (c) => {
        return c.json({ profiles: await this.mcpClientManager.listAuthProfiles() });
    });

    this.app.get('/api/secrets', (c) => {
        return c.json({ secrets: this.secretManager.getAllSecrets() });
    });

    this.app.post('/api/secrets', async (c) => {
        const { key, value } = await c.req.json();
        if (!key || !value) {
            return c.json({ error: 'Missing key or value' }, 400);
        }
        this.secretManager.setSecret(key, value);
        return c.json({ status: 'created' });
    });

    this.app.delete('/api/secrets/:key', (c) => {
        const key = c.req.param('key');
        this.secretManager.deleteSecret(key);
        return c.json({ status: 'deleted' });
    });

    this.app.post('/api/marketplace/refresh', async (c) => {
        await this.marketplaceManager.refresh();
        return c.json({ status: 'ok' });
    });

    this.app.post('/api/marketplace/install', async (c) => {
        const { name } = await c.req.json();
        try {
            const result = await this.marketplaceManager.installPackage(name);
            return c.json({ result });
        } catch (e: unknown) {
            return c.json({ error: (e as Error).message }, 500);
        }
    });

    // System Prompt API
    this.app.get('/api/system/prompt', (c) => c.json({ content: this.systemPromptManager.getPrompt() }));
    this.app.post('/api/system/prompt', async (c) => {
        const { content } = await c.req.json();
        this.systemPromptManager.save(content);
        return c.json({ status: 'saved' });
    });

    this.app.get('/api/hub/sse', async (c) => {
        const sessionId = Date.now().toString();
        return streamSSE(c, async (stream) => {
            const msg = JSON.stringify({
                event: 'endpoint',
                data: `/api/hub/messages?sessionId=${sessionId}`
            });
            await stream.writeSSE({ event: 'endpoint', data: msg });
            
            const interval = setInterval(async () => {
                await stream.writeSSE({ data: '' });
            }, 15000);
            
            c.req.raw.signal.addEventListener('abort', () => clearInterval(interval));
        });
    });

    this.app.post('/api/hub/messages', async (c) => {
        const sessionId = c.req.query('sessionId') || '';
        const body = await c.req.json();
        const result = await this.hubServer.handleMessage(sessionId, body);
        return c.json(result);
    });

    // --- Profile Routes ---
    this.app.get('/api/profiles', (c) => {
        return c.json({
            profiles: this.profileManager.getProfiles(),
            active: this.profileManager.getActiveProfile()
        });
    });

    this.app.post('/api/profiles', async (c) => {
        const { name, description, config } = await c.req.json();
        if (!name) return c.json({ error: "Name required" }, 400);
        this.profileManager.createProfile(name, { description, config });
        return c.json({ status: 'created' });
    });

    this.app.post('/api/profiles/switch', async (c) => {
        const { name } = await c.req.json();
        this.profileManager.setActiveProfile(name);
        return c.json({ status: 'switched', active: name });
    });

    // --- Submodules Route ---
    this.app.get('/api/submodules', (c) => {
        return c.json({ submodules: this.submoduleManager.getSubmodules() });
    });

    // --- Sessions Routes ---
    this.app.get('/api/sessions', (c) => {
        return c.json({ sessions: this.sessionManager.listSessions() });
    });

    this.app.get('/api/sessions/:id', (c) => {
        const session = this.sessionManager.loadSession(c.req.param('id'));
        if (!session) return c.json({ error: 'Session not found' }, 404);
        return c.json(session);
    });

    this.app.delete('/api/sessions/:id', (c) => {
        const success = this.sessionManager.deleteSession(c.req.param('id'));
        return c.json({ success });
    });

    this.app.post('/api/sessions/:id/resume', async (c) => {
        const session = this.sessionManager.loadSession(c.req.param('id'));
        if (!session) return c.json({ error: 'Session not found' }, 404);
        return c.json({ status: 'resumed', sessionId: session.id });
    });

    // --- Handoffs Routes ---
    this.app.get('/api/handoffs', (c) => {
        return c.json({ handoffs: this.handoffManager.getHandoffs() });
    });

    this.app.post('/api/handoffs', async (c) => {
        const { description, context } = await c.req.json();
        const id = await this.handoffManager.createHandoff(description, context);
        return c.json({ id, status: 'created' });
    });

    this.app.post('/api/handoffs/:id/claim', async (c) => {
        const handoffs = this.handoffManager.getHandoffs();
        const handoff = handoffs.find(h => h.id === c.req.param('id'));
        if (!handoff) return c.json({ error: 'Handoff not found' }, 404);
        handoff.status = 'claimed';
        return c.json({ status: 'claimed', handoff });
    });

    // --- Conductor Routes ---
    this.app.get('/api/conductor/tasks', async (c) => {
        return c.json({ tasks: await this.conductorManager.listTasks() });
    });

    this.app.post('/api/conductor/start', async (c) => {
        const { role } = await c.req.json();
        const result = await this.conductorManager.startTask(role);
        return c.json({ result });
    });

    this.app.get('/api/conductor/status', async (c) => {
        return c.json(await this.conductorManager.getStatus());
    });

    // --- Vibe Kanban Routes ---
    this.app.post('/api/vibekanban/start', async (c) => {
        const { frontendPort, backendPort } = await c.req.json();
        try {
            await this.vibeKanbanManager.start(frontendPort, backendPort);
            return c.json({ status: 'started' });
        } catch (e: unknown) {
            return c.json({ error: (e as Error).message }, 500);
        }
    });

    this.app.post('/api/vibekanban/stop', async (c) => {
        await this.vibeKanbanManager.stop();
        return c.json({ status: 'stopped' });
    });

this.app.get('/api/vibekanban/status', (c) => {
        return c.json(this.vibeKanbanManager.getStatus());
    });

    this.app.get('/api/hardware/ports', async (c) => {
        const ports = await this.hardwareManager.listSerialPorts();
        return c.json({ ports });
    });

    this.app.post('/api/hardware/connect', async (c) => {
        const { path, baudRate } = await c.req.json();
        const success = await this.hardwareManager.connectWearable(path, baudRate || 9600);
        return c.json({ success });
    });

    this.app.post('/api/hardware/disconnect', async (c) => {
        const { path } = await c.req.json();
        this.hardwareManager.disconnectWearable(path);
        return c.json({ success: true });
    });

    this.app.get('/api/hardware/activity', (c) => {
        return c.json(this.hardwareManager.getAggregatedActivity());
    });

    this.app.get('/api/hardware/system', async (c) => {
        const specs = await this.hardwareManager.getSystemSpecs();
        return c.json(specs);
    });

    this.app.get('/api/mining/status', (c) => {
        return c.json(this.hardwareManager.getMiningStatus());
    });

    this.app.post('/api/mining/start', async (c) => {
        await this.hardwareManager.startMining();
        return c.json({ status: 'started' });
    });

    this.app.post('/api/mining/stop', async (c) => {
        await this.hardwareManager.stopMining();
        return c.json({ status: 'stopped' });
    });

    this.app.get('/api/economy/balance', (c) => {
        return c.json(this.economyManager.getBalance());
    });

    // SPA fallback - serve index.html for non-API routes
    this.app.notFound((c) => {
        const url = new URL(c.req.url);
        if (!url.pathname.startsWith('/api')) {
            const indexPath = path.resolve(this.rootDir, '../ui/dist/index.html');
            if (fs.existsSync(indexPath)) {
                return c.html(fs.readFileSync(indexPath, 'utf-8'));
            }
        }
        return c.json({ error: "Not found" }, 404);
    });
  }

  private setupSocket() {
    this.io.use((socket, next) => this.authMiddleware.verifySocket(socket, next));

    this.io.on('connection', (socket: Socket) => {
      const clientType = (socket.handshake.query.clientType as string) || 'unknown';
      this.healthService.registerClient(socket.id, clientType);

      if (clientType === 'browser') {
          this.browserManager.registerClient(socket);
      } else if (clientType === 'vscode') {
          this.vscodeManager.registerClient(socket);
      }

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
        profiles: this.profileManager.getProfiles(),
        health: this.healthService.getSystemStatus()
      });

      socket.on('disconnect', () => {
          this.healthService.unregisterClient(socket.id);
      });

      socket.on('hook_event', (event: HookEvent) => {
        console.log('Received hook event:', event);
        this.processHook(event as unknown as Record<string, unknown>);
      });
    });

    this.logManager.on('log', (log) => {
        this.io.emit('traffic_log', log);
        // Passive Memory
        if (log.type === 'response') {
            this.trafficObserver.observe(log.tool, log.result);
        }
    });
    this.agentManager.on('updated', (agents) => this.io.emit('agents_updated', agents));
    this.skillManager.on('updated', (skills) => this.io.emit('skills_updated', skills));
    this.hookManager.on('loaded', (hooks) => this.io.emit('hooks_updated', hooks));
    this.promptManager.on('updated', (prompts) => this.io.emit('prompts_updated', prompts));
    this.contextManager.on('updated', (context) => this.io.emit('context_updated', context));
    this.commandManager.on('updated', (commands) => this.io.emit('commands_updated', commands));
    this.mcpManager.on('updated', (servers) => this.io.emit('mcp_updated', servers));
    this.marketplaceManager.on('updated', (pkgs) => this.io.emit('marketplace_updated', pkgs));
    this.profileManager.on('profileChanged', (p) => this.io.emit('profile_changed', p));
  }

  private async processHook(event: Record<string, unknown>) {
      const hooks = this.hookManager.getHooks();
      const matched = hooks.filter(h => h.event === event.type);
      
      for (const hook of matched) {
          console.log(`[Core] Triggering hook action for ${event.type}: ${hook.action}`);
          if (hook.type === 'command') {
              try {
                  const output = await HookExecutor.executeCommand(hook.action);
                  this.io?.emit('hook_log', { ...event, output });
              } catch (err: unknown) {
                  console.error(`Error executing hook: ${(err as Error).message}`);
              }
          }
      }
  }

  public async start(port = 3000) {
    this.contextGenerator.generate(); // Generate context on startup
    await this.agentManager.loadAgents();
    await this.skillManager.loadSkills();
    await this.hookManager.loadHooks();
    await this.promptManager.start();
    await this.contextManager.start();
    await this.commandManager.start();
    await this.proxyManager.start();
    this.schedulerManager.start();
    await this.marketplaceManager.refresh();
    this.systemTrayManager.start();
    await this.conductorManager.initialize();

    if (process.env.MCP_STDIO_ENABLED === 'true') {
        console.error('[Core] Starting MCP Stdio Interface...');
        this.mcpInterface.start();
    }

    this.memoryManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: Record<string, unknown>) => {
             if (tool.name === 'remember') return this.memoryManager.remember(args as { content: string; tags?: string[] });
             if (tool.name === 'search_memory') return this.memoryManager.search(args as { query: string });
             if (tool.name === 'recall_recent') return this.memoryManager.recall(args);
             if (tool.name === 'memory_stats') return this.memoryManager.getStats();
             return "Unknown tool";
        });
    });

    this.proxyManager.registerInternalTool(FormatTranslatorTool, async (args: { data: string | object }) => {
        const json = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
        return toToon(json);
    });

    this.browserManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: { url?: string; text?: string }) => {
             if (tool.name === 'read_active_tab') return this.browserManager.readActiveTab();
             if (tool.name === 'browser_navigate') return this.browserManager.navigate(args.url!);
             if (tool.name === 'inject_context') return this.browserManager.injectContext(args.text!);
             return "Unknown tool";
        });
    });

    this.vscodeManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: { path?: string; text?: string }) => {
             if (tool.name === 'vscode_open_file') return this.vscodeManager.openFile(args.path!);
             if (tool.name === 'vscode_get_active_file') return this.vscodeManager.getActiveFile();
             if (tool.name === 'vscode_insert_text') return this.vscodeManager.insertText(args.text!);
             return "Unknown tool";
        });
    });

    // Register Handoff Tool
    this.proxyManager.registerInternalTool({
        name: "save_handoff",
        description: "Save current context for another agent or session.",
        inputSchema: {
            type: "object",
            properties: {
                description: { type: "string" },
                note: { type: "string" }
            },
            required: ["description"]
        }
    }, async (args: { description: string; note?: string }) => {
        const id = await this.handoffManager.createHandoff(args.description, { note: args.note });
        return `Handoff created with ID: ${id}`;
    });

    this.proxyManager.registerInternalTool(PipelineTool, async (args: { steps: unknown[]; initialContext?: unknown }) => {
        return await executePipeline(this.proxyManager, args.steps as Parameters<typeof executePipeline>[1], args.initialContext);
    });

    const promptImprover = createPromptImprover(this.modelGateway);
    this.proxyManager.registerInternalTool(promptImprover, promptImprover.handler);

    // Register Web Search Tool
    this.proxyManager.registerInternalTool(WebSearchTool, WebSearchTool.handler);

    this.economyManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: Record<string, unknown>) => {
             if (tool.name === 'submit_activity') return this.economyManager.mine(args);
             if (tool.name === 'get_balance') return this.economyManager.getBalance();
             return "Unknown tool";
        });
    });

    this.nodeManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: { active?: boolean }) => {
             if (tool.name === 'node_status') return this.nodeManager.getStatus();
             if (tool.name === 'toggle_tor') return this.nodeManager.toggleTor(args.active!);
             if (tool.name === 'toggle_torrent') return this.nodeManager.toggleTorrent(args.active!);
             return "Unknown tool";
        });
    });

    // Register Recursive Agent Tool
    this.proxyManager.registerInternalTool({
        name: "run_subagent",
        description: "Run another agent to perform a sub-task.",
        inputSchema: {
            type: "object",
            properties: {
                agentName: { type: "string" },
                task: { type: "string" }
            },
            required: ["agentName", "task"]
        }
    }, async (args: { agentName: string; task: string }) => {
        const agent = this.agentManager.getAgents().find(a => a.name === args.agentName);
        if (!agent) throw new Error(`Agent ${args.agentName} not found.`);
        return await this.agentExecutor.run(agent, args.task, {}, `sub-${Date.now()}`);
    });

    // Register Natural Language Agent Tool (run_agent)
    // This tool enables agents to perform complex tasks via natural language
    // without pre-defined tools - it generates and executes code dynamically
    this.proxyManager.registerInternalTool({
        name: "run_agent",
        description: "Execute a complex task using natural language. This tool will generate and execute code to accomplish the task. Use for tasks that don't have a dedicated tool available.",
        inputSchema: {
            type: "object",
            properties: {
                task: { 
                    type: "string", 
                    description: "Natural language description of the task to perform" 
                },
                provider: { 
                    type: "string", 
                    description: "LLM provider to use (openai, anthropic, gemini, qwen, deepseek, groq). Defaults to openai.",
                    enum: ["openai", "anthropic", "gemini", "qwen", "deepseek", "groq"]
                },
                model: { 
                    type: "string", 
                    description: "Model to use (e.g., gpt-4o, claude-sonnet-4-20250514). If not specified, uses provider default." 
                },
                context: {
                    type: "object",
                    description: "Optional context data to pass to the task"
                }
            },
            required: ["task"]
        }
    }, async (args: { task: string; provider?: string; model?: string; context?: Record<string, unknown> }) => {
        const providerId = args.provider || 'openai';
        const llmRegistry = getLLMProviderRegistry();
        
        // Get API key from secrets
        const apiKeyMap: Record<string, string> = {
            openai: 'OPENAI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            gemini: 'GOOGLE_AI_API_KEY',
            qwen: 'QWEN_API_KEY',
            deepseek: 'DEEPSEEK_API_KEY',
            groq: 'GROQ_API_KEY'
        };
        
        const apiKey = this.secretManager.getSecret(apiKeyMap[providerId] || 'OPENAI_API_KEY');
        if (!apiKey) {
            throw new Error(`API key not configured for provider ${providerId}. Set ${apiKeyMap[providerId]} in secrets.`);
        }
        
        llmRegistry.setProviderConfig(providerId, { apiKey });
        
        // Get available tools for context
        const availableTools = await this.proxyManager.getAllTools();
        const toolNames = availableTools.slice(0, 50).map((t: { name: string; description?: string }) => 
            `- ${t.name}: ${t.description?.slice(0, 100) || 'No description'}`
        ).join('\n');
        
        const systemPrompt = `You are a code generation assistant. Generate executable TypeScript/JavaScript code to accomplish the user's task.

Available MCP Tools (use via callTool function):
${toolNames}

Context provided:
${args.context ? JSON.stringify(args.context, null, 2) : 'None'}

IMPORTANT RULES:
1. Generate ONLY executable code - no explanations, no markdown code blocks
2. Use async/await for all tool calls
3. The 'callTool' function is available: await callTool(toolName, args)
4. Return results using 'return' statement
5. Handle errors gracefully with try/catch
6. Code should be self-contained and complete

Example:
async function main() {
    const result = await callTool('read_file', { path: '/tmp/test.txt' });
    return result;
}
return await main();`;

        const model = args.model || llmRegistry.getModelForTier(providerId, 'sonnet');
        
        // Generate code using LLM
        const completion = await llmRegistry.complete({
            provider: providerId,
            messages: [{ role: 'user', content: args.task }],
            model,
            apiKey,
            systemPrompt,
            temperature: 0.3,
            maxTokens: 4096
        });
        
        let generatedCode = completion.content;
        
        // Clean up code (remove markdown if present)
        if (generatedCode.includes('```')) {
            const codeMatch = generatedCode.match(/```(?:typescript|javascript|js|ts)?\n?([\s\S]*?)```/);
            if (codeMatch) {
                generatedCode = codeMatch[1];
            }
        }
        generatedCode = generatedCode.trim();
        
        // Execute the generated code
        try {
            const result = await this.codeExecutionManager.execute(generatedCode, async (name, toolArgs) => {
                return await this.proxyManager.callTool(name, toolArgs);
            });
            
            return {
                success: true,
                task: args.task,
                provider: providerId,
                model,
                generatedCode,
                result,
                usage: completion.usage
            };
        } catch (execError: unknown) {
            return {
                success: false,
                task: args.task,
                provider: providerId,
                model,
                generatedCode,
                error: (execError as Error).message,
                usage: completion.usage
            };
        }
    });

    // Register Session Tools
    this.proxyManager.registerInternalTool({
        name: "list_sessions",
        description: "List all saved conversation sessions.",
        inputSchema: { type: "object", properties: {} }
    }, async () => {
        return this.sessionManager.listSessions().map(s => ({ id: s.id, agent: s.agentName, date: new Date(s.timestamp).toLocaleString() }));
    });

    this.proxyManager.registerInternalTool({
        name: "resume_session",
        description: "Resume a specific conversation session.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string" },
                newMessage: { type: "string" }
            },
            required: ["sessionId", "newMessage"]
        }
    }, async (args: { sessionId: string; newMessage: string }) => {
        const session = this.sessionManager.loadSession(args.sessionId);
        if (!session) throw new Error("Session not found");
        const agent = this.agentManager.getAgents().find(a => a.name === session.agentName);
        if (!agent) throw new Error(`Agent ${session.agentName} not found.`);
        return await this.agentExecutor.run(agent, args.newMessage, {}, args.sessionId);
    });

    this.proxyManager.registerInternalTool({
        name: "install_package",
        description: "Install an Agent or Skill from the Marketplace.",
        inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
    }, async (args: { name: string }) => {
        return await this.marketplaceManager.installPackage(args.name);
    });

    this.loopManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: { name?: string; agentName?: string; task?: string; cron?: string; loopId?: string }) => {
             if (tool.name === 'create_loop') return this.loopManager.createLoop(args.name!, args.agentName!, args.task!, args.cron!);
             if (tool.name === 'stop_loop') return this.loopManager.stopLoop(args.loopId!);
             return "Unknown tool";
        });
    });

    // Initialize Autopilot System
    await cliRegistry.detectAll();
    await cliSessionManager.initialize();
    console.log(`[Core] Autopilot system initialized - ${cliRegistry.getAvailableTools().length} CLI tools detected`);
    
    this.httpServer = createServer();
    this.io = new SocketIOServer(this.httpServer, {
        cors: { origin: "*" }
    });
    this.setupSocket();

    serve({ fetch: this.app.fetch, port });

    const socketPort = port + 1;
    this.httpServer.listen(socketPort, () => {
        console.log(`[Core] Socket.io listening on port ${socketPort}`);
    });

    console.log(`[Core] Hono server listening on port ${port}`);
  }
}
