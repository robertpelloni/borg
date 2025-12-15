import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { HookDefinition } from '../types.js';

export class HookManager extends EventEmitter {
  private hooks: HookDefinition[] = [];
  private watcher: chokidar.FSWatcher | null = null;
  
  constructor(private hooksDir: string) {
    super();
  }

  async start() {
    this.watcher = chokidar.watch(path.join(this.hooksDir, 'hooks.json'), {
      persistent: true
    });

    this.watcher.on('add', this.loadHooks.bind(this));
    this.watcher.on('change', this.loadHooks.bind(this));
    
    console.log(`[HookManager] Watching ${this.hooksDir}`);
  }

  private async loadHooks(filepath: string) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content);
      // Basic validation could go here
      this.hooks = Array.isArray(data) ? data : [];
      console.log(`[HookManager] Loaded ${this.hooks.length} hooks`);
      this.emit('loaded', this.hooks);
    } catch (err) {
      console.error(`[HookManager] Error loading hooks from ${filepath}:`, err);
    }
  }

  getHooks() {
    return this.hooks;
  }
}
