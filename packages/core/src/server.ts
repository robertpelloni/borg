import Fastify from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { HookManager } from './managers/HookManager.js';
import { AgentManager } from './managers/AgentManager.js';
import { SkillManager } from './managers/SkillManager.js';
import { PromptManager } from './managers/PromptManager.js';
import { ContextManager } from './managers/ContextManager.js';
import { McpManager } from './managers/McpManager.js';
import { ConfigGenerator } from './utils/ConfigGenerator.js';
import { HookExecutor } from './utils/HookExecutor.js';
import { HookEvent } from './types.js';

export class CoreService {
  private app = Fastify({ logger: true });
  private io: SocketIOServer;
  
  private hookManager: HookManager;
  private agentManager: AgentManager;
  private skillManager: SkillManager;
  private promptManager: PromptManager;
  private contextManager: ContextManager;
  private mcpManager: McpManager;
  private configGenerator: ConfigGenerator;

  constructor(
    private rootDir: string
  ) {
    this.io = new SocketIOServer(this.app.server, {
      cors: { origin: "*" }
    });

    this.hookManager = new HookManager(path.join(rootDir, 'hooks'));
    this.agentManager = new AgentManager(path.join(rootDir, 'agents'));
    this.skillManager = new SkillManager(path.join(rootDir, 'skills'));
    this.promptManager = new PromptManager(path.join(rootDir, 'prompts'));
    this.contextManager = new ContextManager(path.join(rootDir, 'context'));
    this.mcpManager = new McpManager(path.join(rootDir, 'mcp-servers'));
    this.configGenerator = new ConfigGenerator(path.join(rootDir, 'mcp-servers'));
    
    this.setupRoutes();
    this.setupSocket();
  }

  private setupRoutes() {
    this.app.get('/health', async () => ({ status: 'ok' }));
    
    this.app.get('/api/state', async () => ({
        agents: this.agentManager.getAgents(),
        skills: this.skillManager.getSkills(),
        hooks: this.hookManager.getHooks(),
        prompts: this.promptManager.getPrompts(),
        context: this.contextManager.getContextFiles(),
        mcpServers: this.mcpManager.getAllServers()
    }));

    this.app.get('/api/config/mcp/:format', async (request: any, reply) => {
        const format = request.params.format;
        if (['json', 'toml', 'xml'].includes(format)) {
            return { config: await this.configGenerator.generateConfig(format) };
        }
        reply.code(400).send({ error: 'Invalid format' });
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
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.emit('state', {
        agents: this.agentManager.getAgents(),
        skills: this.skillManager.getSkills(),
        hooks: this.hookManager.getHooks(),
        prompts: this.promptManager.getPrompts(),
        context: this.contextManager.getContextFiles(),
        mcpServers: this.mcpManager.getAllServers()
      });

      socket.on('hook_event', (event: HookEvent) => {
          console.log('Received Hook Event:', event.type);
          this.io.emit('hook_log', event);
          this.processHook(event);
      });
    });

    this.agentManager.on('updated', (agents) => this.io.emit('agents_updated', agents));
    this.skillManager.on('updated', (skills) => this.io.emit('skills_updated', skills));
    this.hookManager.on('loaded', (hooks) => this.io.emit('hooks_updated', hooks));
    this.promptManager.on('updated', (prompts) => this.io.emit('prompts_updated', prompts));
    this.contextManager.on('updated', (context) => this.io.emit('context_updated', context));
    this.mcpManager.on('updated', (servers) => this.io.emit('mcp_updated', servers));
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

  async start(port: number = 3000) {
    await this.hookManager.start();
    await this.agentManager.start();
    await this.skillManager.start();
    await this.promptManager.start();
    await this.contextManager.start();
    
    try {
      await this.app.listen({ port, host: '0.0.0.0' });
      console.log(`Core Service running on port ${port}`);
    } catch (err) {
      this.app.log.error(err);
      process.exit(1);
    }
  }
}
