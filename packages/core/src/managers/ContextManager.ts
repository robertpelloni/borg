import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

export class ContextManager extends EventEmitter {
  private contextFiles: Map<string, string> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  
  constructor(private contextDir: string) {
    super();
  }

  async start() {
    this.watcher = chokidar.watch(this.contextDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    });

    this.watcher.on('add', this.loadContext.bind(this));
    this.watcher.on('change', this.loadContext.bind(this));
    this.watcher.on('unlink', this.removeContext.bind(this));
    
    console.log(`[ContextManager] Watching ${this.contextDir}`);
  }

  private async loadContext(filepath: string) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const filename = path.basename(filepath);
      this.contextFiles.set(filename, content);
      console.log(`[ContextManager] Loaded context: ${filename}`);
      this.emit('updated', this.getContextFiles());
    } catch (err) {
      console.error(`[ContextManager] Error loading context ${filepath}:`, err);
    }
  }

  private removeContext(filepath: string) {
      const filename = path.basename(filepath);
      this.contextFiles.delete(filename);
      this.emit('updated', this.getContextFiles());
  }

  getContextFiles() {
    return Array.from(this.contextFiles.entries()).map(([name, content]) => ({ name, content }));
  }
}
