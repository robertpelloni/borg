import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ToolInventoryEntry {
  id: string;
  name: string;
  category: 'cli' | 'gui' | 'mcp' | 'service';
  status: 'installed' | 'missing' | 'unknown';
  version?: string;
  path?: string;
  installCommand?: string;
  lastChecked: number;
}

export class ToolInventoryService extends EventEmitter {
  private static instance: ToolInventoryService;
  private tools: Map<string, ToolInventoryEntry> = new Map();
  private inventoryFile: string;

  private constructor(dataDir: string) {
    super();
    this.inventoryFile = path.join(dataDir, 'tool_inventory.json');
    this.loadInventory();
  }

  static getInstance(dataDir?: string): ToolInventoryService {
    if (!ToolInventoryService.instance) {
      if (!dataDir) throw new Error("ToolInventoryService requires dataDir");
      ToolInventoryService.instance = new ToolInventoryService(dataDir);
    }
    return ToolInventoryService.instance;
  }

  private async loadInventory() {
    try {
      const data = await fs.readFile(this.inventoryFile, 'utf-8');
      const list = JSON.parse(data);
      list.forEach((t: ToolInventoryEntry) => this.tools.set(t.id, t));
    } catch {
      this.initializeDefaults();
    }
  }

  private initializeDefaults() {
    const defaults: ToolInventoryEntry[] = [
      { id: 'aider', name: 'Aider', category: 'cli', status: 'unknown', installCommand: 'pip install aider-chat', lastChecked: 0 },
      { id: 'codebuff', name: 'Codebuff', category: 'cli', status: 'unknown', installCommand: 'npm install -g codebuff', lastChecked: 0 },
      { id: 'claude', name: 'Claude Code', category: 'cli', status: 'unknown', installCommand: 'npm install -g @anthropic-ai/claude-code', lastChecked: 0 },
      { id: 'cursor', name: 'Cursor', category: 'gui', status: 'unknown', installCommand: 'brew install --cask cursor', lastChecked: 0 },
      
      { id: 'docker', name: 'Docker', category: 'service', status: 'unknown', installCommand: 'brew install --cask docker', lastChecked: 0 },
      { id: 'bun', name: 'Bun', category: 'cli', status: 'unknown', installCommand: 'curl -fsSL https://bun.sh/install | bash', lastChecked: 0 },
      { id: 'python', name: 'Python', category: 'cli', status: 'unknown', installCommand: 'brew install python', lastChecked: 0 },
      { id: 'node', name: 'Node.js', category: 'cli', status: 'unknown', installCommand: 'brew install node', lastChecked: 0 },
      { id: 'git', name: 'Git', category: 'cli', status: 'unknown', installCommand: 'brew install git', lastChecked: 0 },
      { id: 'google-drive-mcp', name: 'Google Drive MCP', category: 'mcp', status: 'unknown', installCommand: 'docker run -d --rm -v mcp-gdrive:/gdrive-server -e GDRIVE_CREDENTIALS_PATH=/gdrive-server/credentials.json mcp/gdrive', lastChecked: 0 }
    ];
    defaults.forEach(t => this.tools.set(t.id, t));
    this.saveInventory();
  }

  private async saveInventory() {
    await fs.writeFile(this.inventoryFile, JSON.stringify(Array.from(this.tools.values()), null, 2));
    this.emit('updated', this.getAllTools());
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }

  async checkStatus(id: string) {
    const tool = this.tools.get(id);
    if (!tool) return;

    tool.lastChecked = Date.now();
    try {
      const cmd = process.platform === 'win32' ? `where ${id}` : `which ${id}`;
      const { stdout } = await execAsync(cmd);
      tool.status = 'installed';
      tool.path = stdout.split('\n')[0].trim();
      
      try {
        const { stdout: vOut } = await execAsync(`${id} --version`);
        tool.version = vOut.trim();
      } catch {}
    } catch {
      tool.status = 'missing';
    }

    this.saveInventory();
  }

  async checkAll() {
    for (const id of this.tools.keys()) {
      await this.checkStatus(id);
    }
  }
}
