import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BridgeClient } from '@apify/mcpc/dist/lib/bridge-client.js';
import * as BridgeManager from '@apify/mcpc/dist/lib/bridge-manager.js';
import { getSession } from '@apify/mcpc/dist/lib/sessions.js';

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

        // Use the Bridge Pattern from mcpc
        try {
            // Check if a session already exists or create a new one
            // We're adapting the McpManager to use the persistent bridge
            
            // 1. Construct the ServerConfig for the bridge
            const serverConfig = {
                command: cmd,
                args: finalArgs,
                env: env
            };

            // 2. Start the bridge process using BridgeManager
            // This will spawn the background process that holds the MCP connection
            const result = await BridgeManager.startBridge({
                sessionName: name,
                serverConfig: serverConfig
            });

            // 3. Connect to the bridge using BridgeClient
            // This connects to the unix socket exposed by the bridge
            const client = new BridgeClient(name); // BridgeClient constructor takes session name or socket path

            await client.connect();
            console.log(`Connected to MCP Bridge: ${name}`);

            this.servers.set(name, {
                status: 'running',
                process: result.pid, // This is the PID of the bridge
                client: client as unknown as Client // BridgeClient implements McpClient interface which is similar enough or we might need an adapter
            });
            
            // We can't easily monitor the detached process directly from here without polling or using the bridge client
            // The BridgeClient handles connection state

        } catch (error) {
             console.error(`Failed to start MCP Bridge for ${name}:`, error);
             // Fallback or error handling
             this.servers.set(name, { status: 'stopped', process: null, client: null });
        }

        this.emit('updated', this.getAllServers());
    }

    async stopServer(name: string) {
        const server = this.servers.get(name);
        if (server) {
            try {
                // If we are using BridgeClient, we should close it
                if (server.client) {
                     // @ts-ignore
                    if (typeof server.client.close === 'function') {
                         await server.client.close();
                    }
                }
                
                // Stop the bridge process via manager
                await BridgeManager.stopBridge(name);
                
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

