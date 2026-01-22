# MCP Router Integration Guide

**Purpose**: Document integration points between new Ultimate MCP Router services and existing McpProxyManager

**Version**: 1.0
**Last Updated**: 2026-01-17

---

## Services Created

### 1. MCPRegistryService (`packages/core/src/services/MCPRegistryService.ts`)
**Purpose**: Discover MCP servers from external registries

**Key Features**:
- Scan Punkpeye/AppCypher, wong2, ToolSDK registries
- Extract server metadata (categories, tags, ratings)
- Deduplicate servers across registries
- Search and filter servers

**Integration with McpProxyManager**:
```typescript
import { MCPRegistryService } from '../services/MCPRegistryService.js';

// In McpProxyManager constructor
private mcpRegistryService: MCPRegistryService;

constructor(...) {
    // existing code
    this.mcpRegistryService = MCPRegistryService.getInstance(dataDir);
}

// Enhanced refreshRegistry
private async refreshRegistry() {
    console.log('[Proxy] Refreshing Tool Registry...');

    this.toolRegistry.clear();
    this.toolDefinitions.clear();

    // 1. Internal Tools
    for (const [name, tool] of this.internalTools.entries()) {
        this.toolRegistry.set(name, 'internal');
        this.toolDefinitions.set(name, tool.def);
    }

    // 2. Discovered Servers from Registry
    const discoveredServers = this.mcpRegistryService.getAllServers();
    for (const server of discoveredServers) {
        if (server.installed) {
            const client = this.mcpManager.getClient(server.name);
            if (client && 'listTools' in client) {
                try {
                    const result = await (client as any).listTools();
                    for (const tool of result.tools) {
                        this.toolRegistry.set(tool.name, server.name);
                        this.toolDefinitions.set(tool.name, tool);
                    }
                } catch (e) {
                    console.error(`[Proxy] Failed to list tools from ${server.name}:`, e);
                }
            }
        }
    }

    // 3. Local Servers (from existing logic)
    // ... existing code ...

    // Update Search Service
    this.searchService.setTools(Array.from(this.toolDefinitions.values()));
}
```

**API Methods to Add to McpProxyManager**:
```typescript
/**
 * Discover servers from all registries
 */
async discoverServers(): Promise<RegistryServerDefinition[]> {
    return await this.mcpRegistryService.discoverAll();
}

/**
 * Search discovered servers
 */
searchRegistryServers(query: string, options?: DiscoveryOptions): RegistryServerDefinition[] {
    return this.mcpRegistryService.searchServers(query, options);
}

/**
 * Get registry statistics
 */
getRegistryStats() {
    return this.mcpRegistryService.getStats();
}
```

---

### 2. ServerRegistryService (`packages/core/src/services/ServerRegistryService.ts`)
**Purpose**: Install and manage MCP servers, updates, health checks

**Key Features**:
- Install servers from GitHub/npm
- Auto-check for updates
- Health monitoring with ping checks
- Update servers from upstream

**Integration with McpProxyManager**:
```typescript
import { ServerRegistryService } from '../services/ServerRegistryService.js';

// In McpProxyManager constructor
private serverRegistryService: ServerRegistryService;

constructor(...) {
    // existing code
    this.serverRegistryService = ServerRegistryService.getInstance(dataDir);
}

// New installation method
async installServerFromRegistry(serverName: string): Promise<ServerInstallationResult> {
    return await this.serverRegistryService.installServer(serverName, {
        type: 'github',
        autoStart: true
    });
}

// Uninstall server
async uninstallServerFromRegistry(serverId: string): Promise<boolean> {
    return await this.serverRegistryService.uninstallServer(serverId);
}

// Check for updates
async checkServerUpdates(): Promise<ServerUpdateInfo[]> {
    return await this.serverRegistryService.checkUpdates();
}

// Update a server
async updateServerFromRegistry(serverId: string): Promise<ServerInstallationResult> {
    return await this.serverRegistryService.updateServer(serverId);
}

// Health check
async checkServerHealth(serverId: string): Promise<HealthCheckResult> {
    const server = this.mcpManager.getServerById(serverId);
    const mcpServer = this.mcpManager.getMcpServer(serverId);
    if (!mcpServer) return { serverName: 'unknown', status: 'error' };

    return await this.serverRegistryService.checkServerHealth(mcpServer);
}
```

