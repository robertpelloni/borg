import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { ContextAnalyzer } from '../utils/ContextAnalyzer.js';

export class ContextManager extends EventEmitter {
  private contextFiles: Map<string, string> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  
  constructor(private contextDir: string, private workspaceDir?: string) {
    super();
  }

  async start() {
    const watchPaths = [this.contextDir];
    
    if (this.workspaceDir) {
        watchPaths.push(
            path.join(this.workspaceDir, '.cursorrules'),
            path.join(this.workspaceDir, 'CLAUDE.md'),
            path.join(this.workspaceDir, 'GEMINI.md'),
            path.join(this.workspaceDir, '.claude', 'rules')
        );
    }

    this.watcher = chokidar.watch(watchPaths, {
      // Allow dotfiles like .cursorrules
      ignored: (path: string) => {
          // Ignore node_modules and .git
          if (path.includes('node_modules') || path.includes('.git')) return true;
          return false;
      },
      persistent: true
    });

    this.watcher.on('add', this.loadContext.bind(this));
    this.watcher.on('change', this.loadContext.bind(this));
    this.watcher.on('unlink', this.removeContext.bind(this));
    
    console.log(`[ContextManager] Watching context in ${this.contextDir} and workspace ${this.workspaceDir}`);
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

  getContextStats() {
      // Create a mock message array from the context files to use the analyzer
      const messages = this.getContextFiles().map(file => ({
          role: 'user', // Treat file content as user input for analysis
          content: `[File: ${file.name}]\n${file.content}`
      }));
      
      return ContextAnalyzer.analyze(messages);
  }
}
