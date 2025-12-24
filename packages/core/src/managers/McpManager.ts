import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class McpManager extends EventEmitter {
    private servers: Map<string, {
        status: 'running' | 'stopped',
        process: any | null,
        client: Client | null
    }> = new Map();

    constructor(private mcpDir: string) {
        super();
    }

    async startServerSimple(name: string, config: any) {
        const cmd = config.command || 'node';
        const args = config.args || [];
        const env = config.env || process.env;

        // Resolve paths relative to repo root if they look like file paths
        const finalArgs = args.map((arg: any) => {
             if (typeof arg === 'string' && arg.includes('/')) {
                 // If the path is not absolute, resolve it relative to mcpDir
                 return path.isAbsolute(arg) ? arg : path.resolve(this.mcpDir, arg);
             }
             return arg;
        });

        console.log(`Starting MCP Server ${name}: ${cmd} ${finalArgs.join(' ')}`);

        const transport = new StdioClientTransport({
            command: cmd,
            args: finalArgs,
            env: env,
            stderr: 'inherit'
        });

        const client = new Client({
            name: "SuperAI-Hub",
            version: "1.0.0"
        }, {
            capabilities: {}
        });

        // We store the transport so we can close it later
        // But StdioClientTransport doesn't expose the child process directly in public API easily,
        // but it does have `pid`.
        // We will assume 'running' until it closes.

        this.servers.set(name, {
            status: 'running',
            process: null, // Managed by transport
            client
        });

        transport.onclose = () => {
            console.log(`Server ${name} closed`);
            this.servers.set(name, { status: 'stopped', process: null, client: null });
            this.emit('updated', this.getAllServers());
        };

        transport.onerror = (error) => {
            console.error(`Server ${name} error:`, error);
        };

        try {
            await client.connect(transport);
            console.log(`Connected to MCP server: ${name}`);
        } catch (e: any) {
            console.error(`Failed to connect to MCP server ${name}:`, e);
            this.servers.set(name, { status: 'stopped', process: null, client: null });
        }

        this.emit('updated', this.getAllServers());
    }

    async stopServer(name: string) {
        const server = this.servers.get(name);
        if (server && server.client) {
            try {
                await server.client.close();
            } catch (e) {
                console.error(`Error stopping server ${name}:`, e);
            }
            this.servers.set(name, { ...server, status: 'stopped', process: null, client: null });
            this.emit('updated', this.getAllServers());
        }
    }

    getAllServers() {
        const result: any[] = [];
        for (const [name, data] of this.servers.entries()) {
            result.push({ name, status: data.status });
        }
        return result;
    }

    getClient(name: string) {
        return this.servers.get(name)?.client;
    }
}
