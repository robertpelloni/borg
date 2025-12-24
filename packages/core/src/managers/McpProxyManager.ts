import { McpManager } from './McpManager.js';
import { LogManager } from './LogManager.js';
import { MetaMcpClient } from '../clients/MetaMcpClient.js';
import { ToolSearchService } from '../services/ToolSearchService.js';

export class McpProxyManager {
    private metaClient: MetaMcpClient;
    private searchService: ToolSearchService;

    constructor(
        private mcpManager: McpManager,
        private logManager: LogManager
    ) {
        this.metaClient = new MetaMcpClient();
        this.searchService = new ToolSearchService();
    }

    async start() {
        await this.metaClient.connect();
        // Initial tool load for search
        await this.refreshSearchIndex();
    }

    private async refreshSearchIndex() {
        try {
            const tools = await this.getAllTools();
            this.searchService.setTools(tools);
        } catch (e) {
            console.warn('[Proxy] Failed to refresh search index:', e);
        }
    }

    async getAllTools() {
        const tools = [];
        const servers = this.mcpManager.getAllServers();

        // 1. Local Servers
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

        // 2. MetaMCP Tools (Remote/Docker)
        const metaTools = await this.metaClient.listTools();
        tools.push(...metaTools);

        // Include search_tools helper
        tools.push({
            name: "search_tools",
            description: "Search for available tools by keyword (Fuzzy Search)",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" }
                },
                required: ["query"]
            }
        });

        return tools;
    }

    async callTool(name: string, args: any) {
        // Intercept search_tools
        if (name === 'search_tools') {
            await this.refreshSearchIndex(); // Ensure fresh
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(this.searchService.search(args.query), null, 2)
                }]
            };
        }

        // 1. Check Local Servers
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

        // 2. Check MetaMCP
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
