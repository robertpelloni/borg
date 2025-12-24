import { McpManager } from './McpManager.js';
import { LogManager } from './LogManager.js';
import { MetaMcpClient } from '../clients/MetaMcpClient.js';
import { ToolSearchService } from '../services/ToolSearchService.js';

export class McpProxyManager {
    private metaClient: MetaMcpClient;
    private searchService: ToolSearchService;
    private internalTools: Map<string, { def: any, handler: (args: any) => Promise<any> }> = new Map();

    // Session Management for Progressive Disclosure
    // Map<SessionID, Set<ToolName>>
    private sessionVisibleTools: Map<string, Set<string>> = new Map();
    private progressiveMode = process.env.MCP_PROGRESSIVE_MODE === 'true';

    constructor(
        private mcpManager: McpManager,
        private logManager: LogManager
    ) {
        this.metaClient = new MetaMcpClient();
        this.searchService = new ToolSearchService();
    }

    registerInternalTool(def: any, handler: (args: any) => Promise<any>) {
        this.internalTools.set(def.name, { def, handler });
    }

    async start() {
        await this.metaClient.connect();
        // Initial tool load for search
        await this.refreshSearchIndex();
    }

    private async refreshSearchIndex() {
        try {
            const tools = await this.fetchAllToolsInternal();
            this.searchService.setTools(tools);
        } catch (e) {
            console.warn('[Proxy] Failed to refresh search index:', e);
        }
    }

    // Helper to fetch EVERYTHING (for search index and internal logic)
    private async fetchAllToolsInternal() {
        const tools = [];
        const servers = this.mcpManager.getAllServers();

        // 1. Internal Tools
        for (const tool of this.internalTools.values()) {
            tools.push(tool.def);
        }

        // 2. Local Servers
        for (const s of servers) {
            if (s.status === 'running') {
                const client = this.mcpManager.getClient(s.name);
                if (client) {
                    try {
                        const result = await client.listTools();
                        tools.push(...result.tools);
                    } catch (e) {
                        console.error(`Failed to list tools from ${s.name}`, e);
                    }
                }
            }
        }

        // 3. MetaMCP Tools (Remote/Docker)
        const metaTools = await this.metaClient.listTools();
        tools.push(...metaTools);

        return tools;
    }

    // Public method called by HubServer
    // We can accept sessionId to customize the view
    async getAllTools(sessionId?: string) {
        // Always include meta-tools
        const metaTools = [
            {
                name: "search_tools",
                description: "Search for available tools by keyword (Fuzzy Search)",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "load_tool",
                description: "Load a specific tool into your context for use.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string" }
                    },
                    required: ["name"]
                }
            }
        ];

        // If NOT in progressive mode, return everything
        if (!this.progressiveMode) {
            const all = await this.fetchAllToolsInternal();
            // Dedup search_tools if it exists in internalTools?
            // We manually add it here, so filter it out from 'all' if present to be safe
            return [...metaTools, ...all.filter(t => t.name !== 'search_tools' && t.name !== 'load_tool')];
        }

        // Progressive Mode
        const visible = new Set<string>();
        if (sessionId && this.sessionVisibleTools.has(sessionId)) {
            const sessionSet = this.sessionVisibleTools.get(sessionId)!;
            sessionSet.forEach(t => visible.add(t));
        }

        // Always show Internal Tools? No, hide them too unless foundational.
        // Actually "run_code" and "run_agent" should probably be visible always?
        // Let's make internal tools visible by default for utility.
        const internalDefs = Array.from(this.internalTools.values()).map(v => v.def);

        const allTools = await this.fetchAllToolsInternal();
        const loadedTools = allTools.filter(t => visible.has(t.name));

        return [...metaTools, ...internalDefs, ...loadedTools];
    }

    async callTool(name: string, args: any, sessionId?: string) {
        // Security Policy Check
        if (['dangerous_tool'].includes(name)) {
            throw new Error("Tool blocked by policy.");
        }

        // Meta Tools
        if (name === 'search_tools') {
            await this.refreshSearchIndex();
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(this.searchService.search(args.query), null, 2)
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
            this.sessionVisibleTools.get(sessionId)!.add(args.name);
            return {
                content: [{ type: "text", text: `Tool '${args.name}' loaded successfully. It is now available.` }]
            };
        }

        // 1. Internal Tools
        if (this.internalTools.has(name)) {
            this.logManager.log({ type: 'request', tool: name, server: 'internal', args });
            try {
                const result = await this.internalTools.get(name)!.handler(args);
                const response = { content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
                this.logManager.log({ type: 'response', tool: name, server: 'internal', result: response });
                return response;
            } catch (e: any) {
                const err = { isError: true, content: [{ type: "text", text: e.message }] };
                this.logManager.log({ type: 'error', tool: name, server: 'internal', error: e.message });
                return err;
            }
        }

        // 2. Local Servers
        const servers = this.mcpManager.getAllServers();
        for (const s of servers) {
            if (s.status === 'running') {
                const client = this.mcpManager.getClient(s.name);
                if (client) {
                    try {
                        const list = await client.listTools();
                        if (list.tools.find((t: any) => t.name === name)) {
                            this.logManager.log({ type: 'request', tool: name, server: s.name, args });
                            const result = await client.callTool({ name, arguments: args });
                            this.logManager.log({ type: 'response', tool: name, server: s.name, result });
                            return result;
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        }

        // 3. Check MetaMCP
        try {
            this.logManager.log({ type: 'request', tool: name, server: 'metamcp', args });
            const result = await this.metaClient.callTool(name, args);
            this.logManager.log({ type: 'response', tool: name, server: 'metamcp', result });
            return result;
        } catch (e) {
             // ignore
        }

        throw new Error(`Tool ${name} not found in any active server.`);
    }
}
