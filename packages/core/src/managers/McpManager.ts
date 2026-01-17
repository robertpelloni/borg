/**
 * AIOS MCP Manager - Enhanced with MetaMCP Features
 * 
 * Features migrated from MetaMCP:
 * - Namespace support for organizing servers
 * - Endpoint routing for public access
 * - Multiple transport types (STDIO, SSE, StreamableHTTP)
 * - Tool discovery and caching
 * - Policy-based access control
 * - Automatic tool registration in database
 */

import { EventEmitter } from 'events';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { BridgeClient } from '@apify/mcpc/dist/lib/bridge-client.js';
import * as BridgeManager from '@apify/mcpc/dist/lib/bridge-manager.js';
import { DatabaseManager, McpServer, Tool, Namespace, Endpoint, McpServerType } from '../db/index.js';
import { TappingTransport } from '../utils/transports/TappingTransport.js';

// ============================================

// Types
// ============================================

export interface McpServerConfig {
    name: string;
    type: McpServerType;
    // STDIO
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    // HTTP (SSE / StreamableHTTP)
    url?: string;
    bearerToken?: string;
    headers?: Record<string, string>;
    // Metadata
    description?: string;
    icon?: string;
    enabled?: boolean;
    namespaceId?: string;
}

export interface ConnectedServer {
    id: string;
    name: string;
    type: McpServerType;
    status: 'connecting' | 'running' | 'stopped' | 'error';
    client: Client | BridgeClient | null;
    bridgePid?: number;
    tools: ToolInfo[];
    resources: ResourceInfo[];
    prompts: PromptInfo[];
    error?: string;
    connectedAt?: number;
}

export interface ToolInfo {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

export interface ResourceInfo {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface PromptInfo {
    name: string;
    description?: string;
    arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface ToolCallRequest {
    toolName: string;
    arguments: Record<string, unknown>;
    namespaceId?: string;
    endpointPath?: string;
    apiKey?: string;
}

export interface ToolCallResult {
    success: boolean;
    content?: unknown;
    error?: string;
    durationMs: number;
    serverId?: string;
}

// ============================================
// McpManager Class
// ============================================

export class McpManager extends EventEmitter {
    private connectedServers: Map<string, ConnectedServer> = new Map();
    private db: DatabaseManager;
    private toolServerMap: Map<string, string> = new Map(); // toolName -> serverId

    constructor(private mcpDir: string, dataDir?: string) {
        super();
        this.db = DatabaseManager.getInstance(dataDir);
    }

    // ============================================
    // Server Lifecycle
    // ============================================

    /**
     * Start an MCP server from database config or inline config
     */
    async startServer(configOrId: McpServerConfig | string): Promise<ConnectedServer> {
        let dbServer: McpServer;
        let config: McpServerConfig;

        if (typeof configOrId === 'string') {
            // Load from database by ID or name
            const found = this.db.getMcpServer(configOrId) || this.db.getMcpServerByName(configOrId);
            if (!found) {
                throw new Error(`Server not found: ${configOrId}`);
            }
            dbServer = found;
            config = this.dbServerToConfig(dbServer);
        } else {
            config = configOrId;
            // Create or update in database
            const existing = this.db.getMcpServerByName(config.name);
            if (existing) {
                dbServer = this.db.updateMcpServer(existing.id, this.configToDbServer(config))!;
            } else {
                dbServer = this.db.createMcpServer(this.configToDbServer(config));
            }
        }

        if (dbServer.enabled === false) {
             throw new Error(`Server ${dbServer.name} is disabled`);
        }


        // Check if already connected
        const existing = this.connectedServers.get(dbServer.id);
        if (existing && existing.status === 'running') {
            return existing;
        }

        const connected: ConnectedServer = {
            id: dbServer.id,
            name: dbServer.name,
            type: dbServer.type,
            status: 'connecting',
            client: null,
            tools: [],
            resources: [],
            prompts: []
        };
        this.connectedServers.set(dbServer.id, connected);
        this.emit('server:connecting', { id: dbServer.id, name: dbServer.name });

        try {
            switch (dbServer.type) {
                case 'stdio':
                    await this.connectStdio(dbServer, connected);
                    break;
                case 'sse':
                    await this.connectSSE(dbServer, connected);
                    break;
                case 'streamable_http':
                    await this.connectStreamableHTTP(dbServer, connected);
                    break;
                default:
                    throw new Error(`Unknown server type: ${dbServer.type}`);
            }

            connected.status = 'running';
            connected.connectedAt = Date.now();

            // Discover tools
            await this.discoverCapabilities(connected);

            // Add to default namespace if not specified
            if (config.namespaceId) {
                this.db.addServerToNamespace(config.namespaceId, dbServer.id);
            } else {
                const defaultNs = this.db.getDefaultNamespace();
                if (defaultNs) {
                    try {
                        this.db.addServerToNamespace(defaultNs.id, dbServer.id);
                    } catch {
                        // Already in namespace
                    }
                }
            }

            this.emit('server:connected', connected);
            console.log(`[McpManager] Server connected: ${dbServer.name} (${connected.tools.length} tools)`);

            return connected;
        } catch (error) {
            connected.status = 'error';
            connected.error = error instanceof Error ? error.message : String(error);
            this.emit('server:error', { id: dbServer.id, error: connected.error });
            console.error(`[McpManager] Failed to connect ${dbServer.name}:`, error);
            throw error;
        }
    }