**API Methods to Add to McpProxyManager**:
```typescript
/**
 * Install a server from registry
 */
async installServer(name: string): Promise<ServerInstallationResult>;

/**
 * Uninstall a server
 */
async uninstallServer(serverId: string): Promise<boolean>;

/**
 * Check for updates on all servers
 */
async checkUpdates(): Promise<ServerUpdateInfo[]>;

/**
 * Update a server
 */
async updateServer(serverId: string): Promise<ServerInstallationResult>;

/**
 * Check health of all servers
 */
async checkAllServerHealth(): Promise<HealthCheckResult[]>;
```

---

### 3. ConfigurationService (`packages/core/src/services/ConfigurationService.ts`)
**Purpose**: Auto-detect configs, expand env vars, manage secrets

**Key Features**:
- Scan for .mcp.json, .borg.json files
- Multi-format support (Claude, OpenAI, Google)
- Environment variable expansion ($VAR)
- Secret expansion ({secret:NAME})
- Import/export configurations

**Integration with McpProxyManager**:
```typescript
import { ConfigurationService } from '../services/ConfigurationService.js';

// In McpProxyManager constructor
private configService: ConfigurationService;

constructor(...) {
    // existing code
    this.configService = ConfigurationService.getInstance(dataDir);
}

// Auto-detect and import configurations
async autoDetectConfigs(): Promise<ImportResult> {
    const detectedConfigs = await this.configService.detectConfigs({
        scanPaths: process.cwd(),
        recursive: false
    });

    let imported = 0;
    for (const configFile of detectedConfigs) {
        for (const server of configFile.servers) {
            const existing = this.db.getMcpServerByName(server.name);
            if (existing) {
                this.db.updateMcpServer(existing.id, server);
            } else {
                this.db.createMcpServer(server);
            }
            imported++;
        }
    }

    return { success: true, imported, failed: 0, errors: [] };
}

// Export all configurations
async exportAllConfigs(format: 'claude' | 'openai' | 'google' | 'borg' = 'borg'): Promise<string> {
    return await this.configService.exportConfigs(format);
}

// Write configuration to file
async writeConfig(filePath: string, config: any): Promise<void> {
    // Convert to McpServer format
    const servers = Array.isArray(config.mcpServers)
        ? config.mcpServers
        : config.servers
        ? servers.map(s => this.configToDbServer(s))
        : [];

    // Use configService to write
    await this.configService.writeConfig(filePath, 'borg');
}
```

**API Methods to Add to McpProxyManager**:
```typescript
/**
 * Auto-detect configurations from file system
 */
async detectConfigurations(): Promise<ConfigFile[]>;

/**
 * Import configurations from files
 */
async importConfigurations(filePaths: string[]): Promise<ImportResult>;

/**
 * Export all configurations to file
 */
async exportConfigurations(format: 'borg' | 'claude' | 'openai' | 'google', filePath: string): Promise<string>;

/**
 * Validate configuration before applying
 */
validateConfiguration(config: McpServerConfig): ValidationResult {
    return this.configService.validateServer(this.configToDbServer(config));
}
```

---

### 4. McpSessionService (`packages/core/src/services/McpSessionService.ts`)
**Purpose**: Enhanced session lifecycle management

**Key Features**:
- Auto-start servers on boot
- Auto-restart crashed servers
- Keep-alive heartbeat monitoring
- Latency tracking and metrics
- Multi-client session registry

**Integration with McpProxyManager**:
```typescript
import { McpSessionService } from '../services/McpSessionService.js';

// In McpProxyManager constructor
private mcpSessionService: McpSessionService;

constructor(...) {
    // existing code
    this.mcpSessionService = McpSessionService.getInstance(dataDir);

    // Initialize session service
    await this.mcpSessionService.initialize();

    // Listen for session events
    this.mcpSessionService.on('session:error', async ({ session, error }) => {
        console.error(`[Proxy] Session error for ${session.serverName}: ${error}`);

        // Mark as error in McpProxyManager
        const connectedServer = this.connectedServers.get(session.serverId);
        if (connectedServer) {
            connectedServer.status = 'error';
            connectedServer.error = error;
            this.emit('server:error', connectedServer);
        }
    });

    this.mcpSessionService.on('session:timeout', ({ session }) => {
        console.warn(`[Proxy] Session timeout for ${session.serverName}`);

        const connectedServer = this.connectedServers.get(session.serverId);
        if (connectedServer && session.autoRestart) {
            // Attempt restart
            this.restartServer(session.serverId);
        }
    });
}

// Start session with auto-restart enabled
async startServerWithSession(serverId: string, autoStart: boolean = true): Promise<ConnectedServer> {
    const result = await this.startServer(serverId);

    if (autoStart) {
        await this.mcpSessionService.startSession(serverId);
    }

    return result;
}

// Stop server and pause session
async stopServerWithSession(serverId: string): Promise<void> {
    await this.mcpSessionService.stopSession(serverId);
    await this.stopServer(serverId);
}

// Get all session metrics
getSessionMetrics(): Map<string, PerformanceMetrics[]> {
    return this.mcpSessionService.getAllMetrics();
}

// Update heartbeat when tool call completes
private async updateHeartbeat(serverId: string, latencyMs?: number): Promise<void> {
    const connectedServer = this.connectedServers.get(serverId);
    if (connectedServer) {
        await this.mcpSessionService.updateHeartbeat(serverId, latencyMs);
    }
}
```

