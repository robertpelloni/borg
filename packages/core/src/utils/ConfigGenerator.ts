import fs from 'fs/promises';
import path from 'path';

export class ConfigGenerator {
  constructor(private mcpDir: string) {}

  async generateConfig(type: 'json' | 'toml' | 'xml'): Promise<string> {
    const servers = await this.scanServers();
    
    if (type === 'json') {
      return JSON.stringify({ mcpServers: servers }, null, 2);
    } 
    // Simplified stubs for other formats
    if (type === 'toml') {
        return Object.entries(servers).map(([name, config]: [string, any]) => {
            return `[mcpServers.${name}]\ncommand = "${config.command}"\nargs = ${JSON.stringify(config.args)}`;
        }).join('\n\n');
    }
    return '';
  }

  private async scanServers() {
    // Mock scanning logic: look for subdirectories in mcp-servers/
    // If a subdirectory contains a package.json, assume it's a Node server
    const servers: Record<string, any> = {};
    
    try {
        const entries = await fs.readdir(this.mcpDir, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory());

        for (const dir of dirs) {
            const serverName = dir.name;
            const dirPath = path.join(this.mcpDir, serverName);
            // Default heuristics
            servers[serverName] = {
                command: 'node',
                args: [path.join(dirPath, 'index.js')]
            };
        }
    } catch (err) {
        console.warn('Could not scan mcp-servers directory', err);
    }
    return servers;
  }
}
