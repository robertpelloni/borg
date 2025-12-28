import Fastify from 'fastify';
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
import { PipelineTool, executePipeline } from './tools/PipelineTool.js';
import { ModelGateway } from './gateway/ModelGateway.js';
import { AgentExecutor } from './agents/AgentExecutor.js';
import { ContextGenerator } from './utils/ContextGenerator.js';
import { SubmoduleManager } from './managers/SubmoduleManager.js';
import { VSCodeManager } from './managers/VSCodeManager.js';
import { LoopManager } from './agents/LoopManager.js';
import fs from 'fs';

export class CoreService {
  private app = Fastify({ logger: true });
  private io: SocketIOServer;
  
  private hookManager: HookManager;
  private agentManager: AgentManager;
  private skillManager: SkillManager;
  private promptManager: PromptManager;
  private contextManager: ContextManager;
  private commandManager: CommandManager;
  private mcpManager: McpManager;
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

  constructor(
    private rootDir: string
  ) {
    this.io = new SocketIOServer(this.app.server, {
      cors: { origin: "*" }
    });

    // Enable CORS for API routes
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

    this.proxyManager = new McpProxyManager(this.mcpManager, this.logManager, this.vectorStore);

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
    this.submoduleManager = new SubmoduleManager();
    this.vscodeManager = new VSCodeManager();
    this.loopManager = new LoopManager(this.schedulerManager);

    this.commandManager.on('updated', (commands) => {
        this.registerCommandsAsTools(commands);
    });

    this.healthService.on('clientsUpdated', (clients) => {
        this.io.emit('health_updated', this.healthService.getSystemStatus());
    });

    // Hook Trigger Wiring
    this.proxyManager.on('pre_tool_call', (data) => {
        this.processHook({ type: 'PreToolUse', ...data });
    });

    this.proxyManager.on('post_tool_call', (data) => {
        this.processHook({ type: 'PostToolUse', ...data });
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
    this.app.get('/health', async () => this.healthService.getSystemStatus());
    this.app.get('/api/doctor', async () => this.systemDoctor.checkAll());

    this.app.get('/api/system', async () => {
        const versionPath = path.join(this.rootDir, '../..', 'VERSION');
        const version = fs.existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf-8').trim() : 'unknown';
        return {
            version,
            submodules: this.submoduleManager.getSubmodules()
        };
    });

    this.app.get('/api/clients', async () => ({ clients: this.clientManager.getClients() }));

    // Handoff Routes
    this.app.post('/api/handoff', async (req: any) => {
        const { description, context } = req.body;
        const id = await this.handoffManager.createHandoff(description, context);
        return { id };
    });

    this.app.get('/api/handoff', async () => ({ handoffs: this.handoffManager.getHandoffs() }));

    // Session Routes
    this.app.get('/api/sessions', async () => ({ sessions: this.sessionManager.listSessions() }));
    this.app.get('/api/sessions/:id', async (req: any) => ({ session: this.sessionManager.loadSession(req.params.id) }));

    this.app.post('/api/inspector/replay', async (request: any, reply) => {
        const { tool, args } = request.body;
        try {
            const result = await this.proxyManager.callTool(tool, args);
            return { result };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.setNotFoundHandler((req, res) => {
        if (!req.raw.url?.startsWith('/api')) {
             res.sendFile('index.html');
        } else {
             res.status(404).send({ error: "Not found" });
        }
    });

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

    this.app.post('/api/code/run', async (request: any, reply) => {
        const { code } = request.body;
        try {
            const result = await this.codeExecutionManager.execute(code, async (name, args) => {
                return await this.proxyManager.callTool(name, args);
            });
            return { result };
        } catch (err: any) {
            return reply.code(500).send({ error: err.message });
        }
    });

    this.app.post('/api/agents/run', async (request: any, reply) => {
        const { agentName, task, sessionId } = request.body;
        const agents = this.agentManager.getAgents();
        const agent = agents.find(a => a.name === agentName);
        if (!agent) return reply.code(404).send({ error: "Agent not found" });

        const result = await this.agentExecutor.run(agent, task, {}, sessionId);
        return { result };
    });

    this.app.post('/api/agents', async (request: any, reply) => {
        const { name, description, instructions, model } = request.body;
        if (!name) return reply.code(400).send({ error: "Name required" });

        await this.agentManager.saveAgent(name, {
            name, description, instructions, model
        });
        return { status: 'saved' };
    });

    this.app.get('/api/state', async () => ({
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

    this.app.get('/api/config/mcp/:format', async (request: any, reply) => {
        const { format } = request.params as any;
        if (['json', 'toml', 'xml'].includes(format)) {
            return this.configGenerator.generateConfig(format as any);
        }
        reply.code(400).send({ error: 'Invalid format' });
    });

    this.app.post('/api/mcp/start', async (request: any, reply) => {
        const { name } = request.body;
        const allConfigStr = await this.configGenerator.generateConfig('json');
        const allConfig = JSON.parse(allConfigStr);
        const serverConfig = allConfig.mcpServers[name];

        if (!serverConfig) {
            return reply.code(404).send({ error: 'Server configuration not found' });
        }

        try {
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

    // System Prompt API
    this.app.get('/api/system/prompt', async () => ({ content: this.systemPromptManager.getPrompt() }));
    this.app.post('/api/system/prompt', async (req: any) => {
        this.systemPromptManager.save(req.body.content);
        return { status: 'saved' };
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

    // --- Profile Routes ---
    this.app.get('/api/profiles', async () => {
        return {
            profiles: this.profileManager.getProfiles(),
            active: this.profileManager.getActiveProfile()
        };
    });

    this.app.post('/api/profiles', async (request: any, reply) => {
        const { name, description, config } = request.body;
        if (!name) return reply.code(400).send({ error: "Name required" });
        this.profileManager.createProfile(name, { description, config });
        return { status: 'created' };
    });

    this.app.post('/api/profiles/switch', async (request: any, reply) => {
        const { name } = request.body;
        this.profileManager.setActiveProfile(name);
        return { status: 'switched', active: name };
    });

    // --- Submodules Route ---
    this.app.get('/api/submodules', async () => {
        return { submodules: this.submoduleManager.getSubmodules() };
    });
  }

  private setupSocket() {
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
        this.processHook(event);
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

  private async processHook(event: any) {
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

    this.browserManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: any) => {
             if (tool.name === 'read_active_tab') return this.browserManager.readActiveTab();
             if (tool.name === 'browser_navigate') return this.browserManager.navigate(args.url);
             if (tool.name === 'inject_context') return this.browserManager.injectContext(args.text);
             return "Unknown tool";
        });
    });

    this.vscodeManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: any) => {
             if (tool.name === 'vscode_open_file') return this.vscodeManager.openFile(args.path);
             if (tool.name === 'vscode_get_active_file') return this.vscodeManager.getActiveFile();
             if (tool.name === 'vscode_insert_text') return this.vscodeManager.insertText(args.text);
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
    }, async (args: any) => {
        const id = await this.handoffManager.createHandoff(args.description, { note: args.note });
        return `Handoff created with ID: ${id}`;
    });

    // Register Pipeline Tool
    this.proxyManager.registerInternalTool(PipelineTool, async (args: any) => {
        return await executePipeline(this.proxyManager, args.steps, args.initialContext);
    });

    const promptImprover = createPromptImprover(this.modelGateway);
    this.proxyManager.registerInternalTool(promptImprover, promptImprover.handler);

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
    }, async (args: any) => {
        const agent = this.agentManager.getAgents().find(a => a.name === args.agentName);
        if (!agent) throw new Error(`Agent ${args.agentName} not found.`);
        return await this.agentExecutor.run(agent, args.task, {}, `sub-${Date.now()}`);
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
    }, async (args: any) => {
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
    }, async (args: any) => {
        return await this.marketplaceManager.installPackage(args.name);
    });

    this.loopManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: any) => {
             if (tool.name === 'create_loop') return this.loopManager.createLoop(args.name, args.agentName, args.task, args.cron);
             if (tool.name === 'stop_loop') return this.loopManager.stopLoop(args.loopId);
             return "Unknown tool";
        });
    });
    
    try {
      await this.app.listen({ port, host: '0.0.0.0' });
      console.log(`[Core] Server listening on port ${port}`);
    } catch (err) {
      this.app.log.error(err);
      process.exit(1);
    }
  }
}