    private async connectStdio(server: McpServer, connected: ConnectedServer): Promise<void> {
        if (!server.command) {
            throw new Error('STDIO server requires command');
        }

        const args = server.args || [];
        const env = { ...process.env, ...server.env };

        // Resolve paths
        const finalArgs = args.map(arg => {
            if (typeof arg === 'string' && arg.includes('/')) {
                return path.isAbsolute(arg) ? arg : path.resolve(this.mcpDir, arg);
            }
            return arg;
        });

        console.log(`[McpManager] Starting STDIO: ${server.command} ${finalArgs.join(' ')}`);

        // Use Bridge for persistent connections
        // Filter out undefined values from env
        const cleanEnv: Record<string, string> = {};
        for (const [key, value] of Object.entries(env)) {
            if (value !== undefined) {
                cleanEnv[key] = value;
            }
        }

        const serverConfig = {
            command: server.command,
            args: finalArgs,
            env: cleanEnv
        };

        const bridgeResult = await BridgeManager.startBridge({
            sessionName: server.name,
            serverConfig
        });

        const client = new BridgeClient(server.name);
        await client.connect();

        connected.client = client;
        connected.bridgePid = bridgeResult?.pid;
    }

    private async connectSSE(server: McpServer, connected: ConnectedServer): Promise<void> {
        if (!server.url) {
            throw new Error('SSE server requires URL');
        }

        const headers: Record<string, string> = { ...server.headers };
        if (server.bearerToken) {
            headers['Authorization'] = `Bearer ${server.bearerToken}`;
        }

        const transport = new SSEClientTransport(new URL(server.url), {
            requestInit: { headers }
        });

        const tappingTransport = new TappingTransport(transport);
        tappingTransport.on('message', (event) => {
            this.emit('traffic', { 
                serverId: server.id, 
                direction: event.direction, 
                message: event.message, 
                timestamp: event.timestamp 
            });
        });

        const client = new Client({
            name: 'aios-client',
            version: '1.0.0'
        }, {
            capabilities: {}
        });

        await client.connect(tappingTransport);
        connected.client = client as unknown as Client;

    }

    private async connectStreamableHTTP(server: McpServer, connected: ConnectedServer): Promise<void> {
        // StreamableHTTP uses fetch-based transport
        // For now, fall back to SSE which is similar
        await this.connectSSE(server, connected);
    }

    private async discoverCapabilities(connected: ConnectedServer): Promise<void> {
        const client = connected.client;
        if (!client) return;

        try {
            // Discover tools
            // @ts-ignore - BridgeClient has listTools
            const toolsResult = await client.listTools?.() || { tools: [] };
            connected.tools = (toolsResult.tools || []).map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema
            }));

