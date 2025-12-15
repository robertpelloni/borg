import Fastify from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { HookManager } from './managers/HookManager.js';
import { AgentManager } from './managers/AgentManager.js';
import { SkillManager } from './managers/SkillManager.js';
import { PromptManager } from './managers/PromptManager.js';
import { ContextManager } from './managers/ContextManager.js';
import { ConfigGenerator } from './utils/ConfigGenerator.js';
import { HookEvent } from './types.js';

export class CoreService {
  private app = Fastify({ logger: true });
  private io: SocketIOServer;
  
  private hookManager: HookManager;
  private agentManager: AgentManager;
  private skillManager: SkillManager;
  private promptManager: PromptManager;
  private contextManager: ContextManager;
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
        context: this.contextManager.getContextFiles()
    }));

    this.app.get('/api/config/mcp/:format', async (request: any, reply) => {
        const format = request.params.format;
        if (['json', 'toml', 'xml'].includes(format)) {
            return { config: await this.configGenerator.generateConfig(format) };
        }
        reply.code(400).send({ error: 'Invalid format' });
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
        context: this.contextManager.getContextFiles()
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
  }

  private processHook(event: HookEvent) {
      const hooks = this.hookManager.getHooks();
      const matched = hooks.filter(h => h.event === event.type);
      
      for (const hook of matched) {
          console.log(`[Core] Triggering hook action for ${event.type}: ${hook.action}`);
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
