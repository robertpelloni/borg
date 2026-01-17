import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { createServer, type Server } from 'node:http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
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
import { DatabaseManager } from './db/DatabaseManager.js';
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
import { GitUndoManager } from './managers/GitUndoManager.js';
import { OidcManager } from './managers/OidcManager.js';
import { ToolAnnotationManager } from './managers/ToolAnnotationManager.js';
import { AuthMiddleware } from './middleware/AuthMiddleware.js';
import { SystemTrayManager } from './managers/SystemTrayManager.js';
import { ConductorManager } from './managers/ConductorManager.js';
import { VibeKanbanManager } from './managers/VibeKanbanManager.js';
import { HardwareManager } from './managers/HardwareManager.js';

import { AutopilotManager } from './managers/AutopilotManager.js';

// Enterprise Services (Phase 13)

import { AuditService } from './services/AuditService.js';
import { RbacService } from './services/RbacService.js';

// Phase 11/12 Routes
import { ArchitectMode } from './agents/ArchitectMode.js';
import { createArchitectRoutes } from './routes/architectRoutesHono.js';
import { createGitWorktreeRoutes } from './routes/gitWorktreeRoutesHono.js';
import { createSupervisorPluginRoutes } from './routes/supervisorPluginRoutesHono.js';
import { createSupervisorAnalyticsRoutes } from './routes/supervisorAnalyticsRoutesHono.js';
import { createDebateTemplateRoutes } from './routes/debateTemplateRoutesHono.js';
import { createInventoryRoutes } from './routes/inventoryRoutesHono.js';
import { createTrafficRoutes } from './routes/trafficRoutesHono.js';
import { createToolRoutes } from './routes/toolRoutesHono.js';

// Phase 13 Routes


import { createRbacRoutes } from './routes/rbacRoutesHono.js';
import { createResourceRoutes } from './routes/resourceRoutesHono.js';
import { ResourceIndexService } from './services/ResourceIndexService.js';

// Legacy Route Imports
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
import { createAnalyticsRoutes } from './routes/analyticsRoutesHono.js';
import { createWorkflowRoutes } from './routes/workflowRoutesHono.js';
import { createSchedulerRoutes } from './routes/schedulerRoutesHono.js';
import { createJulesKeeperRoutes } from './routes/julesKeeperRoutesHono.js';
import { JulesKeeperManager, createNoopJulesClient, type JulesClient } from './managers/JulesKeeperManager.js';
import { JulesApiClient } from './services/JulesApiClient.js';
import { JulesKeeperSettingsStore } from './services/JulesKeeperSettingsStore.js';
import { createLspRoutes } from './routes/lspRoutesHono.js';
import { createSessionShareRoutes } from './routes/sessionShareRoutesHono.js';
import { createGitUndoRoutes } from './routes/gitUndoRoutesHono.js';
import { createFeatureFlagRoutes } from './routes/featureFlagRoutesHono.js';
import { createSecretRoutes } from './routes/secretRoutesHono.js';
import { createQueueRoutes } from './routes/queueRoutesHono.js';
import { createAuditLogRoutes } from './routes/auditLogRoutesHono.js';
import { createRateLimitRoutes } from './routes/rateLimitRoutesHono.js';
import { createIntegrationRoutes } from './routes/integrationRoutesHono.js';
import { createBudgetRoutes } from './routes/budgetRoutesHono.js';
import { createNotificationRoutes } from './routes/notificationRoutesHono.js';
import { createOidcRoutes } from './routes/oidcRoutesHono.js';
import { createToolAnnotationRoutes } from './routes/toolAnnotationRoutesHono.js';