            // Register tools in database
            for (const tool of connected.tools) {
                const existingTool = this.db.getToolByName(tool.name, connected.id);
                if (!existingTool) {
                    const dbTool = this.db.createTool({
                        name: tool.name,
                        description: tool.description,
                        inputSchema: tool.inputSchema,
                        mcpServerId: connected.id
                    });
                    this.toolServerMap.set(tool.name, connected.id);
                } else {
                    this.toolServerMap.set(tool.name, connected.id);
                }
            }

            // Discover resources
            // @ts-ignore
            const resourcesResult = await client.listResources?.() || { resources: [] };
            connected.resources = (resourcesResult.resources || []).map((r: { uri: string; name: string; description?: string; mimeType?: string }) => ({
                uri: r.uri,
                name: r.name,
                description: r.description,
                mimeType: r.mimeType
            }));

            // Discover prompts
            // @ts-ignore
            const promptsResult = await client.listPrompts?.() || { prompts: [] };
            connected.prompts = (promptsResult.prompts || []).map((p: { name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }) => ({
                name: p.name,
                description: p.description,
                arguments: p.arguments
            }));

        } catch (error) {
            console.warn(`[McpManager] Failed to discover capabilities for ${connected.name}:`, error);
        }
    }

    /**
     * Stop a server
     */
    async stopServer(idOrName: string): Promise<void> {
        const connected = this.findServer(idOrName);
        if (!connected) {
            console.warn(`[McpManager] Server not found: ${idOrName}`);
            return;
        }

        try {
            if (connected.client) {
                // @ts-ignore
                if (typeof connected.client.close === 'function') {
                    await connected.client.close();
                }
            }

            if (connected.type === 'stdio') {
                await BridgeManager.stopBridge(connected.name);
            }
        } catch (error) {
            console.error(`[McpManager] Error stopping ${connected.name}:`, error);
        }

        connected.status = 'stopped';
        connected.client = null;

        // Remove tools from map
        for (const tool of connected.tools) {
            this.toolServerMap.delete(tool.name);
        }
        connected.tools = [];

        this.emit('server:stopped', { id: connected.id, name: connected.name });
    }

