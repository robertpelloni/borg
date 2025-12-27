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
import { ProjectManager } from './managers/ProjectManager.js';
import { AgentMessageBroker } from './managers/AgentMessageBroker.js';
import { AutonomousAgentManager } from './managers/AutonomousAgentManager.js';
import { BrowserManager } from './managers/BrowserManager.js';
import { ContextMiner } from './utils/ContextMiner.js';
import { ContextGenerator } from './utils/ContextGenerator.js';
import { toToon, FormatTranslatorTool } from './utils/toon.js';
import fs from 'fs';
import crypto from 'crypto';
import { registerMcpRoutes } from './routes/mcpRoutes.js';
import { registerAgentRoutes } from './routes/agentRoutes.js';
import { registerRegistryRoutes } from './routes/registryRoutes.js';

export class CoreService {
  public app;
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
  public projectManager: ProjectManager;
  public messageBroker: AgentMessageBroker;
  public autonomousAgentManager: AutonomousAgentManager;
  public browserManager: BrowserManager;
  public contextMiner: ContextMiner;

  constructor(
    private rootDir: string
  ) {
    const isStdio = process.env.MCP_STDIO_ENABLED === 'true';
    this.app = Fastify({ 
        logger: isStdio ? false : true 
    });

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
    // Watch internal context AND current working directory for project-specific context
    this.contextManager = new ContextManager(path.join(rootDir, 'context'), process.cwd());
    this.commandManager = new CommandManager(path.join(rootDir, 'commands'));
    this.mcpManager = new McpManager(path.join(rootDir, 'mcp-servers'));
    this.configGenerator = new ConfigGenerator(path.join(rootDir, 'mcp-servers'));
    this.clientManager = new ClientManager();
    this.codeExecutionManager = new CodeExecutionManager();
    this.logManager = new LogManager(path.join(rootDir, 'logs'));
    this.secretManager = new SecretManager(rootDir);
    this.proxyManager = new McpProxyManager(this.mcpManager, this.logManager);
    this.memoryManager = new MemoryManager(path.join(rootDir, 'data'), this.secretManager);
    this.marketplaceManager = new MarketplaceManager(rootDir);
    this.documentManager = new DocumentManager(path.join(rootDir, 'documents'), this.memoryManager);
    this.profileManager = new ProfileManager(rootDir);
    this.projectManager = new ProjectManager(rootDir);
    this.messageBroker = new AgentMessageBroker();
    this.autonomousAgentManager = new AutonomousAgentManager(
        this.agentManager,
        this.messageBroker,
        this.proxyManager,
        this.logManager,
        this.secretManager
    );
    this.browserManager = new BrowserManager();

    this.hubServer = new HubServer(
        this.proxyManager,
        this.codeExecutionManager,
        this.agentManager,
        this.skillManager,
        this.promptManager
    );

    this.mcpInterface = new McpInterface(this.hubServer);
    this.agentExecutor = new AgentExecutor(this.proxyManager, this.secretManager, this.logManager);
    
    // Re-initialize MemoryManager with AgentExecutor for Context Compaction
    this.memoryManager = new MemoryManager(path.join(rootDir, 'data'), this.secretManager, this.agentExecutor);
    this.memoryManager.setBrowserManager(this.browserManager);
    this.proxyManager.setMemoryManager(this.memoryManager);
    this.messageBroker.setMemoryManager(this.memoryManager);
    
    this.schedulerManager = new SchedulerManager(rootDir, this.agentExecutor, this.proxyManager);
    
    this.contextMiner = new ContextMiner(this.logManager, this.memoryManager, this.agentExecutor);

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
              return await HookExecutor.executeCommand(cmd.command);
          });
      });
  }

  private setupRoutes() {
    this.app.get('/health', async () => ({ status: 'ok' }));

    // Register Modular Routes
    registerMcpRoutes(this.app, this);
    registerAgentRoutes(this.app, this);
    registerRegistryRoutes(this.app, this);

    // Memory Routes
    this.app.get('/api/memory/providers', async () => {
        return { providers: this.memoryManager.getProviders() };
    });

    this.app.get('/api/memory/search', async (request: any, reply) => {
        const { q, provider } = request.query;
        if (!q) {
            return reply.code(400).send({ error: 'Missing query parameter q' });
        }
        try {
            const results = await this.memoryManager.search({ query: q, providerId: provider });
            return { results };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.post('/api/memory', async (request: any, reply) => {
        const { content, tags, provider } = request.body;
        if (!content) {
            return reply.code(400).send({ error: 'Missing content' });
        }
        try {
            const id = await this.memoryManager.remember({ content, tags, providerId: provider });
            return { status: 'created', id };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.post('/api/memory/export', async (request: any, reply) => {
        const { filePath } = request.body;
        if (!filePath) return reply.code(400).send({ error: 'Missing filePath' });
        try {
            const result = await this.memoryManager.exportMemory(filePath);
            return { result };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.post('/api/memory/import', async (request: any, reply) => {
        const { filePath } = request.body;
        if (!filePath) return reply.code(400).send({ error: 'Missing filePath' });
        try {
            const result = await this.memoryManager.importMemory(filePath);
            return { result };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.post('/api/memory/sync/jules', async (request: any, reply) => {
        try {
            const result = await this.memoryManager.syncJulesSessions();
            return { result };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.post('/api/memory/ingest/browser', async (request: any, reply) => {
        try {
            const content = await this.browserManager.getActiveTabContent();
            const result = await this.memoryManager.ingestSession("Browser Page", content);
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

    this.app.get('/api/logs', async (request: any, reply) => {
        const limit = request.query.limit ? parseInt(request.query.limit) : 100;
        const summary = request.query.summary === 'true';
        return await this.logManager.getLogs({ limit, summary });
    });

    this.app.get('/api/logs/:id', async (request: any, reply) => {
        const { id } = request.params;
        const log = await this.logManager.getLogById(id);
        if (!log) return reply.code(404).send({ error: 'Log not found' });
        return log;
    });

    this.app.get('/api/project/structure', async () => {
        return {
            structure: this.projectManager.getStructure(),
            submodules: await this.projectManager.getSubmodules()
        };
    });

    this.app.get('/api/hub/sse', async (request: any, reply) => {
        await this.hubServer.handleSSE(request.raw, reply.raw);
        reply.hijack();
    });

    // Autonomous Agent Control
    this.app.post('/api/agents/:id/start', async (request: any, reply) => {
        const { id } = request.params;
        try {
            await this.autonomousAgentManager.startAgent(id);
            return { status: 'started', id };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    this.app.post('/api/agents/:id/stop', async (request: any, reply) => {
        const { id } = request.params;
        this.autonomousAgentManager.stopAgent(id);
        return { status: 'stopped', id };
    });

    this.app.get('/api/agents/running', async () => {
        return { agents: this.autonomousAgentManager.getRunningAgents() };
    });

    this.app.post('/api/hub/messages', async (request: any, reply) => {
        const sessionId = request.query.sessionId as string;
        await this.hubServer.handleMessage(sessionId, request.body, reply.raw);
        reply.hijack();
    });

    /*
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
    */
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

      socket.on('register_browser', (data: any) => {
          this.browserManager.registerBrowser(socket);
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
    await this.agentManager.start();
    await this.skillManager.start();
    await this.hookManager.start();
    await this.promptManager.start();
    await this.contextManager.start();
    await this.commandManager.start();
    await this.proxyManager.start();
    this.schedulerManager.start();
    await this.marketplaceManager.refresh();
    // await this.documentManager.start();

    if (process.env.MCP_STDIO_ENABLED === 'true') {
        console.error('[Core] Starting MCP Stdio Interface...');
        this.mcpInterface.start();
    }

    this.memoryManager.getToolDefinitions().forEach(tool => {
        this.proxyManager.registerInternalTool(tool, async (args: any) => {
             if (tool.name === 'remember') return this.memoryManager.remember(args);
             if (tool.name === 'search_memory') return this.memoryManager.search(args);
             if (tool.name === 'semantic_search') return this.memoryManager.searchSemantic(args);
             if (tool.name === 'recall_recent') return this.memoryManager.recall(args);
             if (tool.name === 'create_snapshot') return this.memoryManager.createSnapshot(args);
             if (tool.name === 'list_snapshots') return this.memoryManager.listSnapshots(args);
             if (tool.name === 'restore_snapshot') return this.memoryManager.restoreSnapshot(args);
             if (tool.name === 'embed_memories') return this.memoryManager.backfillEmbeddings();
             if (tool.name === 'ingest_content') return this.memoryManager.ingestSession(args.source, args.content);
             return "Unknown tool";
        });
    });

    this.proxyManager.registerInternalTool(FormatTranslatorTool, async (args: any) => {
        const json = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
        return toToon(json);
    });

    this.proxyManager.registerInternalTool({
        name: "generate_context_file",
        description: "Generate a context file (CLAUDE.md, .cursorrules) based on the current profile.",
        inputSchema: {
            type: "object",
            properties: {
                type: { type: "string", enum: ["claude", "cursor"] },
                outputPath: { type: "string" }
            },
            required: ["type"]
        }
    }, async (args: any) => {
        const agents = this.agentManager.getAgents();
        const skills = this.skillManager.getSkills();
        
        let content = "";
        if (args.type === 'claude') {
            content = ContextGenerator.generateClaudeMd(agents, skills);
        } else if (args.type === 'cursor') {
            content = ContextGenerator.generateCursorRules(agents, skills);
        }

        if (args.outputPath) {
            fs.writeFileSync(args.outputPath, content);
            return `Generated ${args.type} context at ${args.outputPath}`;
        }
        return content;
    });

    this.proxyManager.registerInternalTool({
        name: "get_traffic_logs",
        description: "Retrieve traffic logs for debugging and auditing.",
        inputSchema: {
            type: "object",
            properties: {
                limit: { type: "number" },
                type: { type: "string", enum: ["request", "response", "error"] },
                tool: { type: "string" }
            }
        }
    }, async (args: any) => {
        return await this.logManager.getLogs(args);
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

    // Agent Communication Tools
    this.proxyManager.registerInternalTool({
        name: "send_message",
        description: "Send a message to another agent.",
        inputSchema: {
            type: "object",
            properties: {
                targetAgentId: { type: "string" },
                content: { type: "string" },
                type: { type: "string", enum: ["request", "response", "event"] },
                sourceAgentId: { type: "string", description: "Your agent ID" }
            },
            required: ["targetAgentId", "content"]
        }
    }, async (args: any) => {
        const sourceAgentId = args.sourceAgentId || "anonymous"; 
        await this.messageBroker.route({
            id: crypto.randomUUID(),
            sourceAgentId,
            targetAgentId: args.targetAgentId,
            type: args.type || 'request',
            content: args.content,
            timestamp: Date.now()
        });
        return "Message sent";
    });

    this.proxyManager.registerInternalTool({
        name: "check_mailbox",
        description: "Check for new messages.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string" }
            },
            required: ["agentId"]
        }
    }, async (args: any) => {
        const messages = this.messageBroker.getMessages(args.agentId);
        return messages.length > 0 ? JSON.stringify(messages) : "No new messages";
    });

    this.proxyManager.registerInternalTool({
        name: "list_agents",
        description: "List all available agents in the registry.",
        inputSchema: { type: "object", properties: {}, required: [] }
    }, async (args: any) => {
        const agents = this.agentManager.registry.listAgents();
        return JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, capabilities: a.capabilities })));
    });

    this.proxyManager.registerInternalTool({
        name: "delegate_task",
        description: "Delegate a task to a sub-agent. Spawns the agent if not running.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string" },
                task: { type: "string" },
                parentId: { type: "string" }
            },
            required: ["agentId", "task", "parentId"]
        }
    }, async (args: any) => {
        try {
            // 1. Start the agent if not running
            await this.autonomousAgentManager.startAgent(args.agentId, args.parentId);
            
            // 2. Send the task message
            await this.messageBroker.route({
                id: crypto.randomUUID(),
                sourceAgentId: args.parentId,
                targetAgentId: args.agentId,
                type: 'request',
                content: args.task,
                timestamp: Date.now()
            });

            return `Task delegated to ${args.agentId}. They will report back via message.`;
        } catch (e: any) {
            return `Error delegating task: ${e.message}`;
        }
    });

    // Browser Tools
    this.proxyManager.registerInternalTool({
        name: "browser_navigate",
        description: "Navigate the connected browser to a URL.",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string" }
            },
            required: ["url"]
        }
    }, async (args: any) => {
        return await this.browserManager.navigate(args.url);
    });

    this.proxyManager.registerInternalTool({
        name: "browser_get_content",
        description: "Get the text content of the active tab in the connected browser.",
        inputSchema: { type: "object", properties: {}, required: [] }
    }, async (args: any) => {
        return await this.browserManager.getActiveTabContent();
    });

    this.proxyManager.registerInternalTool({
        name: "browser_search_history",
        description: "Search the connected browser's history.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
                limit: { type: "number" }
            },
            required: ["query"]
        }
    }, async (args: any) => {
        return await this.browserManager.searchHistory(args.query, args.limit);
    });

    this.proxyManager.registerInternalTool({
        name: "browser_get_bookmarks",
        description: "Search or list bookmarks from the connected browser.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" }
            }
        }
    }, async (args: any) => {
        return await this.browserManager.getBookmarks(args.query);
    });

    this.proxyManager.registerInternalTool({
        name: "ingest_browser_page",
        description: "Read the current browser page and ingest it into memory as a session.",
        inputSchema: { type: "object", properties: {}, required: [] }
    }, async (args: any) => {
        try {
            const content = await this.browserManager.getActiveTabContent();
            const result = await this.memoryManager.ingestSession("Browser Page", content);
            
            if (typeof result === 'string') {
                return `Failed to ingest: ${result}`;
            }
            
            return `Ingested browser page. Summary ID: ${result.summaryId}. Facts: ${result.facts}, Decisions: ${result.decisions}`;
        } catch (e: any) {
            return `Failed to ingest browser page: ${e.message}`;
        }
    });

    this.proxyManager.registerInternalTool({
        name: "mine_context",
        description: "Analyze recent session logs to find abandoned threads and key insights.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string", description: "Optional session ID to analyze." }
            }
        }
    }, async (args: any) => {
        return await this.contextMiner.mineContext(args.sessionId);
    });
    
    this.proxyManager.registerInternalTool({
        name: "run_code",
        description: "Execute JavaScript code in a secure sandbox. The code can call other tools using `await call_tool('tool_name', args)`.",
        inputSchema: {
            type: "object",
            properties: {
                code: { type: "string", description: "The JavaScript code to execute." },
                sessionId: { type: "string", description: "Optional session ID to persist state." }
            },
            required: ["code"]
        }
    }, async (args: any) => {
        // Define the callback that the sandbox will use to call tools
        const toolCallback = async (name: string, toolArgs: any) => {
            console.log(`[Sandbox] Requesting tool: ${name}`);
            // We use the proxyManager to call the tool, ensuring permissions/routing
            return await this.proxyManager.callTool(name, toolArgs, args.sessionId);
        };

        return await this.codeExecutionManager.execute(args.code, toolCallback, args.sessionId);
    });

    this.proxyManager.registerInternalTool({
        name: "configure_client",
        description: "Auto-configure a client (VSCode, Claude, Cursor) to use the AIOS Hub.",
        inputSchema: {
            type: "object",
            properties: {
                clientName: { type: "string", enum: ["VSCode", "Claude Desktop", "Cursor", "Claude Code"] }
            },
            required: ["clientName"]
        }
    }, async (args: any) => {
        // We need to point to the bin/aios script or the dist/index.js
        // For robustness, let's point to dist/index.js and let ClientManager handle the node invocation
        const scriptPath = path.resolve(this.rootDir, 'index.js'); 
        return await this.clientManager.configureClient(args.clientName, {
            scriptPath,
            env: process.env
        });
    });

    this.proxyManager.registerInternalTool({
        name: "install_cli",
        description: "Install the 'aios' CLI command to your shell profile.",
        inputSchema: { type: "object", properties: {}, required: [] }
    }, async (args: any) => {
        return await this.clientManager.installCLI();
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
