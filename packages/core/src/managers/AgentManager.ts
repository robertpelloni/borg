import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { AgentDefinition } from '../types.js';

export class AgentManager extends EventEmitter {
  private agents: Map<string, AgentDefinition> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  
  constructor(private rootDir: string) {
    super();
  }

  async loadAgents() {
    this.watcher = chokidar.watch([
        path.join(this.rootDir, 'agents'),
        path.join(this.rootDir, 'AGENTS.md')
    ], {
      ignored: /(^|[\/\\])\../,
      persistent: true
    });

    this.watcher.on('add', this.handleFileChange.bind(this));
    this.watcher.on('change', this.handleFileChange.bind(this));
    this.watcher.on('unlink', this.handleFileRemove.bind(this));
    
    console.log(`[AgentManager] Watching agents/ and AGENTS.md`);
  }

  async saveAgent(name: string, definition: AgentDefinition) {
      // We only save to separate JSON files for simplicity, even if originally from Markdown.
      // This avoids complex markdown parsing/rewriting.
      const filepath = path.join(this.rootDir, 'agents', `${name}.json`);
      // Ensure agents/ dir exists
      try { await fs.mkdir(path.join(this.rootDir, 'agents'), { recursive: true }); } catch {}

      await fs.writeFile(filepath, JSON.stringify(definition, null, 2));
      console.log(`[AgentManager] Saved agent ${name}`);
      // Watcher will pick it up
  }

  private async handleFileChange(filepath: string) {
      const filename = path.basename(filepath);

      if (filename === 'AGENTS.md') {
          await this.loadAgentsFromMarkdown(filepath);
      } else if (filename.endsWith('.json')) {
          await this.loadAgentFromJson(filepath);
      }
  }

  private handleFileRemove(filepath: string) {
      const filename = path.basename(filepath);
      if (filename === 'AGENTS.md') {
          // No-op
      } else {
          this.agents.delete(filename);
          this.emit('updated', this.getAgents());
      }
  }

  private async loadAgentFromJson(filepath: string) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const filename = path.basename(filepath);
      const agent: AgentDefinition = JSON.parse(content);
      this.agents.set(filename, agent);
      console.log(`[AgentManager] Loaded agent: ${agent.name}`);
      this.emit('updated', this.getAgents());
    } catch (err) {
      console.error(`[AgentManager] Error loading agent ${filepath}:`, err);
    }
  }

  private async loadAgentsFromMarkdown(filepath: string) {
      try {
          const content = await fs.readFile(filepath, 'utf-8');
          const lines = content.split('\n');
          let currentAgent: Partial<AgentDefinition> | null = null;

          for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith('## ')) {
                  if (currentAgent && currentAgent.name) {
                      this.agents.set(`markdown-${currentAgent.name}`, currentAgent as AgentDefinition);
                  }
                  currentAgent = {
                      name: line.replace('## ', '').trim(),
                      description: '',
                      instructions: ''
                  };
              } else if (currentAgent) {
                  if (line.trim().startsWith('```json')) {
                      let jsonBlock = '';
                      i++;
                      while (i < lines.length && !lines[i].trim().startsWith('```')) {
                          jsonBlock += lines[i] + '\n';
                          i++;
                      }
                      try {
                          const config = JSON.parse(jsonBlock);
                          Object.assign(currentAgent, config);
                      } catch (e) {}
                  } else {
                      if (!currentAgent.description) currentAgent.description = line;
                      else currentAgent.instructions += line + '\n';
                  }
              }
          }
          if (currentAgent && currentAgent.name) {
              this.agents.set(`markdown-${currentAgent.name}`, currentAgent as AgentDefinition);
          }

          console.log(`[AgentManager] Reloaded AGENTS.md`);
          this.emit('updated', this.getAgents());

      } catch (err) {
          console.error(`[AgentManager] Error parsing AGENTS.md:`, err);
      }
  }

  getAgents() {
    return Array.from(this.agents.values());
  }
}
