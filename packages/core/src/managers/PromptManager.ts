import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

export class PromptManager extends EventEmitter {
  private prompts: Map<string, string> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  
  constructor(private promptsDir: string) {
    super();
  }

  async start() {
    this.watcher = chokidar.watch(this.promptsDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    });

    this.watcher.on('add', this.loadPrompt.bind(this));
    this.watcher.on('change', this.loadPrompt.bind(this));
    this.watcher.on('unlink', this.removePrompt.bind(this));
    
    console.log(`[PromptManager] Watching ${this.promptsDir}`);
  }

  private async loadPrompt(filepath: string) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const filename = path.basename(filepath);
      this.prompts.set(filename, content);
      console.log(`[PromptManager] Loaded prompt: ${filename}`);
      this.emit('updated', this.getPrompts());
    } catch (err) {
      console.error(`[PromptManager] Error loading prompt ${filepath}:`, err);
    }
  }

  private removePrompt(filepath: string) {
      const filename = path.basename(filepath);
      this.prompts.delete(filename);
      this.emit('updated', this.getPrompts());
  }

  getPrompts() {
    return Array.from(this.prompts.entries()).map(([name, content]) => ({ name, content }));
  }
}
