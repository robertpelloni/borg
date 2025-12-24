import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

export interface CommandDefinition {
    name: string;
    description?: string;
    command: string;
    args?: string[];
    cwd?: string;
}

export class CommandManager extends EventEmitter {
  private commands: Map<string, CommandDefinition> = new Map();
  private watcher: chokidar.FSWatcher | null = null;

  constructor(private commandsDir: string) {
    super();
  }

  async start() {
    // Ensure dir exists
    try {
        await fs.mkdir(this.commandsDir, { recursive: true });
    } catch (e) {}

    this.watcher = chokidar.watch(this.commandsDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    });

    this.watcher.on('add', this.loadCommand.bind(this));
    this.watcher.on('change', this.loadCommand.bind(this));
    this.watcher.on('unlink', this.removeCommand.bind(this));

    console.log(`[CommandManager] Watching ${this.commandsDir}`);
  }

  private async loadCommand(filepath: string) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const filename = path.basename(filepath);

      // Support JSON definitions or Markdown with Frontmatter?
      // Let's assume JSON for simplicity or simple Markdown parsing
      if (filename.endsWith('.json')) {
         const cmd: CommandDefinition = JSON.parse(content);
         this.commands.set(cmd.name, cmd);
         console.log(`[CommandManager] Loaded command: ${cmd.name}`);
         this.emit('updated', this.getCommands());
      }
    } catch (err) {
      console.error(`[CommandManager] Error loading command ${filepath}:`, err);
    }
  }

  private removeCommand(filepath: string) {
      // This is tricky if filename != command name.
      // Ideally we map filepath to ID.
      // For now, reload all?
      // Or just ignore removal for this skeleton.
      this.emit('updated', this.getCommands());
  }

  getCommands() {
    return Array.from(this.commands.values());
  }
}
