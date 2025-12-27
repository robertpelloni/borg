import { McpManager } from './McpManager.js';
import { LogManager } from './LogManager.js';
import { MetaMcpClient } from '../clients/MetaMcpClient.js';
import { ToolSearchService } from '../services/ToolSearchService.js';
import { MemoryManager } from './MemoryManager.js';

export class McpProxyManager {
    private metaClient: MetaMcpClient;
    private searchService: ToolSearchService;
    private internalTools: Map<string, { def: any, handler: (args: any) => Promise<any> }> = new Map();
    private memoryManager?: MemoryManager;

    // Session Management for Progressive Disclosure
    // Map<SessionID, Set<ToolName>>
    private sessionVisibleTools: Map<string, Set<string>> = new Map();
    private progressiveMode = process.env.MCP_PROGRESSIVE_MODE === 'true';
    private MAX_LOADED_TOOLS = 200;

    // Caching for Router Optimization
    private toolRegistry: Map<string, string> = new Map(); // ToolName -> ServerName (or 'internal', 'metamcp')
    private toolDefinitions: Map<string, any> = new Map(); // ToolName -> ToolDefinition

    constructor(
        private mcpManager: McpManager,
        private logManager: LogManager
    ) {
        this.metaClient = new MetaMcpClient();
        this.searchService = new ToolSearchService();
        
        // Listen for server changes to update registry
        this.mcpManager.on('updated', () => {
            this.refreshRegistry().catch(e => console.error('[Proxy] Registry refresh failed:', e));
        });
    }

    setMemoryManager(memoryManager: MemoryManager) {
        this.memoryManager = memoryManager;
    }

    registerInternalTool(def: any, handler: (args: any) => Promise<any>) {
        this.internalTools.set(def.name, { def, handler });
        // Update registry immediately for internal tools
        this.toolRegistry.set(def.name, 'internal');
        this.toolDefinitions.set(def.name, def);
    }

    async start() {
        if (process.env.MCP_DISABLE_METAMCP !== 'true') {
            try {
                await this.metaClient.connect();
            } catch (e) {
                console.warn('[Proxy] MetaMCP connection failed (non-fatal):', e);
            }
        }
        // Initial tool load
        await this.refreshRegistry();
    }

    private async refreshRegistry() {
        console.log('[Proxy] Refreshing Tool Registry...');
        this.toolRegistry.clear();
        this.toolDefinitions.clear();

        // 1. Internal Tools
        for (const [name, tool] of this.internalTools.entries()) {
            this.toolRegistry.set(name, 'internal');
            this.toolDefinitions.set(name, tool.def);
        }

        // 2. Local Servers
        const servers = this.mcpManager.getAllServers();
        for (const s of servers) {
            if (s.status === 'running') {
                const client = this.mcpManager.getClient(s.name);
                if (client) {
                    try {
                        const result = await client.listTools();
                        for (const tool of result.tools) {
                            this.toolRegistry.set(tool.name, s.name);
                            this.toolDefinitions.set(tool.name, tool);
                        }
                    } catch (e) {
                        console.error(`[Proxy] Failed to list tools from ${s.name}`, e);
                    }
                }
            }
        }

        // 3. MetaMCP Tools
        try {
            const metaTools = await this.metaClient.listTools();
            for (const tool of metaTools) {
                // MetaMCP tools might overlap, so we prioritize local if already set?
                // Or overwrite? Let's overwrite for now or keep local priority.
                if (!this.toolRegistry.has(tool.name)) {
                    this.toolRegistry.set(tool.name, 'metamcp');
                    this.toolDefinitions.set(tool.name, tool);
                }
            }
        } catch (e) {
            // ignore
        }

        // Update Search Service
        this.searchService.setTools(Array.from(this.toolDefinitions.values()));
        console.log(`[Proxy] Registry Refreshed. Total Tools: ${this.toolRegistry.size}`);
    }

    // Helper to fetch EVERYTHING (for search index and internal logic)
    private async fetchAllToolsInternal() {
        // Now we can just return values from cache
        return Array.from(this.toolDefinitions.values());
    }

