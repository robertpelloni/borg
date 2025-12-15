import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { AgentDefinition } from '../types.js';

export class AgentManager extends EventEmitter {
  private agents: Map<string, AgentDefinition> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  
  constructor(private agentsDir: string) {
    super();
  }

  async start() {
    this.watcher = chokidar.watch(this.agentsDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    this.watcher.on('add', this.loadAgent.bind(this));
    this.watcher.on('change', this.loadAgent.bind(this));
    this.watcher.on('unlink', this.removeAgent.bind(this));
    
    console.log(`[AgentManager] Watching ${this.agentsDir}`);
  }

  private async loadAgent(filepath: string) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const filename = path.basename(filepath);
      // Simple parsing assuming JSON for now, or maybe Frontmatter + Markdown later
      // For this skeleton, let's assume JSON agent definitions
      if (filename.endsWith('.json')) {
         const agent: AgentDefinition = JSON.parse(content);
         this.agents.set(filename, agent);
         console.log(`[AgentManager] Loaded agent: ${agent.name}`);
         this.emit('updated', this.getAgents());
      }
    } catch (err) {
      console.error(`[AgentManager] Error loading agent ${filepath}:`, err);
    }
  }

  private removeAgent(filepath: string) {
      const filename = path.basename(filepath);
      this.agents.delete(filename);
      this.emit('updated', this.getAgents());
  }

  getAgents() {
    return Array.from(this.agents.values());
  }
}