    /**
     * Start all enabled servers from database
     */
    async startAllServers(): Promise<void> {
        const servers = this.db.getAllMcpServers({ enabled: true });
        console.log(`[McpManager] Starting ${servers.length} enabled servers...`);

        const results = await Promise.allSettled(
            servers.map(s => this.startServer(s.id))
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[McpManager] Started ${succeeded} servers, ${failed} failed`);
    }

    /**
     * Stop all running servers
     */
    async stopAllServers(): Promise<void> {
        const running = Array.from(this.connectedServers.values())
            .filter(s => s.status === 'running');

        await Promise.allSettled(
            running.map(s => this.stopServer(s.id))
        );
    }

    // ============================================
    // Tool Execution
    // ============================================

    /**
     * Call a tool by name, automatically routing to the correct server
     */
    async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
        const startTime = Date.now();

        // Check policy
        const policy = this.db.evaluatePolicy(request.toolName);
        if (!policy.allowed) {
            return {
                success: false,
                error: `Tool ${request.toolName} is blocked by policy`,
                durationMs: Date.now() - startTime
            };
        }

        // Find server for this tool
        let serverId = this.toolServerMap.get(request.toolName);

        // If namespace specified, filter to servers in that namespace
        if (request.namespaceId) {
            const nsServers = this.db.getServersInNamespace(request.namespaceId);
            const nsServerIds = new Set(nsServers.map(s => s.id));

            if (serverId && !nsServerIds.has(serverId)) {
                // Tool exists but not in requested namespace
                serverId = undefined;
            }

            if (!serverId) {
                // Search for tool in namespace servers
                for (const server of this.connectedServers.values()) {
                    if (nsServerIds.has(server.id) && server.tools.some(t => t.name === request.toolName)) {
                        serverId = server.id;
                        break;
                    }
                }
            }
        }

        if (!serverId) {
            return {
                success: false,
                error: `Tool not found: ${request.toolName}`,
                durationMs: Date.now() - startTime
            };
        }

        const server = this.connectedServers.get(serverId);
        if (!server || server.status !== 'running' || !server.client) {
            return {
                success: false,
                error: `Server not available for tool: ${request.toolName}`,
                durationMs: Date.now() - startTime,
                serverId
            };
        }

        try {
            // @ts-ignore - Client has callTool
            const result = await server.client.callTool({
                name: request.toolName,
                arguments: request.arguments
            });

            const durationMs = Date.now() - startTime;

            // Update tool usage
            const dbTool = this.db.getToolByName(request.toolName, serverId);
            if (dbTool) {
                this.db.incrementToolUsage(dbTool.id);
            }

            // Log the call
            this.db.logToolCall({
                timestamp: startTime,
                toolName: request.toolName,
                mcpServerId: serverId,
                namespaceId: request.namespaceId,
                requestArgs: request.arguments,
                responseData: result.content,
                durationMs,
                success: true
            });

            this.emit('tool:called', {
                toolName: request.toolName,
                serverId,
                durationMs,
                success: true
            });

            return {
                success: true,
                content: result.content,
                durationMs,
                serverId
            };

        } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);

            // Log failed call
            this.db.logToolCall({
                timestamp: startTime,
                toolName: request.toolName,
                mcpServerId: serverId,
                namespaceId: request.namespaceId,
                requestArgs: request.arguments,
                errorMessage: errorMsg,
                durationMs,
                success: false
            });

            this.emit('tool:error', {
                toolName: request.toolName,
                serverId,
                error: errorMsg,
                durationMs
            });

            return {
                success: false,
                error: errorMsg,
                durationMs,
                serverId
            };
        }
    }

    // ============================================
    // Namespace Operations
    // ============================================

    /**
     * Get all tools available in a namespace
     */
    getToolsInNamespace(namespaceId: string): ToolInfo[] {
        const servers = this.db.getServersInNamespace(namespaceId);
        const tools: ToolInfo[] = [];

        for (const server of servers) {
            const connected = this.connectedServers.get(server.id);
            if (connected && connected.status === 'running') {
                tools.push(...connected.tools);
            }
        }

        return tools;
    }

    /**
     * Create a namespace
     */
    createNamespace(name: string, description?: string): Namespace {
        return this.db.createNamespace({
            name,
            description,
            isDefault: false
        });
    }

    /**
     * Get all namespaces
     */
    getAllNamespaces(): Namespace[] {
        return this.db.getAllNamespaces();
    }

    /**
     * Add a server to a namespace
     */
    addServerToNamespace(namespaceId: string, serverIdOrName: string): void {
        const server = this.findDbServer(serverIdOrName);
        if (!server) {
            throw new Error(`Server not found: ${serverIdOrName}`);
        }
        this.db.addServerToNamespace(namespaceId, server.id);
    }

    // ============================================
    // Endpoint Operations
    // ============================================

    /**
     * Create a public endpoint for a namespace
     */
    createEndpoint(name: string, path: string, namespaceId: string): Endpoint {
        return this.db.createEndpoint({
            name,
            path,
            namespaceId,
            enabled: true
        });
    }

    /**
     * Get endpoint by path
     */
    getEndpointByPath(path: string): Endpoint | null {
        return this.db.getEndpointByPath(path);
    }

    /**
     * Handle tool call via endpoint
     */
    async handleEndpointToolCall(
        endpointPath: string,
        toolName: string,
        args: Record<string, unknown>,
        apiKey?: string
    ): Promise<ToolCallResult> {
        const endpoint = this.db.getEndpointByPath(endpointPath);
        if (!endpoint || !endpoint.enabled) {
            return {
                success: false,
                error: `Endpoint not found or disabled: ${endpointPath}`,
                durationMs: 0
            };
        }

        // Validate API key if endpoint requires it
        if (endpoint.apiKeyId && apiKey) {
            const validKey = this.db.validateApiKey(apiKey);
            if (!validKey) {
                return {
                    success: false,
                    error: 'Invalid API key',
                    durationMs: 0
                };
            }
        }

        return this.callTool({
            toolName,
            arguments: args,
            namespaceId: endpoint.namespaceId,
            endpointPath,
            apiKey
        });
    }

    // ============================================
    // Server Management (Legacy API compatible)
    // ============================================

    /**
     * Start server with simple config (legacy API)
     */
    async startServerSimple(name: string, config: {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        url?: string;
    }): Promise<void> {
        const serverConfig: McpServerConfig = {
            name,
            type: config.url ? 'sse' : 'stdio',
            command: config.command,
            args: config.args,
            env: config.env,
            url: config.url,
            enabled: true
        };

        await this.startServer(serverConfig);
    }

    /**
     * Get all servers status
     */
    getAllServers(): Array<{ name: string; status: string; id?: string; tools?: number }> {
        const result: Array<{ name: string; status: string; id?: string; tools?: number }> = [];

        for (const [id, server] of this.connectedServers.entries()) {
            result.push({
                id,
                name: server.name,
                status: server.status,
                tools: server.tools.length
            });
        }

        // Add database servers that aren't connected
        const dbServers = this.db.getAllMcpServers();
        for (const db of dbServers) {
            if (!this.connectedServers.has(db.id)) {
                result.push({
                    id: db.id,
                    name: db.name,
                    status: db.enabled ? 'stopped' : 'disabled'
                });
            }
        }

        return result;
    }

    /**
     * Get client for a server (legacy API)
     */
    getClient(nameOrId: string): Client | BridgeClient | null {
        const server = this.findServer(nameOrId);
        return server?.client || null;
    }

    /**
     * Get all available tools across all connected servers
     */
    getAllTools(): ToolInfo[] {
        const tools: ToolInfo[] = [];
        for (const server of this.connectedServers.values()) {
            if (server.status === 'running') {
                tools.push(...server.tools);
            }
        }
        return tools;
    }

    /**
     * Search tools by query (delegates to database)
     */
    searchTools(query: string): Tool[] {
        // For now, simple name/description search
        const allTools = this.db.getAllTools();
        const lowerQuery = query.toLowerCase();

        return allTools.filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            (t.description && t.description.toLowerCase().includes(lowerQuery))
        );
    }

    // ============================================
    // API Key Management
    // ============================================

    createApiKey(name: string, scopes?: string[]): { apiKey: string; id: string } {
        const result = this.db.createApiKey(name, scopes);
        return { apiKey: result.plainKey, id: result.apiKey.id };
    }

    validateApiKey(key: string): boolean {
        return this.db.validateApiKey(key) !== null;
    }

    // ============================================
    // Statistics
    // ============================================

    getStats(): {
        connectedServers: number;
        totalServers: number;
        totalTools: number;
        namespaces: number;
        endpoints: number;
        recentCalls: number;
    } {
        const dbStats = this.db.getStats();
        const connectedCount = Array.from(this.connectedServers.values())
            .filter(s => s.status === 'running').length;

        return {
            connectedServers: connectedCount,
            totalServers: dbStats.servers,
            totalTools: dbStats.tools,
            namespaces: dbStats.namespaces,
            endpoints: dbStats.endpoints,
            recentCalls: this.db.getToolCallLogs({ limit: 1, since: Date.now() - 3600000 }).length
        };
    }

    // ============================================
    // Helpers
    // ============================================

    private findServer(idOrName: string): ConnectedServer | undefined {
        // Try by ID first
        if (this.connectedServers.has(idOrName)) {
            return this.connectedServers.get(idOrName);
        }

        // Try by name
        for (const server of this.connectedServers.values()) {
            if (server.name === idOrName) {
                return server;
            }
        }

        return undefined;
    }

    private findDbServer(idOrName: string): McpServer | null {
        return this.db.getMcpServer(idOrName) || this.db.getMcpServerByName(idOrName);
    }

    private dbServerToConfig(server: McpServer): McpServerConfig {
        return {
            name: server.name,
            type: server.type,
            command: server.command,
            args: server.args,
            env: server.env,
            url: server.url,
            bearerToken: server.bearerToken,
            headers: server.headers,
            description: server.description,
            icon: server.icon,
            enabled: server.enabled
        };
    }

    private configToDbServer(config: McpServerConfig): Omit<McpServer, 'id' | 'createdAt' | 'updatedAt'> {
        return {
            name: config.name,
            type: config.type,
            command: config.command,
            args: config.args,
            env: config.env,
            url: config.url,
            bearerToken: config.bearerToken,
            headers: config.headers,
            description: config.description,
            icon: config.icon,
            enabled: config.enabled ?? true
        };
    }
}