    // Public method called by HubServer
    // We can accept sessionId to customize the view
    async getAllTools(sessionId?: string) {
        // 1. Meta Tools (Always Visible)
        const metaTools = [
            {
                name: "search_tools",
                description: "Semantically search for available tools across all connected MCP servers. Use this to find tools for a specific task.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The search query describing what you want to do." },
                        limit: { type: "number", description: "Max number of results (default: 10)" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "load_tool",
                description: "Load a specific tool by name into your context so you can use it. Use the names found via search_tools.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "The full name of the tool to load." }
                    },
                    required: ["name"]
                }
            }
        ];

        // If NOT in progressive mode, return everything
        if (!this.progressiveMode) {
            const all = await this.fetchAllToolsInternal();
            // Filter out duplicates of meta tools if they exist in 'all'
            const metaNames = new Set(metaTools.map(t => t.name));
            return [...metaTools, ...all.filter(t => !metaNames.has(t.name))];
        }

        // Progressive Mode
        const visible = new Set<string>();
        
        // Always include Internal Tools in Progressive Mode? 
        // MetaMCP includes 'run_code', 'run_agent' etc. as meta tools.
        // We should include our internal tools (which include run_code, run_agent/delegate_task)
        for (const name of this.internalTools.keys()) {
            visible.add(name);
        }

        // Add Session-Loaded Tools
        if (sessionId && this.sessionVisibleTools.has(sessionId)) {
            const sessionSet = this.sessionVisibleTools.get(sessionId)!;
            sessionSet.forEach(t => visible.add(t));
        }

        const allTools = await this.fetchAllToolsInternal();
        const loadedTools = allTools.filter(t => visible.has(t.name));

        // Combine Meta Tools + Loaded Tools (deduplicated)
        const result = [...metaTools];
        const resultNames = new Set(metaTools.map(t => t.name));

        for (const tool of loadedTools) {
            if (!resultNames.has(tool.name)) {
                result.push(tool);
                resultNames.add(tool.name);
            }
        }

        return result;
    }

    async callTool(name: string, args: any, sessionId?: string) {
        // Security Policy Check
        if (['dangerous_tool'].includes(name)) {
            throw new Error("Tool blocked by policy.");
        }

        // Meta Tools
        if (name === 'search_tools') {
            // Force refresh if needed? No, rely on event or manual refresh.
            // But maybe we should refresh if registry is empty?
            if (this.toolRegistry.size === 0) await this.refreshRegistry();
            
            const limit = args.limit || 10;
            const results = this.searchService.search(args.query);
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(results.slice(0, limit), null, 2)
                }]
            };
        }

        if (name === 'load_tool') {
            if (!sessionId) {
                return { content: [{ type: "text", text: "Error: No session ID provided for tool loading." }], isError: true };
            }
            if (!this.sessionVisibleTools.has(sessionId)) {
                this.sessionVisibleTools.set(sessionId, new Set());
            }
            
            const sessionSet = this.sessionVisibleTools.get(sessionId)!;
            
            // FIFO Eviction if limit reached
            if (sessionSet.size >= this.MAX_LOADED_TOOLS && !sessionSet.has(args.name)) {
                const first = sessionSet.values().next().value;
                if (first) sessionSet.delete(first);
            }
            
            sessionSet.add(args.name);
            return {
                content: [{ type: "text", text: `Tool '${args.name}' loaded successfully. It is now available.` }]
            };
        }

        // Use Registry for Routing
        const serverName = this.toolRegistry.get(name);
        
        if (!serverName) {
             // Fallback: Try to refresh registry once if tool not found
             console.log(`[Proxy] Tool ${name} not found in registry. Refreshing...`);
             await this.refreshRegistry();
             if (!this.toolRegistry.has(name)) {
                 throw new Error(`Tool ${name} not found in any active server.`);
             }
        }
        
        const targetServer = this.toolRegistry.get(name)!;

        this.logManager.log({ type: 'request', tool: name, server: targetServer, args });

        try {
            let result;
            if (targetServer === 'internal') {
                const handler = this.internalTools.get(name)!.handler;
                const rawResult = await handler(args);
                // Standardize output
                if (rawResult && rawResult.content) {
                    result = rawResult;
                } else {
                    result = { content: [{ type: "text", text: typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult, null, 2) }] };
                }
            } else if (targetServer === 'metamcp') {
                result = await this.metaClient.callTool(name, args);
            } else {
                // Local Server
                const client = this.mcpManager.getClient(targetServer);
                if (!client) throw new Error(`Server ${targetServer} is not connected.`);
                result = await client.callTool({ name, arguments: args });
            }

            this.logManager.log({ type: 'response', tool: name, server: targetServer, result });
            
            // Hook for Memory
            if (this.memoryManager) {
                this.memoryManager.ingestInteraction(name, args, result).catch(e => console.error(e));
            }

            return result;

        } catch (e: any) {
            const err = { isError: true, content: [{ type: "text", text: e.message }] };
            this.logManager.log({ type: 'error', tool: name, server: targetServer, error: e.message });
            return err;
        }
    }
}