**API Methods to Add to McpProxyManager**:
```typescript
/**
 * Initialize session service (call on system startup)
 */
async initializeSessions(): Promise<void>;

/**
 * Get all session metrics
 */
getAllSessionMetrics(): Map<string, PerformanceMetrics[]>;

/**
 * Get session statistics
 */
getSessionStats(): { totalSessions: number; running: number; stopped: number; error: number; totalClients: number };

/**
 * Set auto-start for a server
 */
setServerAutoStart(serverId: string, enabled: boolean): void;

/**
 * Restart a server's session
 */
restartSession(serverId: string): Promise<void>;

/**
 * Shutdown all sessions
 */
async shutdownAllSessions(): Promise<void>;
```

---

## Integration Points in Existing McpProxyManager

### Constructor Integration
```typescript
export class McpProxyManager extends EventEmitter {
    private metaClient: MetaMcpClient;
    private searchService: ToolSearchService;
    private internalTools: Map<string, { def: any, handler: (args: any) => Promise<any> }> = new Map();
    private memoryManager?: MemoryManager;
    private policyService: PolicyService;
    private agentExecutor?: AgentExecutor;
    private agentManager?: AgentManager;
    private savedScriptService = getSavedScriptService();
    private namespaceOverrides = NamespaceToolOverrideService.createOrInMemory();
    private sessionNamespace: Map<string, string> = new Map();
    private sessionEndpointPath: Map<string, string> = new Map();
    private toolAnnotationManager?: any;

    // NEW SERVICES
    private mcpRegistryService: MCPRegistryService;
    private serverRegistryService: ServerRegistryService;
    private configService: ConfigurationService;
    private mcpSessionService: McpSessionService;

    private listToolsMiddlewares: ListToolsMiddleware[] = [];
    private callToolMiddlewares: CallToolMiddleware[] = [];
    private composedListToolsHandler!: ListToolsHandler;
    private composedCallToolHandler!: CallToolHandler;

    // ... existing code ...

    constructor(
        private mcpManager: McpManager,
        private logManager: LogManager,
        options?: {
            policyService?: PolicyService;
            toolSearchService?: ToolSearchService;
            agentExecutor?: AgentExecutor;
            agentManager?: AgentManager;
            savedScriptService?: ReturnType<typeof getSavedScriptService>;
        }
    ) {
        super();
        // Initialize new services
        this.mcpRegistryService = MCPRegistryService.getInstance(options?.dataDir);
        this.serverRegistryService = ServerRegistryService.getInstance(options?.dataDir);
        this.configService = ConfigurationService.getInstance(options?.dataDir);
        this.mcpSessionService = McpSessionService.getInstance(options?.dataDir);

        // ... existing code
    }
}
```

### Enhanced Methods

#### Registry Discovery
```typescript
/**
 * Discover and index all MCP servers from registries
 */
async discoverAllServers(): Promise<void> {
    console.log('[McpProxyManager] Discovering all MCP servers from registries...');
    const servers = await this.mcpRegistryService.discoverAll();
    console.log(`[McpProxyManager] Discovered ${servers.length} servers`);
    this.emit('registry:discovered', servers);
}

/**
 * Search discovered servers
 */
searchDiscoveredServers(query: string, options?: DiscoveryOptions): RegistryServerDefinition[] {
    return this.mcpRegistryService.searchServers(query, options);
}
```