import { IngestionManager } from './managers/IngestionManager.js';
import { TrafficInspectionService } from './services/TrafficInspectionService.js';

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
  private julesKeeperManager!: JulesKeeperManager;
  private gitUndoManager: GitUndoManager;
  private oidcManager: OidcManager;
    private toolAnnotationManager: ToolAnnotationManager;
    private autopilotManager: AutopilotManager;
    
    // Phase 11/12/13

  private architectMode: ArchitectMode;
  private auditService: AuditService;
  private rbacService: RbacService;
  private resourceIndexService: ResourceIndexService;
  private ingestionManager: IngestionManager;

  constructor(
    private rootDir: string
  ) {
    // Enable CORS
    this.app.use('*', cors({ origin: '*' }));

    this.hookManager = new HookManager(path.join(rootDir, 'hooks'));
    this.agentManager = new AgentManager(rootDir);
    this.skillManager = new SkillManager(path.join(rootDir, 'skills'));
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
    this.gitUndoManager = new GitUndoManager({ projectRoot: rootDir });
    this.oidcManager = new OidcManager();
    this.toolAnnotationManager = new ToolAnnotationManager();
    this.toolAnnotationManager.setDatabase(DatabaseManager.getInstance());
    this.systemDoctor = new SystemDoctor();
    this.browserManager = new BrowserManager();
    this.modelGateway = new ModelGateway(this.secretManager);
    this.vectorStore = new VectorStore(this.modelGateway, path.join(rootDir, 'data'));
    this.memoryManager = new MemoryManager(path.join(rootDir, 'data'), this.vectorStore);
    this.systemPromptManager = new SystemPromptManager(rootDir);
    this.contextGenerator = new ContextGenerator(rootDir);
    this.resourceIndexService = new ResourceIndexService(rootDir);
    // this.autopilotManager = new AutopilotManager(this.agentExecutor, this.agentManager); // Moved below AgentExecutor init

    this.handoffManager = new HandoffManager(rootDir, this.memoryManager);
    this.trafficObserver = new TrafficObserver(this.modelGateway, this.memoryManager);
    
    // Initialize Traffic Inspector
    TrafficInspectionService.getInstance(this.logManager);

    this.healthService = new HealthService(this.mcpManager, this.modelGateway);


    this.proxyManager = new McpProxyManager(this.mcpManager, this.logManager);


    this.hubServer = new HubServer(
        this.proxyManager,
        this.codeExecutionManager,
        this.agentManager,
        this.skillManager,
        this.promptManager,
        (endpointPath: string) => this.mcpManager.getEndpointByPath(endpointPath)?.namespaceId
    );

    this.mcpInterface = new McpInterface(this.hubServer);
    this.agentExecutor = new AgentExecutor(this.proxyManager, this.secretManager, this.sessionManager, this.systemPromptManager);
    this.proxyManager.setAgentDependencies(this.agentExecutor, this.agentManager);
    this.proxyManager.setToolAnnotationManager(this.toolAnnotationManager);

    // Ingestion & Document Management (Requires AgentExecutor)
    this.ingestionManager = new IngestionManager(this.memoryManager, this.agentExecutor);
    this.documentManager = new DocumentManager(path.join(rootDir, 'documents'), this.memoryManager, this.ingestionManager);

    this.autopilotManager = new AutopilotManager(this.agentExecutor, this.agentManager);

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

    const julesApiKey = this.secretManager.getSecret('JULES_API_KEY');

    let julesClient: JulesClient = createNoopJulesClient();
    if (julesApiKey) {
        const api = new JulesApiClient({ apiKey: julesApiKey });
        julesClient = {
            async listSessions() {
                const res = await api.listSessions({ pageSize: 100 });
                return res.sessions as any;
            },
            async approvePlan(sessionId: string) {
                await api.approvePlan(sessionId);
            },
            async interruptSession() {},
            async continueSession() {},
            async sendMessage(sessionId: string, message: string) {
                await api.sendMessage(sessionId, message);
            },
        };
    }

    this.julesKeeperManager = new JulesKeeperManager(julesClient);
    const keeperStore = new JulesKeeperSettingsStore(rootDir);
    this.julesKeeperManager.setConfig(keeperStore.load());
    
    // Enterprise Foundation
    this.auditService = AuditService.getInstance();
    this.rbacService = RbacService.getInstance();

    // Initialize Architect Mode
    this.architectMode = new ArchitectMode({
      reasoningModel: 'o3-mini',
      editingModel: 'gpt-4o',
    });
    this.architectMode.setChatFunction(async (model, messages) => {
      const chatMessages = messages.map(m => ({ 
        role: m.role as 'user' | 'assistant' | 'system', 
        content: m.content 
      }));
      return this.modelGateway.chat(chatMessages, model);
    });

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
    this.app.post('/api/autopilot/tasks', async (c) => {
        const task = await c.req.json();
        this.autopilotManager.addTask(task);
        return c.json({ status: 'queued', taskId: task.id });
    });

    this.app.post('/api/autopilot/start', async (c) => {
        await this.autopilotManager.start();
        return c.json({ status: 'started' });
    });

    this.app.post('/api/autopilot/stop', async (c) => {
        this.autopilotManager.stop();
        return c.json({ status: 'stopped' });
    });

    // Health & System

    this.app.get('/health', (c) => c.json(this.healthService.getSystemStatus()));
    this.app.get('/api/doctor', async (c) => c.json(await this.systemDoctor.checkAll()));

    // Original Routes
    this.app.route('/api/council', createCouncilRoutes());
    this.app.route('/api/autopilot', createAutopilotRoutes());
    this.app.route('/api/skills', createSkillRoutes(this.skillManager));
    this.app.route('/api/memory', createMemoryRoutes(this.memoryManager));
    this.app.route('/api/orchestration', createOrchestrationRoutes());
    this.app.route('/api/toolsets', createToolSetRoutes());
    this.app.route('/api/cliproxy', createCLIProxyRoutes());
    this.app.route('/api/profiles', createProfileRoutes());
    this.app.route('/api/llm', createLLMGatewayRoutes(this.secretManager));
    this.app.route('/api/templates', createAgentTemplateRoutes());
    this.app.route('/api/analytics', createAnalyticsRoutes());
    this.app.route('/api/workflows', createWorkflowRoutes());
    this.app.route('/api/scheduler', createSchedulerRoutes(this.schedulerManager));
    this.app.route('/api/lsp', createLspRoutes());
    this.app.route('/api/sessions/share', createSessionShareRoutes(this.sessionManager));
    this.app.route('/api/git-undo', createGitUndoRoutes(this.gitUndoManager));
    this.app.route('/api/inventory', createInventoryRoutes());
    this.app.route('/api/traffic', createTrafficRoutes());
    // @ts-ignore - Accessing private property for route creation
    this.app.route('/api/tools', createToolRoutes(this.proxyManager['searchService']));
    this.app.route('/api/feature-flags', createFeatureFlagRoutes());

    
    // Permission Protected Routes
    this.app.use('/api/secrets/*', this.authMiddleware.requirePermission('secrets:manage'));
    this.app.route('/api/secrets', createSecretRoutes());
    
    this.app.route('/api/queues', createQueueRoutes());
    
    this.app.use('/api/audit-logs/*', this.authMiddleware.requirePermission('audit:read'));
    this.app.route('/api/audit-logs', createAuditLogRoutes());
    
    this.app.route('/api/rate-limits', createRateLimitRoutes());
    this.app.route('/api/integrations', createIntegrationRoutes());
    this.app.route('/api/budgets', createBudgetRoutes());
    this.app.route('/api/notifications', createNotificationRoutes());
    this.app.route('/api/oidc', createOidcRoutes(this.oidcManager));
    this.app.route('/api/tool-annotations', createToolAnnotationRoutes(this.toolAnnotationManager));
    this.app.route('/api/resources', createResourceRoutes(this.resourceIndexService));
    const keeperStore = new JulesKeeperSettingsStore(this.rootDir);
    this.app.route('/api/jules/keeper', createJulesKeeperRoutes(this.julesKeeperManager, keeperStore));


    // Phase 11/12 Routes

    this.app.use('/api/architect/*', this.authMiddleware.requirePermission('architect:session'));
    this.app.route('/api/architect', createArchitectRoutes(this.architectMode));
    
    this.app.route('/api/worktrees', createGitWorktreeRoutes({ baseDir: this.rootDir }));
    
    this.app.use('/api/supervisor-plugins/*', this.authMiddleware.requirePermission('council:manage'));
    this.app.route('/api/supervisor-plugins', createSupervisorPluginRoutes());
    
    this.app.route('/api/supervisor-analytics', createSupervisorAnalyticsRoutes());
    this.app.route('/api/debate-templates', createDebateTemplateRoutes());

    // Phase 13 Enterprise Routes
    this.app.use('/api/rbac/*', this.authMiddleware.requirePermission('system:config'));
    this.app.route('/api/rbac', createRbacRoutes());

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

    this.app.post('/api/agents/run', this.authMiddleware.requirePermission('agent:run'), async (c) => {
        const { agentName, task, sessionId } = await c.req.json();
        const agents = this.agentManager.getAgents();
        const agent = agents.find(a => a.name === agentName);
        if (!agent) return c.json({ error: "Agent not found" }, 404);

        const result = await this.agentExecutor.run(agent, task, {}, sessionId);
        this.auditService.logAgentAction('system', agentName, 'start', { task, sessionId });
        return c.json({ result });
    });

    this.app.post('/api/agents', this.authMiddleware.requirePermission('agent:manage'), async (c) => {
        const { name, description, instructions, model } = await c.req.json();
        if (!name) return c.json({ error: "Name required" }, 400);

        await this.agentManager.saveAgent(name, {
            name, description, instructions, model
        });
        return c.json({ status: 'saved' });
    });

    this.app.post('/api/research', this.authMiddleware.requirePermission('agent:run'), async (c) => {
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

    this.app.get('/api/secrets', this.authMiddleware.requirePermission('secrets:manage'), (c) => {
        return c.json({ secrets: this.secretManager.getAllSecrets() });
    });

    this.app.post('/api/secrets', this.authMiddleware.requirePermission('secrets:manage'), async (c) => {
        const { key, value } = await c.req.json();
        if (!key || !value) {
            return c.json({ error: 'Missing key or value' }, 400);
        }
        this.secretManager.setSecret(key, value);
        return c.json({ status: 'created' });
    });

    this.app.delete('/api/secrets/:key', this.authMiddleware.requirePermission('secrets:manage'), (c) => {
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

        const endpointPath = typeof body?.params?.endpointPath === 'string' ? body.params.endpointPath : undefined;
        if (endpointPath) {
            const endpoint = this.mcpManager.getEndpointByPath(endpointPath);
            if (endpoint?.apiKeyId) {
                const apiKey = c.req.header('X-API-Key');
                if (!apiKey) {
                    return c.json({ error: 'X-API-Key required' }, 401);
                }

                let valid = false;
                try {
                    const db = DatabaseManager.getInstance();
                    const validated = db.validateApiKey(apiKey);
                    valid = Boolean(validated && validated.id === endpoint.apiKeyId);
                } catch {
                    valid = false;
                }

                if (!valid) {
                    return c.json({ error: 'Invalid API key' }, 403);
                }
            }
        }

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

    // this.app.get('/api/resources', (c) => {
    //     return c.json({ resources: this.resourceIndexService.getResources() });
    // });

    // this.app.get('/api/resources/:id', (c) => {
    //     const id = c.req.param('id');
    //     const resource = this.resourceIndexService.getResourceById(id);
    //     if (!resource) return c.json({ error: 'Resource not found' }, 404);
    //     return c.json({ resource });
    // });

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

    // ArchitectMode Event Bridging
    this.architectMode.on('sessionStarted', (data) => {
        this.io.emit('architect_session_started', data);
        this.auditService.logArchitectAction('system', data.sessionId, 'start');
    });
    this.architectMode.on('reasoningComplete', (data) => this.io.emit('architect_reasoning_complete', data));
    this.architectMode.on('planCreated', (data) => this.io.emit('architect_plan_created', data));
    this.architectMode.on('planApproved', (data) => {
        this.io.emit('architect_plan_approved', data);
        this.auditService.logArchitectAction('system', data.sessionId, 'approve');
    });
    this.architectMode.on('editingStarted', (data) => this.io.emit('architect_editing_started', data));
    this.architectMode.on('fileEdited', (data) => this.io.emit('architect_file_edited', data));
    this.architectMode.on('editingComplete', (data) => this.io.emit('architect_editing_complete', data));
    this.architectMode.on('planRevised', (data) => this.io.emit('architect_plan_revised', data));
    this.architectMode.on('planRejected', (data) => this.io.emit('architect_plan_rejected', data));
    this.architectMode.on('error', (data) => this.io.emit('architect_error', data));
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
