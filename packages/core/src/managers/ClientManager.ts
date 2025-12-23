import fs from 'fs';
import path from 'path';
import os from 'os';
import json5 from 'json5';

interface ClientConfig {
  name: string;
  configPath: string;
  exists: boolean;
}

export class ClientManager {
  private clients: ClientConfig[] = [];

  constructor(extraPaths?: { name: string, paths: string[] }[]) {
    this.detectClients(extraPaths);
  }

  private detectClients(extraPaths?: { name: string, paths: string[] }[]) {
    const homeDir = os.homedir();
    const platform = os.platform();

    // Define potential paths for known clients
    const potentialPaths = [
      {
        name: 'VSCode',
        paths: [
          platform === 'win32'
            ? path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'mcp-servers.json')
            : path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'mcp-servers.json'),
           // linux path?
           path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'mcp-servers.json')
        ]
      },
      {
        name: 'Claude Desktop',
        paths: [
           platform === 'win32'
            ? path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
            : path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
        ]
      },
       {
        name: 'Cursor',
        paths: [
           platform === 'win32'
            ? path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'mcp-servers.json')
            : path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'mcp-servers.json')
        ]
      }
    ];

    if (extraPaths) {
        potentialPaths.push(...extraPaths);
    }

    this.clients = [];

    for (const p of potentialPaths) {
      for (const tryPath of p.paths) {
        if (fs.existsSync(tryPath)) {
            this.clients.push({ name: p.name, configPath: tryPath, exists: true });
            break;
        } else if (p.paths.indexOf(tryPath) === p.paths.length - 1) {
             this.clients.push({ name: p.name, configPath: p.paths[0], exists: false });
        }
      }
    }
  }

  getClients() {
    return this.clients.map(c => ({
        ...c,
        exists: fs.existsSync(c.configPath)
    }));
  }

  async configureClient(clientName: string, hubConfig: any) {
    const client = this.clients.find(c => c.name === clientName);
    if (!client) throw new Error(`Client ${clientName} not found`);

    let currentConfig: any = { mcpServers: {} };

    if (fs.existsSync(client.configPath)) {
        try {
            const content = fs.readFileSync(client.configPath, 'utf-8');
            currentConfig = json5.parse(content);
        } catch (err) {
            console.error(`Failed to parse config for ${clientName}, starting fresh.`, err);
            fs.copyFileSync(client.configPath, client.configPath + '.bak');
        }
    }

    if (!currentConfig.mcpServers) currentConfig.mcpServers = {};

    currentConfig.mcpServers["super-ai-hub"] = {
        command: "node",
        args: [hubConfig.scriptPath],
        env: hubConfig.env || {}
    };

    fs.mkdirSync(path.dirname(client.configPath), { recursive: true });
    fs.writeFileSync(client.configPath, JSON.stringify(currentConfig, null, 2));

    return { status: 'configured', path: client.configPath };
  }
}