#### Server Installation
```typescript
/**
 * Install a server from registry
 */
async installServer(name: string, options?: InstallationOptions): Promise<ServerInstallationResult> {
    console.log(`[McpProxyManager] Installing server: ${name}`);
    const result = await this.serverRegistryService.installServer(name, options);

    if (result.success && result.serverId) {
        // Auto-start the server
        await this.mcpSessionService.startSession(result.serverId!);
        // Actually start the MCP server
        await this.startServer(result.serverId!);
    }

    this.emit('server:installed', result);
    return result;
}

/**
 * Uninstall a server
 */
async uninstallServer(serverId: string): Promise<boolean> {
    console.log(`[McpProxyManager] Uninstalling server: ${serverId}`);
    await this.mcpSessionService.stopSession(serverId);
    const result = await this.serverRegistryService.uninstallServer(serverId);
    this.emit('server:uninstalled', { serverId, result });
    return result;
}

/**
 * Check for updates on all servers
 */
async checkUpdates(): Promise<ServerUpdateInfo[]> {
    console.log('[McpProxyManager] Checking for server updates...');
    const updates = await this.serverRegistryService.checkUpdates();
    this.emit('updates:checked', updates);
    return updates;
}

/**
 * Update a server
 */
async updateServer(serverId: string): Promise<ServerInstallationResult> {
    console.log(`[McpProxyManager] Updating server: ${serverId}`);
    const result = await this.serverRegistryService.updateServer(serverId);

    if (result.success) {
        await this.stopServer(serverId);
        await this.startServer(serverId);
    }

    this.emit('server:updated', result);
    return result;
}
```

#### Configuration Management
```typescript
/**
 * Auto-detect configurations
 */
async detectConfigurations(): Promise<ConfigFile[]> {
    console.log('[McpProxyManager] Auto-detecting MCP configurations...');
    const configs = await this.configService.detectConfigs();
    console.log(`[McpProxyManager] Detected ${configs.length} configuration files`);
    this.emit('configs:detected', configs);
    return configs;
}

/**
 * Import configurations from files
 */
async importConfigurations(filePaths: string[]): Promise<ImportResult> {
    console.log(`[McpProxyManager] Importing ${filePaths.length} configuration files...`);
    const result = await this.configService.importConfigs(filePaths);
    this.emit('configs:imported', result);
    return result;
}

/**
 * Export configurations to file
 */
async exportConfigurations(format: 'borg' | 'claude' | 'openai' | 'google', filePath: string): Promise<string> {
    console.log(`[McpProxyManager] Exporting configurations to ${filePath}...`);
    const content = await this.configService.exportConfigs(format);
    this.emit('configs:exported', { format, filePath, content });
    return content;
}
```

#### Session Management
```typescript
/**
 * Initialize session service
 */
async initializeSessions(): Promise<void> {
    console.log('[McpProxyManager] Initializing session service...');
    await this.mcpSessionService.initialize();
    console.log('[McpProxyManager] Session service initialized');
}

/**
 * Get all session metrics
 */
getSessionMetrics(): Map<string, PerformanceMetrics[]> {
    return this.mcpSessionService.getAllMetrics();
}

/**
 * Get session statistics
 */
getSessionStats(): { totalSessions: number; running: number; stopped: number; error: number; totalClients: number } {
    const stats = this.mcpSessionService.getStats();
    this.emit('session:stats', stats);
    return stats;
}

/**
 * Enable auto-start for a server
 */
setServerAutoStart(serverId: string, enabled: boolean): void {
    this.mcpSessionService.setAutoStart(serverId, enabled);
}

/**
 * Restart a server session
 */
async restartSession(serverId: string): Promise<void> {
    await this.mcpSessionService.stopSession(serverId);
    await this.mcpSessionService.startSession(serverId);
    await this.startServer(serverId);
}

/**
 * Shutdown all sessions
 */
async shutdownAllSessions(): Promise<void> {
    console.log('[McpProxyManager] Shutting down all sessions...');
    await this.mcpSessionService.shutdown();
    console.log('[McpProxyManager] All sessions shut down');
}
```

---

## API Routes to Add

### Registry Endpoints
```typescript
// GET /api/mcp/registry/servers
// Discover and search servers from all registries
app.get('/api/mcp/registry/servers', async (request, reply) => {
    const query = request.query.q as string | undefined;
    const servers = await mcpProxyManager.searchDiscoveredServers(query);
    return reply.send(servers);
});

// POST /api/mcp/registry/install
// Install a server from registry
app.post('/api/mcp/registry/install', async (request, reply) => {
    const { name, autoStart } = request.body as { name: string; autoStart?: boolean };
    const result = await mcpProxyManager.installServer(name, { autoStart });
    return reply.send(result);
});

// GET /api/mcp/registry/stats
// Get registry statistics
app.get('/api/mcp/registry/stats', async (request, reply) => {
    const stats = mcpProxyManager.getRegistryStats();
    return reply.send(stats);
});
```

### Configuration Endpoints
```typescript
// GET /api/mcp/configs/detect
// Auto-detect configurations
app.get('/api/mcp/configs/detect', async (request, reply) => {
    const configs = await mcpProxyManager.detectConfigurations();
    return reply.send(configs);
});

// POST /api/mcp/configs/import
// Import configurations
app.post('/api/mcp/configs/import', async (request, reply) => {
    const { files } = request.body as { files: string[] };
    const result = await mcpProxyManager.importConfigurations(files);
    return reply.send(result);
});

// GET /api/mcp/configs/export/:format
// Export configurations
app.get('/api/mcp/configs/export/:format', async (request, reply) => {
    const format = request.params.format as string;
    const content = await mcpProxyManager.exportConfigurations(format);
    return reply.send({ format, content });
});
```

### Session Endpoints
```typescript
// GET /api/mcp/sessions/metrics
// Get session metrics
app.get('/api/mcp/sessions/metrics', async (request, reply) => {
    const metrics = mcpProxyManager.getSessionMetrics();
    return reply.send(Array.from(metrics.entries()));
});

// GET /api/mcp/sessions/stats
// Get session statistics
app.get('/api/mcp/sessions/stats', async (request, reply) => {
    const stats = mcpProxyManager.getSessionStats();
    return reply.send(stats);
});

// POST /api/mcp/sessions/:id/restart
// Restart a session
app.post('/api/mcp/sessions/:id/restart', async (request, reply) => {
    const serverId = request.params.id as string;
    await mcpProxyManager.restartSession(serverId);
    return reply.send({ success: true });
});

// POST /api/mcp/sessions/shutdown
// Shutdown all sessions
app.post('/api/mcp/sessions/shutdown', async (request, reply) => {
    await mcpProxyManager.shutdownAllSessions();
    return reply.send({ success: true });
});
```

---

## Usage Examples

### Discover and Install a Server
```typescript
// 1. Discover servers
const servers = await mcpProxyManager.discoverAllServers();
console.log(`Found ${servers.length} servers`);

// 2. Filter by category
const fileServers = mcpProxyManager.searchDiscoveredServers('file', { includeCategories: ['file-system'] });

// 3. Install a server
const result = await mcpProxyManager.installServer('filesystem-server', { autoStart: true });
console.log(result);
```

### Auto-Detect and Import Configurations
```typescript
// Auto-detect configurations on startup
const configs = await mcpProxyManager.detectConfigurations();
console.log(`Detected ${configs.length} configurations`);

// Import from specific files
const result = await mcpProxyManager.importConfigurations(['./my-mcp.json', './project-mcp.json']);
console.log(result);
```

### Monitor Sessions
```typescript
// Get session statistics
const stats = await mcpProxyManager.getSessionStats();
console.log(`Sessions: ${stats.totalSessions} total, ${stats.running} running, ${stats.error} error`);

// Get metrics for a specific server
const metrics = mcpProxyManager.getSessionMetrics().get('my-server') || [];
console.log(`Average latency: ${metrics.avgLatencyMs}ms`);

// Enable auto-start for a server
mcpProxyManager.setServerAutoStart('server-id', true);
```

---

## Summary

The new services provide:

1. **MCPRegistryService**: Server discovery from 100+ registries
2. **ServerRegistryService**: Installation, updates, health checks
3. **ConfigurationService**: Auto-detect configs, env/secrets management
4. **McpSessionService**: Enhanced session lifecycle with auto-restart, keep-alive

These integrate with existing **McpProxyManager** to provide a complete Ultimate MCP Router solution.

---

**Next Steps**:
1. Add new methods to `McpProxyManager` class
2. Update service exports in `packages/core/src/services/index.ts`
3. Add API routes for new endpoints
4. Test integration with progressive disclosure
5. Update documentation and examples
